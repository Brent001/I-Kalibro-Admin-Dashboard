// lib/server/auth.ts
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { db } from '$lib/server/db/index.js';
import { staffAccount, staffPermission } from '$lib/server/db/schema/schema.js'; // <-- updated import
import { eq, and, gte, desc } from 'drizzle-orm';
import { redisClient } from '$lib/server/db/cache.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

// Helper function to calculate time until next 3:00 AM (logout time)
function getTimeUntilNextLogout(): number {
    const now = new Date();
    const nextLogout = new Date(now);
    
    // Set to next 3:00 AM
    nextLogout.setHours(3, 0, 0, 0);
    
    // If 3:00 AM has already passed today, set to tomorrow's 3:00 AM
    if (nextLogout <= now) {
        nextLogout.setDate(nextLogout.getDate() + 1);
    }
    
    // Return milliseconds until that time
    return nextLogout.getTime() - now.getTime();
}

export interface AuthUser {
    id: number;
    name: string;
    username: string;
    email: string;
    role: 'admin' | 'staff';
    isActive: boolean;
    permissions?: string[]; // <-- add this line
}

export interface JWTPayload {
    userId: number;
    username: string;
    email: string;
    role: string;
    sessionId: string;
    tokenType: 'access' | 'refresh';
    iat: number;
    exp: number;
    iss: string;
    sub: string;
    jti: string;
}

export interface UserSession {
    id: string;
    userId: number;
    token?: string;
    refreshToken: string;
    userAgent: string;
    ipAddress: string;
    createdAt: Date;
    lastUsedAt: Date;
    expiresAt: Date;
    isActive: boolean;
}

