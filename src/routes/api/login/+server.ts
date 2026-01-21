import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { staffAccount, securityLog } from '$lib/server/db/schema/schema.js'; // updated import
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt, { type Secret } from 'jsonwebtoken';
import { z } from 'zod';
import type { ZodIssue } from 'zod';
import { dev } from '$app/environment';
import { randomBytes, createHash } from 'crypto';
import { redisClient } from '$lib/server/db/cache.js';

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

// Helper function to hash tokens for storage
function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

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

        // Find user in database by username or email (optimized to single query)
        const [foundUser] = await db
            .select()
            .from(staffAccount)
            .where(
                // Check both username and email in a single query
                eq(staffAccount.username, username) || eq(staffAccount.email, username)
            )
            .limit(1);

        // Always hash the provided password to prevent timing attacks
        const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks';
        const targetHash = foundUser?.password || dummyHash;

        // Verify password
        const isValidPassword = await bcrypt.compare(password, targetHash);

        // Get browser type from user-agent
        const userAgent = request.headers.get('user-agent');
        const browserType = getBrowserType(userAgent);

        // Check if user exists and password is correct and account is active
        if (!foundUser || !isValidPassword || !foundUser.isActive) {
            recordFailedAttempt(clientIP);

            // --- LOG FAILED LOGIN ATTEMPT ---
            await db.insert(securityLog).values({
                staffAccountId: foundUser?.id ?? null,
                userId: null,
                eventType: 'failed_login',
                eventTime: new Date(),
                browser: browserType,
                ipAddress: clientIP
            });

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

        // Generate a unique session ID for this login
        const sessionId = randomBytes(16).toString('hex');
        
        // Create refresh token payload first (we need to hash it in session)
        const refreshTokenPayload = {
            userId: foundUser.id,
            sessionId: sessionId,
            tokenType: 'refresh',
            jti: `${sessionId}-refresh`
        };
        
        const refreshToken = jwt.sign(refreshTokenPayload, process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production', {
            expiresIn: '7d', // Refresh token: 7 days
            issuer: 'kalibro-library',
            subject: String(foundUser.id)
        });

        // Create session data with hashed refresh token
        const now = new Date();
        const sessionData = {
            id: sessionId,
            userId: foundUser.id,
            token: undefined, // Will be set on token refresh
            refreshToken: hashToken(refreshToken), // Store HASHED refresh token
            userAgent: request.headers.get('user-agent') || '',
            ipAddress: clientIP,
            createdAt: now,
            lastUsedAt: now,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            isActive: true
        };
        
        // Store session data and add to user's session set in parallel for speed
        await Promise.all([
            redisClient.setex(
                `session:${sessionId}`,
                7 * 24 * 60 * 60, // 7 days in seconds
                JSON.stringify(sessionData)
            ),
            redisClient.sadd(`user:${foundUser.id}:sessions`, sessionId)
        ]);

        // Create JWT token with sessionId included
        const tokenPayload = {
            userId: foundUser.id,
            username: foundUser.username,
            email: foundUser.email,
            role: foundUser.role,
            sessionId: sessionId, // IMPORTANT: Include sessionId for logout-all-devices tracking
            tokenType: 'access',
            jti: sessionId // JWT ID matches sessionId
        };
        
        const token = jwt.sign(tokenPayload, JWT_SECRET as Secret, {
            expiresIn: '15m', // Access token: 15 minutes
            issuer: 'kalibro-library',
            subject: String(foundUser.id)
        });

        // Set cookies for authentication
        cookies.set('token', token, {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60 // 15 minutes
        });
        
        cookies.set('refresh_token', refreshToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 // 7 days
        });

        // Log successful login (don't log password or sensitive data)
        console.log(`Successful login: ${foundUser.username} (${foundUser.role}) from ${clientIP}`);

        // Log security event
        await db.insert(securityLog).values({
            staffAccountId: foundUser.id,
            userId: null,
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
                message: 'An internal server error occurred. Please try again later.',
                error: error instanceof Error ? error.message : String(error) // <-- Add this line for debugging
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
                id: staffAccount.id, // changed from account
                name: staffAccount.name,
                username: staffAccount.username,
                email: staffAccount.email,
                role: staffAccount.role,
                isActive: staffAccount.isActive
            })
            .from(staffAccount) // changed from account
            .where(eq(staffAccount.id, decoded.userId)) // changed from account
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