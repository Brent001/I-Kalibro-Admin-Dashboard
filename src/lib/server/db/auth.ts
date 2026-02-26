// lib/server/auth.ts
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_staff_permission, tbl_user, tbl_staff_session } from '$lib/server/db/schema/schema.js';
import { eq, and, gte, desc, or, lte } from 'drizzle-orm';
import { redisClient, isRedisConfigured } from '$lib/server/db/cache.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

// Determine session TTL (milliseconds).
// Use environment variable `SESSION_TTL_MS` (ms) to override. Default to 30 days.
function getTimeUntilNextLogout(): number {
    const env = process.env.SESSION_TTL_MS;
    if (env) {
        const parsed = parseInt(env, 10);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    // Default: 30 days
    return 30 * 24 * 60 * 60 * 1000;
}

export interface AuthUser {
    id: number;
    name: string;
    username: string;
    email: string;
    userType: string;
    isActive: boolean;
    permissions?: string[]; // <-- add this line
}

export interface JWTPayload {
    userId: number;
    username: string;
    email: string;
    userType: string;
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
        
        // Check session in DB (preferred over Redis). If sessionId present, ensure session exists,
        // is active, not expired, and token hash matches the stored hash.
        if (decoded.sessionId) {
            try {
                const [sessionRow] = await db
                    .select({
                        id: tbl_staff_session.id,
                        sessionId: tbl_staff_session.sessionId,
                        userId: tbl_staff_session.actorId,
                        tokenHash: tbl_staff_session.tokenHash,
                        refreshTokenHash: tbl_staff_session.refreshTokenHash,
                        userAgent: tbl_staff_session.userAgent,
                        ipAddress: tbl_staff_session.ipAddress,
                        createdAt: tbl_staff_session.createdAt,
                        lastUsedAt: tbl_staff_session.lastUsedAt,
                        expiresAt: tbl_staff_session.expiresAt,
                        isActive: tbl_staff_session.isActive
                    })
                    .from(tbl_staff_session)
                    .where(eq(tbl_staff_session.sessionId, decoded.sessionId))
                    .limit(1);

                if (!sessionRow) return null;

                // Check active flag and expiry
                if (!sessionRow.isActive) return null;
                if (sessionRow.expiresAt && new Date(sessionRow.expiresAt) <= new Date()) return null;

                // Validate token hash depending on token type
                const providedHash = hashToken(token);
                if (tokenType === 'access' && sessionRow.tokenHash && providedHash !== sessionRow.tokenHash) return null;
                if (tokenType === 'refresh' && sessionRow.refreshTokenHash && providedHash !== sessionRow.refreshTokenHash) return null;

            } catch (dbErr) {
                console.warn('DB session check failed, falling back to JWT-only verification:', dbErr);
            }
        }
        
        // Verify token type matches
        if (decoded.tokenType !== tokenType) {
            return null;
        }
        
        // Fetch current user data from database - check all user tables
        // First try to find in staff tables
        let user: any = null;
        let userType: string = '';

        // Check tbl_super_admin
        const [superAdmin] = await db
            .select({
                id: tbl_super_admin.id,
                name: tbl_super_admin.name,
                username: tbl_super_admin.username,
                email: tbl_super_admin.email,
                isActive: tbl_super_admin.isActive,
                uniqueId: tbl_super_admin.uniqueId
            })
            .from(tbl_super_admin)
            .where(eq(tbl_super_admin.id, decoded.userId))
            .limit(1);

        if (superAdmin) {
            user = superAdmin;
            userType = 'super_admin';
        }

        // If not found in super_admin, check tbl_admin
        if (!user) {
            const [admin] = await db
                .select({
                    id: tbl_admin.id,
                    name: tbl_admin.name,
                    username: tbl_admin.username,
                    email: tbl_admin.email,
                    isActive: tbl_admin.isActive,
                    uniqueId: tbl_admin.uniqueId
                })
                .from(tbl_admin)
                .where(eq(tbl_admin.id, decoded.userId))
                .limit(1);

            if (admin) {
                user = admin;
                userType = 'admin';
            }
        }

        // If not found in admin, check tbl_staff
        if (!user) {
            const [staff] = await db
                .select({
                    id: tbl_staff.id,
                    name: tbl_staff.name,
                    username: tbl_staff.username,
                    email: tbl_staff.email,
                    isActive: tbl_staff.isActive,
                    uniqueId: tbl_staff.uniqueId
                })
                .from(tbl_staff)
                .where(eq(tbl_staff.id, decoded.userId))
                .limit(1);

            if (staff) {
                user = staff;
                userType = 'staff';
            }
        }

        // If not found in staff, check tbl_user
        if (!user) {
            const [regularUser] = await db
                .select({
                    id: tbl_user.id,
                    name: tbl_user.name,
                    username: tbl_user.username,
                    email: tbl_user.email,
                    isActive: tbl_user.isActive,
                    uniqueId: tbl_user.uniqueId,
                    userType: tbl_user.userType
                })
                .from(tbl_user)
                .where(eq(tbl_user.id, decoded.userId))
                .limit(1);

            if (regularUser) {
                user = regularUser;
                userType = regularUser.userType || 'user';
            }
        }

        if (!user || !user.isActive) {
            return null;
        }

        // Fetch permissions (only for staff and admin)
        let permissions: string[] = [];
        if ((userType === 'admin' || userType === 'super_admin' || userType === 'staff') && user.uniqueId) {
            const [perm] = await db
                .select({ 
                    canManageBooks: tbl_staff_permission.canManageBooks,
                    canManageUsers: tbl_staff_permission.canManageUsers,
                    canManageBorrowing: tbl_staff_permission.canManageBorrowing,
                    canManageReservations: tbl_staff_permission.canManageReservations,
                    canViewReports: tbl_staff_permission.canViewReports,
                    canManageFines: tbl_staff_permission.canManageFines
                })
                .from(tbl_staff_permission)
                .where(eq(tbl_staff_permission.staffUniqueId, user.uniqueId))
                .limit(1);
            
            if (perm) {
                // Convert permission object to permission keys
                if (perm.canManageBooks) permissions.push('canManageBooks');
                if (perm.canManageUsers) permissions.push('canManageUsers');
                if (perm.canManageBorrowing) permissions.push('canManageBorrowing');
                if (perm.canManageReservations) permissions.push('canManageReservations');
                if (perm.canViewReports) permissions.push('canViewReports');
                if (perm.canManageFines) permissions.push('canManageFines');
            }
        }

        // Update session last used time in DB for access tokens
        if (decoded.sessionId && tokenType === 'access') {
            try {
                await updateSessionLastUsed(decoded.sessionId);
            } catch (e) {
                console.warn('Failed to update session last used time:', e);
            }
        }

        return {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            userType: userType,
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
        
        // Check session revocation status in DB
        try {
            const [sessionRow] = await db
                .select({ id: tbl_staff_session.id, isActive: tbl_staff_session.isActive, expiresAt: tbl_staff_session.expiresAt })
                .from(tbl_staff_session)
                .where(eq(tbl_staff_session.sessionId, sessionId))
                .limit(1);

            if (!sessionRow) return false;
            if (!sessionRow.isActive) return true;
            if (sessionRow.expiresAt && new Date(sessionRow.expiresAt) <= new Date()) return true;
            return false;
        } catch (err) {
            console.warn('Session revocation DB check failed, falling back to Redis/JWT checks:', (err as any)?.message || err);

            // Fallback to Redis markers if configured
            if (isRedisConfigured()) {
                try {
                    const revokedKey = `revoked:session:${sessionId}`;
                    const isRevoked = await redisClient.get(revokedKey);
                    if (isRevoked) return true;

                    const sessionData = await redisClient.get(`session:${sessionId}`);
                    if (sessionData) {
                        try {
                            const session: any = JSON.parse(sessionData);
                            if (!session.isActive) return true;
                            if (session.expiresAt && new Date(session.expiresAt) <= new Date()) return true;
                        } catch (parseErr) {
                            console.warn('Failed to parse cached session during fallback check:', (parseErr as any)?.message || parseErr);
                        }
                    }
                } catch (cacheErr) {
                    console.warn('Redis fallback for session revocation failed:', (cacheErr as any)?.message || cacheErr);
                }
            }

            return false;
        }
    } catch (error) {
        console.warn('Session revocation check failed:', (error as any)?.message || error);
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
    if (!permissions && user.userType !== 'user') {
        // Fetch permissions only for staff/admin/super_admin users
        // Since we already have user data, we can just pass empty permissions for now
        permissions = [];
    }

    const sessionId = generateSessionId();
    const jti = randomBytes(16).toString('hex');
    const refreshJti = randomBytes(16).toString('hex');

    const basePayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        userType: user.userType,
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

    // Store session in Redis if available. If Redis is not configured, skip storing
    // session metadata and rely on stateless JWT verification + refresh tokens.
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

    // Persist session to DB (preferred). Also optionally write to Redis as cache.
    try {
        const [created] = await db.insert(tbl_staff_session).values({
            sessionId: sessionData.id,
            actorType: user.userType || 'staff',
            actorId: sessionData.userId,
            tokenHash: sessionData.token,
            refreshTokenHash: sessionData.refreshToken,
            userAgent: sessionData.userAgent,
            ipAddress: sessionData.ipAddress,
            createdAt: sessionData.createdAt,
            lastUsedAt: sessionData.lastUsedAt,
            expiresAt: sessionData.expiresAt,
            isActive: sessionData.isActive
        }).returning();

        // Optional: keep Redis in sync as cache if configured
        if (isRedisConfigured()) {
            try {
                await redisClient.setex(`session:${sessionId}`, Math.ceil(timeUntilLogout / 1000), JSON.stringify(sessionData));
                await redisClient.sadd(`user:${user.id}:sessions`, sessionId);
            } catch (cacheErr) {
                console.warn('Failed to persist session to Redis (cache), continuing:', cacheErr);
            }
        }
    } catch (dbErr) {
        console.warn('Failed to persist session to DB, continuing without persistent session:', dbErr);
    }

    return { accessToken, refreshToken, sessionId };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JWTPayload;
        // If Redis is configured, enforce blacklist/session checks. If not,
        // fall back to JWT-only verification (trusted refresh token).
        let session: UserSession | null = null;
            // Prefer DB check for session and refresh token validity
            try {
                // Optional: check blacklist in Redis first for fast path
                if (isRedisConfigured()) {
                    const isBlacklisted = await redisClient.get(`blacklist:refresh:${refreshToken}`);
                    if (isBlacklisted === 'revoked' || isBlacklisted) return null;
                }

                if (decoded.sessionId) {
                    const [sessionRow] = await db
                        .select({ sessionId: tbl_staff_session.sessionId, userId: tbl_staff_session.actorId, refreshTokenHash: tbl_staff_session.refreshTokenHash, isActive: tbl_staff_session.isActive, expiresAt: tbl_staff_session.expiresAt })
                        .from(tbl_staff_session)
                        .where(eq(tbl_staff_session.sessionId, decoded.sessionId))
                        .limit(1);

                    if (!sessionRow) return null;
                    if (!sessionRow.isActive) return null;
                    if (sessionRow.expiresAt && new Date(sessionRow.expiresAt) <= new Date()) return null;
                    if (hashToken(refreshToken) !== sessionRow.refreshTokenHash) return null;

                    session = {
                        id: sessionRow.sessionId,
                        userId: sessionRow.userId,
                        refreshToken: sessionRow.refreshTokenHash,
                        userAgent: '',
                        ipAddress: '',
                        createdAt: new Date(),
                        lastUsedAt: new Date(),
                        expiresAt: sessionRow.expiresAt ? new Date(sessionRow.expiresAt) : new Date(),
                        isActive: sessionRow.isActive
                    } as UserSession;
                }
            } catch (err) {
                console.warn('Session refresh DB check failed, aborting refresh for safety:', err);
                return null;
            }

        // Get fresh user data from JWT (we can trust the decoded token for user type)
        // The user type is already in the decoded JWT token
        let user: any = null;
        let userType = decoded.userType || 'user';

        // We trust the JWT payload for user type information
        // No need to query database again for verification since token is already verified
        const baseUserData = {
            id: decoded.userId,
            username: decoded.username,
            email: decoded.email,
            isActive: true,
            userType: userType
        };

        user = baseUserData;

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
                userType: user.userType,
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

        // Update session in DB with new access token hash
        try {
            const timeUntilLogout = getTimeUntilNextLogout();
            await db.update(tbl_staff_session).set({
                tokenHash: hashToken(accessToken),
                lastUsedAt: new Date(),
                expiresAt: new Date(Date.now() + timeUntilLogout)
            }).where(eq(tbl_staff_session.sessionId, decoded.sessionId));

            // Sync cache optionally
            if (isRedisConfigured()) {
                try {
                    // refresh cached session if present
                    const sessionData = await redisClient.get(`session:${decoded.sessionId}`);
                    if (sessionData) {
                        const s = JSON.parse(sessionData);
                        s.token = hashToken(accessToken);
                        s.lastUsedAt = new Date();
                        s.expiresAt = new Date(Date.now() + timeUntilLogout);
                        await redisClient.setex(`session:${decoded.sessionId}`, Math.ceil(timeUntilLogout / 1000), JSON.stringify(s));
                    }
                } catch (cacheErr) {
                    console.warn('Failed to sync session cache during refresh:', cacheErr);
                }
            }
        } catch (err) {
            console.warn('Failed to update session in DB during refresh:', err);
        }

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
        const timeUntilLogout = getTimeUntilNextLogout();
        await db.update(tbl_staff_session).set({ lastUsedAt: new Date(), expiresAt: new Date(Date.now() + timeUntilLogout) }).where(eq(tbl_staff_session.sessionId, sessionId));
        // update cache if present
        if (isRedisConfigured()) {
            try {
                const sessionData = await redisClient.get(`session:${sessionId}`);
                if (sessionData) {
                    const session: any = JSON.parse(sessionData);
                    session.lastUsedAt = new Date();
                    session.expiresAt = new Date(Date.now() + timeUntilLogout);
                    await redisClient.setex(`session:${sessionId}`, Math.ceil(timeUntilLogout / 1000), JSON.stringify(session));
                }
            } catch (cacheErr) {
                console.warn('Failed to update session cache lastUsedAt:', cacheErr);
            }
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
        if (tokenType === 'access') {
            // mark session inactive in DB
            await db.update(tbl_staff_session).set({ isActive: false }).where(eq(tbl_staff_session.sessionId, sessionId));
            // sync cache
            if (isRedisConfigured()) {
                try {
                    const sessionData = await redisClient.get(`session:${sessionId}`);
                    if (sessionData) {
                        const session: any = JSON.parse(sessionData);
                        session.isActive = false;
                        const timeUntilLogout = getTimeUntilNextLogout();
                        await redisClient.setex(`session:${sessionId}`, Math.ceil(timeUntilLogout / 1000), JSON.stringify(session));
                    }
                } catch (cacheErr) {
                    console.warn('Failed to sync cache on revoke access:', cacheErr);
                }
            }
        } else {
            // Remove session completely for refresh token revocation
            const [deleted] = await db.delete(tbl_staff_session).where(eq(tbl_staff_session.sessionId, sessionId)).returning();
            if (isRedisConfigured()) {
                try {
                    await redisClient.del(`session:${sessionId}`);
                    if (deleted && (deleted as any).actorId) await redisClient.srem(`user:${(deleted as any).actorId}:sessions`, sessionId);
                } catch (cacheErr) {
                    console.warn('Failed to remove session from cache on revoke refresh:', cacheErr);
                }
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
        // Query DB for active, non-expired sessions
        const rows = await db.select({
            sessionId: tbl_staff_session.sessionId,
            userId: tbl_staff_session.actorId,
            tokenHash: tbl_staff_session.tokenHash,
            refreshTokenHash: tbl_staff_session.refreshTokenHash,
            userAgent: tbl_staff_session.userAgent,
            ipAddress: tbl_staff_session.ipAddress,
            createdAt: tbl_staff_session.createdAt,
            lastUsedAt: tbl_staff_session.lastUsedAt,
            expiresAt: tbl_staff_session.expiresAt,
            isActive: tbl_staff_session.isActive
        }).from(tbl_staff_session).where(and(eq(tbl_staff_session.actorId, userId), eq(tbl_staff_session.isActive, true), gte(tbl_staff_session.expiresAt, new Date())));

        const sessions: UserSession[] = rows.map(r => ({
            id: r.sessionId,
            userId: (r as any).userId ?? (r as any).actorId,
            token: r.tokenHash,
            refreshToken: r.refreshTokenHash,
            userAgent: r.userAgent,
            ipAddress: r.ipAddress,
            createdAt: r.createdAt ? new Date(r.createdAt as unknown as string | number | Date) : new Date(),
            lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt as unknown as string | number | Date) : new Date(),
            expiresAt: r.expiresAt ? new Date(r.expiresAt as unknown as string | number | Date) : new Date(),
            isActive: r.isActive
        } as UserSession));

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
        // Mark all sessions for this user as inactive in DB
        const [updated] = await db.update(tbl_staff_session).set({ isActive: false }).where(eq(tbl_staff_session.actorId, userId)).returning();

        // Remove from Redis cache if configured
        if (isRedisConfigured()) {
            try {
                const sessionIds = await redisClient.smembers(`user:${userId}:sessions`);
                const ops: Promise<any>[] = [];
                for (const sid of sessionIds) {
                    ops.push(redisClient.del(`session:${sid}`));
                    ops.push(redisClient.setex(`revoked:session:${sid}`, Math.ceil(getTimeUntilNextLogout() / 1000), 'revoked_all_devices'));
                }
                ops.push(redisClient.del(`user:${userId}:sessions`));
                await Promise.all(ops);
            } catch (cacheErr) {
                console.warn('Failed to clear session cache during revokeAllUserSessions:', cacheErr);
            }
        }

        console.log(`User ${userId} revoked sessions (DB updated)`);
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
        // This would typically be run as a cron job: remove expired sessions from DB and cache
        const now = new Date();
        // Delete expired sessions from DB
        await db.delete(tbl_staff_session).where(lte(tbl_staff_session.expiresAt, now));

        // Also try to clean up cache entries
        if (isRedisConfigured()) {
            try {
                const pattern = 'session:*';
                const keys = await redisClient.keys(pattern);
                for (const key of keys) {
                    const sessionData = await redisClient.get(key);
                    if (sessionData) {
                        const session: any = JSON.parse(sessionData);
                        if (session.expiresAt && new Date(session.expiresAt) <= now) {
                            const sessionId = key.replace('session:', '');
                            await redisClient.del(key);
                            await redisClient.srem(`user:${session.userId}:sessions`, sessionId);
                        }
                    }
                }
            } catch (cacheErr) {
                console.warn('Failed to clean expired sessions from cache:', cacheErr);
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
        return user.userType === 'admin' || user.userType === 'super_admin';
    }
    if (requiredRole === 'staff') {
        return user.userType === 'admin' || user.userType === 'super_admin' || user.userType === 'staff';
    }
    return false;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
    if (user.userType === 'admin' || user.userType === 'super_admin') return true; // Admins/super_admins have all permissions
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
        userType: user.userType,
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