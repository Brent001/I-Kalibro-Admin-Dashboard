import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/schema/schema.js'; // changed from account to user
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
        const [foundUser] = await db
            .select()
            .from(user)
            .where(eq(user.username, username))
            .limit(1);

        // If not found by username, try email
        let userByEmail = null;
        if (!foundUser) {
            [userByEmail] = await db
                .select()
                .from(user)
                .where(eq(user.email, username))
                .limit(1);
        }

        const actualUser = foundUser || userByEmail;

        // Always hash the provided password to prevent timing attacks
        const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks';
        const targetHash = actualUser?.password || dummyHash;

        // Verify password
        const isValidPassword = await bcrypt.compare(password, targetHash);

        // Check if user exists and password is correct and account is active
        if (!actualUser || !isValidPassword || !actualUser.isActive) {
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
            id: actualUser.id,
            username: actualUser.username,
            role: actualUser.role
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
            issuer: 'kalibro-library',
            subject: actualUser.id.toString()
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
        console.log(`Successful login: ${actualUser.username} (${actualUser.role}) from ${clientIP}`);

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
        const [foundUser] = await db
            .select({
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            })
            .from(user)
            .where(eq(user.id, decoded.id))
            .limit(1);

        if (!foundUser || !foundUser.isActive) {
            return new Response(
                JSON.stringify({ success: false, message: 'Invalid token' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: foundUser
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