export interface SecurityEvent {
    type: 'login' | 'logout' | 'logout_error' | 'token_refresh' | 'unauthorized_access' | 'suspicious_activity';
    userId: string | number;
    sessionId?: string;
    ip: string;
    userAgent: string;
    reason?: string;
    logoutAllDevices?: boolean;
    error?: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

/**
 * Verify JWT token and return user data
 */
export async function verifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<AuthUser | null> {
    try {
        const secret = tokenType === 'refresh' ? JWT_REFRESH_SECRET : JWT_SECRET;
        const decoded = jwt.verify(token, secret) as JWTPayload;
        
        // Check if token is blacklisted
        const blacklistKey = tokenType === 'refresh' ? `blacklist:refresh:${token}` : `blacklist:${token}`;
        const isBlacklisted = await redisClient.get(blacklistKey);
        if (isBlacklisted) {
            return null;
        }
        
        // Check if session has been revoked (logout from all devices)
        if (decoded.sessionId) {
            const revokedKey = `revoked:session:${decoded.sessionId}`;
            const isRevoked = await redisClient.get(revokedKey);
            if (isRevoked) {
                return null;
            }
            
            // Also check if session is still active
            const sessionData = await redisClient.get(`session:${decoded.sessionId}`);
            if (sessionData) {
                const session: UserSession = JSON.parse(sessionData);
                if (!session.isActive) {
                    return null;
                }
            }
        }
        
        // Verify token type matches
        if (decoded.tokenType !== tokenType) {
            return null;
        }
        
        // Fetch current user data from database
        const [user] = await db
            .select({
                id: staffAccount.id,
                name: staffAccount.name,
                username: staffAccount.username,
                email: staffAccount.email,
                role: staffAccount.role,
                isActive: staffAccount.isActive,
                uniqueId: staffAccount.uniqueId // <-- add this
            })
            .from(staffAccount)
            .where(eq(staffAccount.id, decoded.userId))
            .limit(1);

        if (!user || !user.isActive) {
            return null;
        }

        // Fetch permissions
        let permissions: string[] = [];
        if (user.uniqueId) {
            const [perm] = await db
                .select({ keys: staffPermission.permissionKeys })
                .from(staffPermission)
                .where(eq(staffPermission.staffUniqueId, user.uniqueId))
                .limit(1);
            if (perm && Array.isArray(perm.keys)) {
                permissions = perm.keys;
            }
        }

        // Update session last used time
        if (decoded.sessionId && tokenType === 'access') {
            await updateSessionLastUsed(decoded.sessionId);
        }

        return {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            permissions // <-- add this
        } as AuthUser;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

/**
 * Quick check if session is revoked (for API endpoints)
 * Decodes token without verification and checks revocation status
 */
export async function isSessionRevoked(token: string): Promise<boolean> {
    try {
        const decoded = jwt.decode(token) as JWTPayload | null;
        if (!decoded || !decoded.sessionId) {
            return false;
        }
        
        const sessionId = decoded.sessionId;
        
        // Quick check: look only for revocation marker (fastest path - usually returns immediately)
        // If revoked marker exists, session is definitely revoked
        const revokedKey = `revoked:session:${sessionId}`;
        const isRevoked = await redisClient.get(revokedKey);
        if (isRevoked) {
            return true;
        }
        
        // Only check session active status if revocation marker not found
        // This reduces Redis calls significantly (one check instead of two)
        const sessionData = await redisClient.get(`session:${sessionId}`);
        if (sessionData) {
            try {
                const session: UserSession = JSON.parse(sessionData);
                if (!session.isActive) {
                    return true;
                }
            } catch (parseError) {
                console.warn('Failed to parse session data:', parseError);
                return false;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Session revocation check failed:', error);
        return false;
    }
}

/**
 * Generate session ID
 */
function generateSessionId(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Generate token hash for storage
 */
function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate JWT token pair (access + refresh)
 */
export async function generateTokens(
    user: AuthUser, 
    sessionInfo: { userAgent: string; ipAddress: string }
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    // Fetch permissions if not present
    let permissions = user.permissions;
    if (!permissions) {
        // Fetch uniqueId
        const [staff] = await db
            .select({ uniqueId: staffAccount.uniqueId })
            .from(staffAccount)
            .where(eq(staffAccount.id, user.id))
            .limit(1);
        if (staff && staff.uniqueId) {
            const [perm] = await db
                .select({ keys: staffPermission.permissionKeys })
                .from(staffPermission)
                .where(eq(staffPermission.staffUniqueId, staff.uniqueId))
                .limit(1);
            if (perm && Array.isArray(perm.keys)) {
                permissions = perm.keys;
            }
        }
    }

    const sessionId = generateSessionId();
    const jti = randomBytes(16).toString('hex');
    const refreshJti = randomBytes(16).toString('hex');

    const basePayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        sessionId,
        iat: Math.floor(Date.now() / 1000),
        permissions // <-- add this
    };

    // Access token (short-lived)
    const accessToken = jwt.sign(
        { ...basePayload, tokenType: 'access', jti },
        JWT_SECRET,
        {
            expiresIn: '15m',
            issuer: 'kalibro-library',
            subject: user.id.toString()
        }
    );

    // Refresh token (long-lived)
    const refreshToken = jwt.sign(
        { ...basePayload, tokenType: 'refresh', jti: refreshJti },
        JWT_REFRESH_SECRET,
        {
            expiresIn: '30d', // Refresh token: 30 days (extended to handle auto-logout at 3am)
            issuer: 'kalibro-library',
            subject: user.id.toString()
        }
    );

    // Store session in Redis
    const timeUntilLogout = getTimeUntilNextLogout();
    const sessionData: UserSession = {
        id: sessionId,
        userId: user.id,
        token: hashToken(accessToken),
        refreshToken: hashToken(refreshToken),
        userAgent: sessionInfo.userAgent,
        ipAddress: sessionInfo.ipAddress,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + timeUntilLogout), // Auto-logout at next 3:00 AM
        isActive: true
    };

    await redisClient.setex(`session:${sessionId}`, Math.ceil(timeUntilLogout / 1000), JSON.stringify(sessionData));
    await redisClient.sadd(`user:${user.id}:sessions`, sessionId);

    return { accessToken, refreshToken, sessionId };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JWTPayload;
        
        // Check if refresh token is blacklisted
        const isBlacklisted = await redisClient.get(`blacklist:refresh:${refreshToken}`);
        if (isBlacklisted) {
            return null;
        }

        // Check if session has been revoked (logout from all devices)
        if (decoded.sessionId) {
            const revokedKey = `revoked:session:${decoded.sessionId}`;
            const isRevoked = await redisClient.get(revokedKey);
            if (isRevoked) {
                return null;
            }
        }

        // Verify session exists and is active
        const sessionData = await redisClient.get(`session:${decoded.sessionId}`);
        if (!sessionData) {
            return null;
        }

        const session: UserSession = JSON.parse(sessionData);
        if (!session.isActive || hashToken(refreshToken) !== session.refreshToken) {
            return null;
        }

        // Get fresh user data
        const [user] = await db
            .select({
                id: staffAccount.id, // <-- changed from account
                name: staffAccount.name,
                username: staffAccount.username,
                email: staffAccount.email,
                role: staffAccount.role,
                isActive: staffAccount.isActive
            })
            .from(staffAccount) // <-- changed from account
            .where(eq(staffAccount.id, decoded.userId)) // <-- changed from account
            .limit(1);

        if (!user || !user.isActive) {
            return null;
        }

        // Generate new access token
        const jti = randomBytes(16).toString('hex');
        const accessToken = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                sessionId: decoded.sessionId,
                tokenType: 'access',
                jti,
                iat: Math.floor(Date.now() / 1000),
            },
            JWT_SECRET,
            {
                expiresIn: '15m',
                issuer: 'kalibro-library',
                subject: user.id.toString()
            }
        );

        // Update session with new access token
        session.token = hashToken(accessToken);
        session.lastUsedAt = new Date();
        const timeUntilLogout = getTimeUntilNextLogout();
        session.expiresAt = new Date(Date.now() + timeUntilLogout);
        await redisClient.setex(`session:${decoded.sessionId}`, Math.ceil(timeUntilLogout / 1000), JSON.stringify(session));

        return { accessToken };
    } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
    }
}

