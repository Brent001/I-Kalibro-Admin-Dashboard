import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_user, tbl_security_log, tbl_staff_session, tbl_staff_permission } from '$lib/server/db/schema/schema.js';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt, { type Secret } from 'jsonwebtoken';
import { z } from 'zod';
import type { ZodIssue } from 'zod';
import { dev } from '$app/environment';
import { randomBytes } from 'crypto';
import { redisClient } from '$lib/server/db/cache.js';
import { generateTokens, logSecurityEvent, type AuthUser } from '$lib/server/db/auth.js';

// Environment variables - ensure these are set
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Input validation schema
const loginSchema = z.object({
    username: z.string()
        .min(1, 'Username is required')
        .trim(),
    password: z.string()
        .min(1, 'Password is required'),
    rememberMe: z.boolean().optional(),
    rememberMeToken: z.string().optional()
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

// Helper to find user across all tables (super_admin, admin, staff, user)
async function findUserByUsernameOrEmail(usernameOrEmail: string): Promise<{
    id: number;
    uniqueId: string;
    name: string;
    username: string;
    email: string;
    password: string;
    isActive: boolean;
    userType: 'super_admin' | 'admin' | 'staff' | 'user';
} | null> {
    // Try super_admin
    const [superAdmin] = await db
        .select()
        .from(tbl_super_admin)
        .where(or(eq(tbl_super_admin.username, usernameOrEmail), eq(tbl_super_admin.email, usernameOrEmail)))
        .limit(1);
    
    if (superAdmin && superAdmin.isActive) {
        return { id: superAdmin.id, uniqueId: superAdmin.uniqueId!, name: superAdmin.name, username: superAdmin.username, email: superAdmin.email, password: superAdmin.password, isActive: superAdmin.isActive || false, userType: 'super_admin' as const };
    }

    // Try admin
    const [admin] = await db
        .select()
        .from(tbl_admin)
        .where(or(eq(tbl_admin.username, usernameOrEmail), eq(tbl_admin.email, usernameOrEmail)))
        .limit(1);
    
    if (admin && admin.isActive) {
        return { id: admin.id, uniqueId: admin.uniqueId!, name: admin.name, username: admin.username, email: admin.email, password: admin.password, isActive: admin.isActive || false, userType: 'admin' as const };
    }

    // Try staff
    const [staff] = await db
        .select()
        .from(tbl_staff)
        .where(or(eq(tbl_staff.username, usernameOrEmail), eq(tbl_staff.email, usernameOrEmail)))
        .limit(1);
    
    if (staff && staff.isActive) {
        return { id: staff.id, uniqueId: staff.uniqueId!, name: staff.name, username: staff.username, email: staff.email, password: staff.password, isActive: staff.isActive || false, userType: 'staff' as const };
    }

    // Try user (student/faculty)
    const [user] = await db
        .select()
        .from(tbl_user)
        .where(or(eq(tbl_user.username, usernameOrEmail), eq(tbl_user.email, usernameOrEmail)))
        .limit(1);
    
    if (user && user.isActive && user.email) {
        return { id: user.id, uniqueId: user.uniqueId!, name: user.name, username: user.username, email: user.email || '', password: user.password, isActive: user.isActive || false, userType: 'user' as const };
    }

    return null;
}

// Helper to create AuthUser object with permissions
async function createAuthUser(foundUser: NonNullable<Awaited<ReturnType<typeof findUserByUsernameOrEmail>>>): Promise<AuthUser> {
    // Fetch permissions for admin/staff users
    let permissions: string[] = [];
    if (['admin', 'super_admin', 'staff'].includes(foundUser.userType) && foundUser.uniqueId) {
        const [perm] = await db.select({
            canManageBooks: tbl_staff_permission.canManageBooks,
            canManageUsers: tbl_staff_permission.canManageUsers,
            canManageBorrowing: tbl_staff_permission.canManageBorrowing,
            canManageReservations: tbl_staff_permission.canManageReservations,
            canViewReports: tbl_staff_permission.canViewReports,
            canManageFines: tbl_staff_permission.canManageFines,
        }).from(tbl_staff_permission).where(eq(tbl_staff_permission.staffUniqueId, foundUser.uniqueId)).limit(1);

        if (perm) {
            permissions = (Object.keys(perm) as (keyof typeof perm)[]).filter((k) => perm[k]);
        }
    }

    return {
        id: foundUser.id,
        name: foundUser.name,
        username: foundUser.username,
        email: foundUser.email,
        userType: foundUser.userType,
        isActive: foundUser.isActive,
        permissions
    };
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
    try {
        const clientIP = getClientAddress();
        const userAgent = request.headers.get('user-agent');
        const browserType = getBrowserType(userAgent);
        
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

        const { username, password, rememberMe, rememberMeToken } = validationResult.data;

        // Handle remember me token login
        if (rememberMeToken && !username && !password) {
            try {
                const decoded = jwt.verify(rememberMeToken, JWT_SECRET as Secret) as any;
                
                // Check if remember me token is blacklisted
                const blacklistKey = `blacklist:rememberme:${rememberMeToken}`;
                const isBlacklisted = await redisClient.get(blacklistKey);
                if (isBlacklisted) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            message: 'Remember me session has expired'
                        }),
                        { status: 401, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                
                // Find user across all tables
                const foundUser = await findUserByUsernameOrEmail(decoded.username);
                
                if (!foundUser || !foundUser.isActive) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            message: 'User not found or inactive'
                        }),
                        { status: 401, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                
                // Create AuthUser object
                const authUser = await createAuthUser(foundUser);
                
                // Generate tokens using centralized auth function
                const { accessToken, refreshToken, sessionId } = await generateTokens(authUser, {
                    userAgent: userAgent || '',
                    ipAddress: clientIP
                });
                
                // Set cookies
                cookies.set('token', accessToken, {
                    path: '/',
                    httpOnly: true,
                    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 15 * 60
                });
                
                cookies.set('refresh_token', refreshToken, {
                    path: '/',
                    httpOnly: true,
                    sameSite: 'strict',
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 30 * 24 * 60 * 60
                });
                
                console.log(`Remember me login: ${foundUser.username} (${foundUser.userType}) from ${clientIP}`);
                
                // Log security event
                await logSecurityEvent({
                    type: 'login',
                    userId: foundUser.id,
                    sessionId,
                    ip: clientIP,
                    userAgent: browserType,
                    reason: 'remember_me_login',
                    timestamp: new Date()
                });
                
                return new Response(
                    JSON.stringify({
                        success: true,
                        message: 'Remember me login successful'
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            } catch (error) {
                console.error('Remember me token validation failed:', error);
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: 'Remember me session expired. Please login again.'
                    }),
                    { status: 401, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        const { username: usernameValue, password: passwordValue } = validationResult.data;

        // Find user across all tables
        const foundUser = await findUserByUsernameOrEmail(usernameValue);

        // Always hash the provided password to prevent timing attacks
        const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks';
        const targetHash = foundUser?.password || dummyHash;

        // Verify password
        const isValidPassword = await bcrypt.compare(passwordValue, targetHash);

        // Check if user exists and password is correct and account is active
        if (!foundUser || !isValidPassword || !foundUser.isActive) {
            recordFailedAttempt(clientIP);

            // --- LOG FAILED LOGIN ATTEMPT ---
            await db.insert(tbl_security_log).values({
                userType: foundUser?.userType ?? 'user',
                userId: foundUser?.id ?? null,
                eventType: 'failed_login',
                ipAddress: clientIP,
                userAgent: browserType,
                timestamp: new Date()
            } as any);

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

        // Create AuthUser object
        const authUser = await createAuthUser(foundUser);
        
        // Generate tokens using centralized auth function
        const { accessToken, refreshToken, sessionId } = await generateTokens(authUser, {
            userAgent: userAgent || '',
            ipAddress: clientIP
        });

        // Set cookies for authentication
        cookies.set('token', accessToken, {
            path: '/',
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60
        });
        
        // Refresh token lifetime depends on "remember me" choice: 7 days when not remembered, 30 days when remembered
        const refreshMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
        cookies.set('refresh_token', refreshToken, {
            path: '/',
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: refreshMaxAge
        });

        // Log successful login (don't log password or sensitive data)
        console.log(`Successful login: ${foundUser.username} (${foundUser.userType}) from ${clientIP}`);

        // Log security event
        await logSecurityEvent({
            type: 'login',
            userId: foundUser.id,
            sessionId,
            ip: clientIP,
            userAgent: browserType,
            timestamp: new Date()
        });

        // Generate remember me token if checkbox is checked (30 days)
        let rememberMeTokenToReturn: string | undefined;
        if (rememberMe) {
            const rememberMePayload = {
                userId: foundUser.id,
                uniqueId: foundUser.uniqueId,
                username: foundUser.username,
                tokenType: 'remember_me',
                jti: randomBytes(16).toString('hex')
            };
            rememberMeTokenToReturn = jwt.sign(rememberMePayload, JWT_SECRET as Secret, {
                expiresIn: '30d',
                issuer: 'kalibro-library',
                subject: String(foundUser.id)
            });
        }

        // Return success response with user data (excluding password)
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Login successful',
                rememberMeToken: rememberMeTokenToReturn
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

        // Find user across all tables
        const foundUser = await findUserByUsernameOrEmail(decoded.username);

        if (!foundUser || !foundUser.isActive) {
            return new Response(
                JSON.stringify({ success: false, message: 'Invalid token' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: foundUser.id,
                    name: foundUser.name,
                    username: foundUser.username,
                    email: foundUser.email,
                    userType: foundUser.userType,
                    isActive: foundUser.isActive
                }
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