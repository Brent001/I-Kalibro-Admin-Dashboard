import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { account, securityLog } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt, { type Secret } from 'jsonwebtoken';
import { z } from 'zod';
import type { ZodIssue } from 'zod';
import { dev } from '$app/environment';

// Environment variables - ensure these are set
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// Input validation schema
const loginSchema = z.object({
    username: z.string()
        .min(1, 'Username is required')
        .trim(),
    password: z.string()
        .min(1, 'Password is required')
});

// Rate limiting (simple in-memory store - use Redis in production)
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function isRateLimited(identifier: string): boolean {
    const attempts = loginAttempts.get(identifier);
    if (!attempts) return false;
    
    // Reset if time has passed
    if (Date.now() > attempts.resetTime) {
        loginAttempts.delete(identifier);
        return false;
    }
    
    return attempts.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const attempts = loginAttempts.get(identifier);
    
    if (!attempts || now > attempts.resetTime) {
        loginAttempts.set(identifier, {
            count: 1,
            resetTime: now + LOCKOUT_DURATION
        });
    } else {
        attempts.count++;
    }
}

function clearFailedAttempts(identifier: string): void {
    loginAttempts.delete(identifier);
}

// Helper to get browser info from user-agent
function getBrowserType(userAgent: string | null): string {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
    return 'Other';
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
    try {
        const clientIP = getClientAddress();
        
        // Check rate limiting
        if (isRateLimited(clientIP)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Too many failed login attempts. Please try again later.'
                }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const validationResult = loginSchema.safeParse(body);

        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err: ZodIssue) => ({
                field: err.path.join('.'),
                message: err.message
            }));

            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Invalid input',
                    errors
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { username, password } = validationResult.data;

        // Find user in database by username or email
        const [user] = await db
            .select()
            .from(account)
            .where(eq(account.username, username))
            .limit(1);

        // If not found by username, try email
        let userByEmail = null;
        if (!user) {
            [userByEmail] = await db
                .select()
                .from(account)
                .where(eq(account.email, username))
                .limit(1);
        }

        const foundUser = user || userByEmail;

        // Always hash the provided password to prevent timing attacks
        const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks';
        const targetHash = foundUser?.password || dummyHash;

        // Verify password
        const isValidPassword = await bcrypt.compare(password, targetHash);

        // Check if user exists and password is correct and account is active
        if (!foundUser || !isValidPassword || !foundUser.isActive) {
            recordFailedAttempt(clientIP);
            
            // Generic error message to prevent user enumeration
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Invalid username or password'
                }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Clear any failed attempts on successful login
        clearFailedAttempts(clientIP);

        // Create JWT token
        const tokenPayload = {
            id: foundUser.id,
            username: foundUser.username,
            role: foundUser.role
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
            issuer: 'kalibro-library',
            subject: foundUser.id.toString()
        });

        // Set cookie for dashboard access
        cookies.set('token', token, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        // Log successful login (don't log password or sensitive data)
        console.log(`Successful login: ${foundUser.username} (${foundUser.role}) from ${clientIP}`);

        // Log security event
        const userAgent = request.headers.get('user-agent');
        const browserType = getBrowserType(userAgent);

        await db.insert(securityLog).values({
            accountId: foundUser.id, // Use accountId for admin/staff
            userId: null,            // No userId for admin/staff login
            eventType: 'login',
            eventTime: new Date(),
            browser: browserType,
            ipAddress: clientIP
        });

        // Return success response with user data (excluding password)
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Login successful'
            }),
            { 
                status: 200, 
                headers: { 
                    'Content-Type': 'application/json'
                } 
            }
        );

    } catch (error) {
        console.error('Login API error:', error);

        return new Response(
            JSON.stringify({
                success: false,
                message: 'An internal server error occurred. Please try again later.'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

// Optional: GET endpoint to verify token
export const GET: RequestHandler = async ({ request }) => {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ success: false, message: 'No token provided' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Optionally verify user still exists and is active
        const [user] = await db
            .select({
                id: account.id,
                name: account.name,
                username: account.username,
                email: account.email,
                role: account.role,
                isActive: account.isActive
            })
            .from(account)
            .where(eq(account.id, decoded.userId))
            .limit(1);

        if (!user || !user.isActive) {
            return new Response(
                JSON.stringify({ success: false, message: 'Invalid token' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                user
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, message: 'Invalid token' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }
};