/**
 * Update session last used timestamp
 */
export async function updateSessionLastUsed(sessionId: string): Promise<void> {
    try {
        const sessionData = await redisClient.get(`session:${sessionId}`);
        if (sessionData) {
            const session: UserSession = JSON.parse(sessionData);
            session.lastUsedAt = new Date();
            const timeUntilLogout = getTimeUntilNextLogout();
            session.expiresAt = new Date(Date.now() + timeUntilLogout);
            await redisClient.setex(`session:${sessionId}`, Math.ceil(timeUntilLogout / 1000), JSON.stringify(session));
        }
    } catch (error) {
        console.error('Failed to update session:', error);
    }
}

/**
 * Revoke a specific token/session
 */
export async function revokeToken(sessionId: string, tokenType: 'access' | 'refresh' = 'access'): Promise<void> {
    try {
        const sessionData = await redisClient.get(`session:${sessionId}`);
        if (sessionData) {
            const session: UserSession = JSON.parse(sessionData);
            
            if (tokenType === 'access') {
                // Mark session as inactive
                session.isActive = false;
                const timeUntilLogout = getTimeUntilNextLogout();
                await redisClient.setex(`session:${sessionId}`, Math.ceil(timeUntilLogout / 1000), JSON.stringify(session));
            } else {
                // Remove session completely for refresh token revocation
                await redisClient.del(`session:${sessionId}`);
                await redisClient.srem(`user:${session.userId}:sessions`, sessionId);
            }
        }
    } catch (error) {
        console.error('Token revocation failed:', error);
    }
}

/**
 * Get all active sessions for a user (optimized - fetch all in parallel)
 */
export async function getUserSessions(userId: number): Promise<UserSession[]> {
    try {
        // Get session IDs first
        const sessionIds = await redisClient.smembers(`user:${userId}:sessions`);
        
        if (sessionIds.length === 0) {
            return [];
        }
        
        // Fetch all sessions in parallel (not sequential)
        const sessionPromises = sessionIds.map(sessionId =>
            redisClient.get(`session:${sessionId}`)
        );
        
        const sessionDataArray = await Promise.all(sessionPromises);
        const sessions: UserSession[] = [];
        
        for (const sessionData of sessionDataArray) {
            if (sessionData) {
                try {
                    const session: UserSession = JSON.parse(sessionData);
                    if (session.isActive && session.expiresAt > new Date()) {
                        sessions.push(session);
                    }
                } catch (parseError) {
                    console.warn('Failed to parse session data:', parseError);
                }
            }
        }
        
        return sessions;
    } catch (error) {
        console.error('Failed to get user sessions:', error);
        return [];
    }
}

/**
 * Revoke all sessions for a user (optimized with batching)
 */
export async function revokeAllUserSessions(userId: number): Promise<void> {
    try {
        // Get all session IDs for this user
        const sessionIds = await redisClient.smembers(`user:${userId}:sessions`);
        
        if (sessionIds.length === 0) {
            return; // No sessions to revoke
        }

        // FAST PATH: Instead of fetching each session individually, just create revocation markers
        // This is much faster since we don't need the full session data
        const revocationOps: Promise<any>[] = [];
        
        // Create revocation markers for all sessions at once
        const timeUntilLogout = getTimeUntilNextLogout();
        for (const sessionId of sessionIds) {
            revocationOps.push(
                // Set revocation marker (only need to mark as revoked, not fetch/update full session)
                redisClient.setex(`revoked:session:${sessionId}`, Math.ceil(timeUntilLogout / 1000), 'revoked_all_devices')
            );
        }
        
        // Add the delete operation for the session set
        revocationOps.push(
            redisClient.del(`user:${userId}:sessions`)
        );
        
        // Execute all operations in parallel (much faster than sequential)
        await Promise.all(revocationOps);
        
        console.log(`User ${userId} revoked ${sessionIds.length} sessions`);
    } catch (error) {
        console.error('Failed to revoke all user sessions:', error);
        throw error;
    }
}

/**
 * Log security events
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
        const logEntry = {
            ...event,
            id: randomBytes(16).toString('hex'),
            timestamp: event.timestamp.toISOString()
        };
        
        // Store in Redis with TTL (30 days)
        await redisClient.setex(
            `security_log:${logEntry.id}`, 
            30 * 24 * 60 * 60, 
            JSON.stringify(logEntry)
        );
        
        // Add to user's security log index
        if (event.userId !== 'anonymous' && event.userId !== 'unknown') {
            await redisClient.lpush(`user:${event.userId}:security_log`, logEntry.id);
            await redisClient.ltrim(`user:${event.userId}:security_log`, 0, 100); // Keep last 100 events
        }
        
        // Console log for immediate monitoring
        console.log(`[SECURITY] ${event.type.toUpperCase()}:`, {
            userId: event.userId,
            ip: event.ip,
            userAgent: event.userAgent.substring(0, 100),
            timestamp: event.timestamp
        });
        
    } catch (error) {
        console.error('Failed to log security event:', error);
    }
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<void> {
    try {
        // This would typically be run as a cron job
        const pattern = 'session:*';
        const keys = await redisClient.keys(pattern);
        
        for (const key of keys) {
            const sessionData = await redisClient.get(key);
            if (sessionData) {
                const session: UserSession = JSON.parse(sessionData);
                if (session.expiresAt <= new Date()) {
                    const sessionId = key.replace('session:', '');
                    await redisClient.del(key);
                    await redisClient.srem(`user:${session.userId}:sessions`, sessionId);
                }
            }
        }
    } catch (error) {
        console.error('Session cleanup failed:', error);
    }
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(request: Request): string | null {
    // Try Authorization header first
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Try cookie as fallback
    const cookies = request.headers.get('Cookie');
    if (cookies) {
        const tokenMatch = cookies.match(/token=([^;]+)/);
        if (tokenMatch) {
            return tokenMatch[1];
        }
    }

    return null;
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthUser, requiredRole: 'admin' | 'staff'): boolean {
    if (requiredRole === 'admin') {
        return user.role === 'admin';
    }
    if (requiredRole === 'staff') {
        return user.role === 'admin' || user.role === 'staff';
    }
    return false;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
    if (user.role === 'admin') return true; // Admins have all permissions
    if (!user.permissions) return false;
    return user.permissions.includes(permission);
}

/**
 * Middleware-style authentication for SvelteKit
 */
export async function requireAuth(
    request: Request,
    requiredRole?: 'admin' | 'staff'
): Promise<{ user: AuthUser } | { error: Response }> {
    const token = extractToken(request);
    
    if (!token) {
        return {
            error: new Response(
                JSON.stringify({ success: false, message: 'Authentication required' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            )
        };
    }

    const user = await verifyToken(token);
    
    if (!user) {
        return {
            error: new Response(
                JSON.stringify({ success: false, message: 'Invalid or expired token' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            )
        };
    }

    if (requiredRole && !hasRole(user, requiredRole)) {
        return {
            error: new Response(
                JSON.stringify({ success: false, message: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            )
        };
    }

    return { user };
}

/**
 * Generate a new JWT token for user (legacy method - use generateTokens instead)
 */
export function generateToken(user: AuthUser): string {
    const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        sessionId: generateSessionId(),
        tokenType: 'access',
        jti: randomBytes(16).toString('hex'),
        iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '7d',
        issuer: 'kalibro-library',
        subject: user.id.toString()
    });
}