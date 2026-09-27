// lib/server/auth.ts
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_staff_permission, tbl_user, tbl_staff_session } from '$lib/server/db/schema/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { redisClient, isRedisConfigured } from '$lib/server/db/cache.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long a session lives (ms). Override with SESSION_TTL_MS env var. Default: 30 days. */
const SESSION_TTL_MS: number = (() => {
    const env = process.env.SESSION_TTL_MS;
    if (env) {
        const parsed = parseInt(env, 10);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return 30 * 24 * 60 * 60 * 1000; // 30 days
})();

/**
 * How often (ms) we bother writing lastUsedAt back to the DB.
 * Avoids a DB write on every single API request. Default: 5 minutes.
 */
const SESSION_TOUCH_INTERVAL_MS: number = (() => {
    const env = process.env.SESSION_TOUCH_INTERVAL_MS;
    if (env) {
        const parsed = parseInt(env, 10);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return 5 * 60 * 1000; // 5 minutes
})();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
    id: number;
    name: string;
    username: string;
    email: string;
    userType: string;
    isActive: boolean;
    permissions?: string[];
}

export interface JWTPayload {
    userId: number;
    username: string;
    email: string;
    userType: string;
    sessionId: string;
    tokenType: 'access' | 'refresh';
    permissions?: string[];
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId(): string {
    return randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

/**
 * Safe Redis get — returns null instead of throwing if Redis is down or key missing.
 */
async function safeRedisGet(key: string): Promise<string | null> {
    if (!isRedisConfigured()) return null;
    try {
        return await redisClient.get(key);
    } catch {
        return null;
    }
}

/**
 * Safe Redis set — silently ignores failures so Redis is always best-effort cache.
 */
async function safeRedisSetex(key: string, ttlSeconds: number, value: string): Promise<void> {
    if (!isRedisConfigured()) return;
    try {
        await redisClient.setex(key, ttlSeconds, value);
    } catch (err) {
        console.warn(`[auth] Redis setex failed for key "${key}":`, (err as any)?.message);
    }
}

async function safeRedisDel(key: string): Promise<void> {
    if (!isRedisConfigured()) return;
    try {
        await redisClient.del(key);
    } catch (err) {
        console.warn(`[auth] Redis del failed for key "${key}":`, (err as any)?.message);
    }
}

// ─── Core: DB session lookup ───────────────────────────────────────────────────

/**
 * Look up a session row from the DB.
 * Returns null if not found, inactive, or expired.
 */
async function getActiveDbSession(sessionId: string) {
    const [row] = await db
        .select({
            sessionId: tbl_staff_session.sessionId,
            actorId: tbl_staff_session.actorId,
            tokenHash: tbl_staff_session.tokenHash,
            refreshTokenHash: tbl_staff_session.refreshTokenHash,
            userAgent: tbl_staff_session.userAgent,
            ipAddress: tbl_staff_session.ipAddress,
            createdAt: tbl_staff_session.createdAt,
            lastUsedAt: tbl_staff_session.lastUsedAt,
            expiresAt: tbl_staff_session.expiresAt,
            isActive: tbl_staff_session.isActive,
        })
        .from(tbl_staff_session)
        .where(eq(tbl_staff_session.sessionId, sessionId))
        .limit(1);

    if (!row) return null;
    if (!row.isActive) return null;
    if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return null;

    return row;
}

// ─── verifyToken ──────────────────────────────────────────────────────────────

/**
 * Verify JWT token and return user data.
 *
 * FIX: Previously the function could fall through and return a user even when
 * the DB session check failed (wrong hash / inactive). Now any DB session
 * mismatch returns null immediately.
 */
export async function verifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<AuthUser | null> {
    try {
        const secret = tokenType === 'refresh' ? JWT_REFRESH_SECRET : JWT_SECRET;
        let decoded: JWTPayload;
        try {
            decoded = jwt.verify(token, secret) as JWTPayload;
        } catch (jwtErr) {
            // Token is invalid or expired — not a crash-worthy event
            return null;
        }

        // Verify declared token type matches the intended use
        if (decoded.tokenType !== tokenType) return null;

        // ── DB session validation (source of truth) ──────────────────────────
        if (decoded.sessionId) {
            let sessionRow: Awaited<ReturnType<typeof getActiveDbSession>>;
            try {
                sessionRow = await getActiveDbSession(decoded.sessionId);
            } catch (dbErr) {
                // DB is unreachable — fail closed to prevent ghost sessions
                console.error('[auth] DB session lookup failed, rejecting token:', (dbErr as any)?.message);
                return null;
            }

            if (!sessionRow) return null; // missing, inactive, or expired

            // Validate the token hash so a stolen-then-rotated token can't be reused
            const providedHash = hashToken(token);
            if (tokenType === 'access' && sessionRow.tokenHash && providedHash !== sessionRow.tokenHash) {
                console.warn(`[auth] Access token hash mismatch for session ${decoded.sessionId}`);
                return null;
            }
            if (tokenType === 'refresh' && sessionRow.refreshTokenHash && providedHash !== sessionRow.refreshTokenHash) {
                console.warn(`[auth] Refresh token hash mismatch for session ${decoded.sessionId}`);
                return null;
            }
        }

        // ── Fetch live user data from DB ──────────────────────────────────────
        const { user, userType } = await fetchUser(decoded.userId, decoded.userType);
        if (!user || !user.isActive) return null;

        // ── Fetch permissions ─────────────────────────────────────────────────
        const permissions = await fetchPermissions(userType, user.uniqueId);

        // ── Touch session (rate-limited to avoid per-request DB writes) ────────
        if (decoded.sessionId && tokenType === 'access') {
            touchSessionThrottled(decoded.sessionId).catch((e) =>
                console.warn('[auth] touchSession failed silently:', e?.message)
            );
        }

        return {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            userType,
            isActive: user.isActive,
            permissions,
        };
    } catch (error) {
        console.error('[auth] verifyToken unexpected error:', error);
        return null;
    }
}

// ─── isSessionRevoked ─────────────────────────────────────────────────────────

/**
 * Quick revocation check for lightweight API endpoints.
 * DB is the source of truth; Redis is a fast-path fallback only.
 */
export async function isSessionRevoked(token: string): Promise<boolean> {
    try {
        const decoded = jwt.decode(token) as JWTPayload | null;
        if (!decoded?.sessionId) return false;

        const { sessionId } = decoded;

        try {
            const row = await getActiveDbSession(sessionId);
            // If getActiveDbSession returns null the session is expired/inactive/missing → revoked
            return row === null;
        } catch (dbErr) {
            console.warn('[auth] DB revocation check failed, trying Redis fallback:', (dbErr as any)?.message);

            // Redis fallback (best-effort, never trust if Redis says "not revoked" since it may be stale)
            const revokedFlag = await safeRedisGet(`revoked:session:${sessionId}`);
            if (revokedFlag) return true;

            const sessionData = await safeRedisGet(`session:${sessionId}`);
            if (sessionData) {
                try {
                    const session: any = JSON.parse(sessionData);
                    if (!session.isActive) return true;
                    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) return true;
                } catch {
                    // corrupt cache entry — assume revoked for safety
                    return true;
                }
            }

            // Can't confirm either way — fail open (degraded mode) so users aren't mass-logged-out
            // during a DB outage. Adjust to `return true` if you prefer fail-closed.
            return false;
        }
    } catch (error) {
        console.warn('[auth] isSessionRevoked unexpected error:', (error as any)?.message);
        return false;
    }
}

// ─── generateTokens ───────────────────────────────────────────────────────────

export async function generateTokens(
    user: AuthUser,
    sessionInfo: { userAgent: string; ipAddress: string }
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    const sessionId = generateSessionId();
    const jti = randomBytes(16).toString('hex');
    const refreshJti = randomBytes(16).toString('hex');
    const permissions = user.permissions ?? [];

    const basePayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        sessionId,
        permissions,
        iat: Math.floor(Date.now() / 1000),
    };

    const accessToken = jwt.sign(
        { ...basePayload, tokenType: 'access', jti },
        JWT_SECRET,
        { expiresIn: '15m', issuer: 'kalibro-library', subject: user.id.toString() }
    );

    const refreshToken = jwt.sign(
        { ...basePayload, tokenType: 'refresh', jti: refreshJti },
        JWT_REFRESH_SECRET,
        { expiresIn: '30d', issuer: 'kalibro-library', subject: user.id.toString() }
    );

    const now = new Date();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    // ── Persist to DB ─────────────────────────────────────────────────────────
    try {
        await db.insert(tbl_staff_session).values({
            sessionId,
            actorType: user.userType || 'staff',
            actorId: user.id,
            tokenHash: hashToken(accessToken),
            refreshTokenHash: hashToken(refreshToken),
            userAgent: sessionInfo.userAgent,
            ipAddress: sessionInfo.ipAddress,
            createdAt: now,
            lastUsedAt: now,
            expiresAt,
            isActive: true,
        });
    } catch (dbErr) {
        // If we can't persist the session the tokens would always fail verification.
        // Throw so the caller (login endpoint) can return a 500 instead of issuing bad tokens.
        console.error('[auth] Failed to persist new session to DB:', dbErr);
        throw new Error('Session creation failed');
    }

    // ── Optional Redis cache ──────────────────────────────────────────────────
    const ttlSeconds = Math.ceil(SESSION_TTL_MS / 1000);
    const sessionCache = JSON.stringify({
        id: sessionId,
        userId: user.id,
        token: hashToken(accessToken),
        refreshToken: hashToken(refreshToken),
        userAgent: sessionInfo.userAgent,
        ipAddress: sessionInfo.ipAddress,
        createdAt: now,
        lastUsedAt: now,
        expiresAt,
        isActive: true,
    });
    await safeRedisSetex(`session:${sessionId}`, ttlSeconds, sessionCache);
    if (isRedisConfigured()) {
        try { await redisClient.sadd(`user:${user.id}:sessions`, sessionId); } catch { /* ignore */ }
    }

    return { accessToken, refreshToken, sessionId };
}

// ─── refreshAccessToken ───────────────────────────────────────────────────────

/**
 * Rotate access token using a valid refresh token.
 *
 * FIX: Previously trusted the JWT payload for user data without a live DB check.
 * Now fetches the user from DB to ensure the account is still active.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
        let decoded: JWTPayload;
        try {
            decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JWTPayload;
        } catch {
            return null;
        }

        if (decoded.tokenType !== 'refresh') return null;

        // ── Optional Redis blacklist fast-path ────────────────────────────────
        const blacklisted = await safeRedisGet(`blacklist:refresh:${hashToken(refreshToken)}`);
        if (blacklisted) return null;

        // ── DB session validation ─────────────────────────────────────────────
        if (!decoded.sessionId) return null;

        let sessionRow: Awaited<ReturnType<typeof getActiveDbSession>>;
        try {
            sessionRow = await getActiveDbSession(decoded.sessionId);
        } catch (dbErr) {
            console.error('[auth] DB lookup failed during token refresh:', (dbErr as any)?.message);
            return null;
        }

        if (!sessionRow) return null;
        if (hashToken(refreshToken) !== sessionRow.refreshTokenHash) {
            console.warn(`[auth] Refresh token hash mismatch for session ${decoded.sessionId}`);
            return null;
        }

        // ── Validate user is still active in DB ───────────────────────────────
        const { user, userType } = await fetchUser(decoded.userId, decoded.userType);
        if (!user || !user.isActive) return null;

        // ── Issue new access token ────────────────────────────────────────────
        const jti = randomBytes(16).toString('hex');
        const permissions = await fetchPermissions(userType, user.uniqueId);
        const accessToken = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                email: user.email,
                userType,
                sessionId: decoded.sessionId,
                tokenType: 'access',
                permissions,
                jti,
                iat: Math.floor(Date.now() / 1000),
            },
            JWT_SECRET,
            { expiresIn: '15m', issuer: 'kalibro-library', subject: user.id.toString() }
        );

        // ── Update session row ────────────────────────────────────────────────
        const newExpiry = new Date(Date.now() + SESSION_TTL_MS);
        try {
            await db.update(tbl_staff_session).set({
                tokenHash: hashToken(accessToken),
                lastUsedAt: new Date(),
                expiresAt: newExpiry,
            }).where(eq(tbl_staff_session.sessionId, decoded.sessionId));
        } catch (dbErr) {
            console.warn('[auth] Failed to update session during token refresh (non-fatal):', (dbErr as any)?.message);
        }

        // ── Sync Redis cache ──────────────────────────────────────────────────
        const cached = await safeRedisGet(`session:${decoded.sessionId}`);
        if (cached) {
            try {
                const s = JSON.parse(cached);
                s.token = hashToken(accessToken);
                s.lastUsedAt = new Date();
                s.expiresAt = newExpiry;
                await safeRedisSetex(`session:${decoded.sessionId}`, Math.ceil(SESSION_TTL_MS / 1000), JSON.stringify(s));
            } catch { /* stale cache, ignore */ }
        }

        return { accessToken };
    } catch (error) {
        console.error('[auth] refreshAccessToken unexpected error:', error);
        return null;
    }
}

// ─── updateSessionLastUsed (throttled) ────────────────────────────────────────

/**
 * In-process map to track the last time each session was touched.
 * Prevents a DB write on every single authenticated request.
 *
 * NOTE: This map lives in a single Node.js process. If you run multiple
 * instances (e.g. with a cluster or separate pods), each instance keeps its
 * own map, meaning a session may be touched slightly more often than the
 * interval across the fleet — but never more than once per interval per pod,
 * which is still a big improvement.
 */
const sessionLastTouched = new Map<string, number>();

async function touchSessionThrottled(sessionId: string): Promise<void> {
    const now = Date.now();
    const last = sessionLastTouched.get(sessionId) ?? 0;
    if (now - last < SESSION_TOUCH_INTERVAL_MS) return; // skip — touched recently
    sessionLastTouched.set(sessionId, now);
    await updateSessionLastUsed(sessionId);
}

export async function updateSessionLastUsed(sessionId: string): Promise<void> {
    const newExpiry = new Date(Date.now() + SESSION_TTL_MS);
    try {
        await db.update(tbl_staff_session).set({
            lastUsedAt: new Date(),
            expiresAt: newExpiry,
        }).where(eq(tbl_staff_session.sessionId, sessionId));
    } catch (error) {
        console.error('[auth] Failed to update session lastUsedAt:', error);
        return; // don't propagate — let the request succeed
    }

    const cached = await safeRedisGet(`session:${sessionId}`);
    if (cached) {
        try {
            const session: any = JSON.parse(cached);
            session.lastUsedAt = new Date();
            session.expiresAt = newExpiry;
            await safeRedisSetex(`session:${sessionId}`, Math.ceil(SESSION_TTL_MS / 1000), JSON.stringify(session));
        } catch { /* stale / corrupt cache, ignore */ }
    }
}

// ─── revokeToken ──────────────────────────────────────────────────────────────

export async function revokeToken(sessionId: string, tokenType: 'access' | 'refresh' = 'access'): Promise<void> {
    try {
        if (tokenType === 'access') {
            await db.update(tbl_staff_session)
                .set({ isActive: false })
                .where(eq(tbl_staff_session.sessionId, sessionId));

            const cached = await safeRedisGet(`session:${sessionId}`);
            if (cached) {
                try {
                    const session: any = JSON.parse(cached);
                    session.isActive = false;
                    await safeRedisSetex(`session:${sessionId}`, Math.ceil(SESSION_TTL_MS / 1000), JSON.stringify(session));
                } catch { /* ignore */ }
            }
        } else {
            const [deleted] = await db.delete(tbl_staff_session)
                .where(eq(tbl_staff_session.sessionId, sessionId))
                .returning();

            await safeRedisDel(`session:${sessionId}`);
            if (deleted && (deleted as any).actorId && isRedisConfigured()) {
                try { await redisClient.srem(`user:${(deleted as any).actorId}:sessions`, sessionId); } catch { /* ignore */ }
            }
        }

        // Evict throttle-map entry so a re-created session isn't skipped
        sessionLastTouched.delete(sessionId);
    } catch (error) {
        console.error('[auth] revokeToken failed:', error);
        throw error; // callers (logout endpoint) should know revocation failed
    }
}

// ─── getUserSessions ──────────────────────────────────────────────────────────

export async function getUserSessions(userId: number): Promise<UserSession[]> {
    try {
        const rows = await db.select({
            sessionId: tbl_staff_session.sessionId,
            actorId: tbl_staff_session.actorId,
            tokenHash: tbl_staff_session.tokenHash,
            refreshTokenHash: tbl_staff_session.refreshTokenHash,
            userAgent: tbl_staff_session.userAgent,
            ipAddress: tbl_staff_session.ipAddress,
            createdAt: tbl_staff_session.createdAt,
            lastUsedAt: tbl_staff_session.lastUsedAt,
            expiresAt: tbl_staff_session.expiresAt,
            isActive: tbl_staff_session.isActive,
        })
            .from(tbl_staff_session)
            .where(and(
                eq(tbl_staff_session.actorId, userId),
                eq(tbl_staff_session.isActive, true),
                gte(tbl_staff_session.expiresAt, new Date()),
            ));

        return rows.map((r): UserSession => ({
            id: r.sessionId,
            userId: r.actorId,
            token: r.tokenHash ?? undefined,
            refreshToken: r.refreshTokenHash ?? '',
            userAgent: r.userAgent ?? '',
            ipAddress: r.ipAddress ?? '',
            createdAt: r.createdAt ? new Date(r.createdAt as any) : new Date(),
            lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt as any) : new Date(),
            expiresAt: r.expiresAt ? new Date(r.expiresAt as any) : new Date(),
            isActive: r.isActive ?? false,
        }));
    } catch (error) {
        console.error('[auth] getUserSessions failed:', error);
        return [];
    }
}

// ─── revokeAllUserSessions ────────────────────────────────────────────────────

export async function revokeAllUserSessions(userId: number): Promise<void> {
    try {
        await db.update(tbl_staff_session)
            .set({ isActive: false })
            .where(eq(tbl_staff_session.actorId, userId));

        if (isRedisConfigured()) {
            try {
                const sessionIds = await redisClient.smembers(`user:${userId}:sessions`);
                const ops: Promise<any>[] = [];
                for (const sid of sessionIds) {
                    ops.push(safeRedisDel(`session:${sid}`));
                    ops.push(safeRedisSetex(`revoked:session:${sid}`, Math.ceil(SESSION_TTL_MS / 1000), 'revoked_all_devices'));
                    sessionLastTouched.delete(sid);
                }
                ops.push(safeRedisDel(`user:${userId}:sessions`));
                await Promise.all(ops);
            } catch (cacheErr) {
                console.warn('[auth] Failed to clear Redis during revokeAllUserSessions:', (cacheErr as any)?.message);
            }
        }

        console.log(`[auth] All sessions revoked for user ${userId}`);
    } catch (error) {
        console.error('[auth] revokeAllUserSessions failed:', error);
        throw error;
    }
}

// ─── logSecurityEvent ─────────────────────────────────────────────────────────

/**
 * FIX: Previously threw if Redis was not configured.
 * Now guarded behind isRedisConfigured() and all Redis calls are wrapped.
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
    // Always log to console for immediate observability regardless of Redis
    console.log(`[SECURITY] ${event.type.toUpperCase()}:`, {
        userId: event.userId,
        ip: event.ip,
        userAgent: event.userAgent.substring(0, 100),
        timestamp: event.timestamp,
        reason: event.reason,
    });

    if (!isRedisConfigured()) return;

    try {
        const logEntry = {
            ...event,
            id: randomBytes(16).toString('hex'),
            timestamp: event.timestamp.toISOString(),
        };

        await safeRedisSetex(
            `security_log:${logEntry.id}`,
            30 * 24 * 60 * 60,
            JSON.stringify(logEntry)
        );

        if (event.userId !== 'anonymous' && event.userId !== 'unknown') {
            try {
                await redisClient.lpush(`user:${event.userId}:security_log`, logEntry.id);
                await redisClient.ltrim(`user:${event.userId}:security_log`, 0, 100);
            } catch (err) {
                console.warn('[auth] Failed to update security log index in Redis:', (err as any)?.message);
            }
        }
    } catch (error) {
        console.error('[auth] logSecurityEvent failed:', error);
    }
}

// ─── cleanupExpiredSessions ───────────────────────────────────────────────────

export async function cleanupExpiredSessions(): Promise<void> {
    try {
        const now = new Date();
        await db.delete(tbl_staff_session).where(lte(tbl_staff_session.expiresAt, now));

        if (isRedisConfigured()) {
            try {
                const keys = await redisClient.keys('session:*');
                for (const key of keys) {
                    const sessionData = await safeRedisGet(key);
                    if (!sessionData) continue;
                    try {
                        const session: any = JSON.parse(sessionData);
                        if (session.expiresAt && new Date(session.expiresAt) <= now) {
                            const sessionId = key.replace('session:', '');
                            await safeRedisDel(key);
                            if (session.userId && isRedisConfigured()) {
                                try { await redisClient.srem(`user:${session.userId}:sessions`, sessionId); } catch { /* ignore */ }
                            }
                        }
                    } catch { /* corrupt cache entry, skip */ }
                }
            } catch (cacheErr) {
                console.warn('[auth] Failed to clean expired sessions from Redis:', (cacheErr as any)?.message);
            }
        }
    } catch (error) {
        console.error('[auth] cleanupExpiredSessions failed:', error);
    }
}

// ─── Middleware helpers ───────────────────────────────────────────────────────

export function extractToken(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);

    const cookies = request.headers.get('Cookie');
    if (cookies) {
        const match = cookies.match(/token=([^;]+)/);
        if (match) return match[1];
    }

    return null;
}

export function hasRole(user: AuthUser, requiredRole: 'admin' | 'staff'): boolean {
    if (requiredRole === 'admin') return user.userType === 'admin' || user.userType === 'super_admin';
    if (requiredRole === 'staff') return ['admin', 'super_admin', 'staff'].includes(user.userType);
    return false;
}

export function hasPermission(user: AuthUser, permission: string): boolean {
    if (user.userType === 'admin' || user.userType === 'super_admin') return true;
    return user.permissions?.includes(permission) ?? false;
}

export async function requireAuth(
    request: Request,
    requiredRole?: 'admin' | 'staff'
): Promise<{ user: AuthUser } | { error: Response }> {
    const token = extractToken(request);
    if (!token) {
        return { error: new Response(JSON.stringify({ success: false, message: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }

    const user = await verifyToken(token);
    if (!user) {
        return { error: new Response(JSON.stringify({ success: false, message: 'Invalid or expired token' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }

    if (requiredRole && !hasRole(user, requiredRole)) {
        return { error: new Response(JSON.stringify({ success: false, message: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) };
    }

    return { user };
}

// ─── Internal: fetch helpers ──────────────────────────────────────────────────

/**
 * Fetch a user record from whichever table owns them.
 * Returns { user, userType } or { user: null, userType: '' }.
 */
async function fetchUser(userId: number, hintUserType?: string): Promise<{ user: any; userType: string }> {
    // Check super_admin
    const [superAdmin] = await db.select({ id: tbl_super_admin.id, name: tbl_super_admin.name, username: tbl_super_admin.username, email: tbl_super_admin.email, isActive: tbl_super_admin.isActive, uniqueId: tbl_super_admin.uniqueId })
        .from(tbl_super_admin).where(eq(tbl_super_admin.id, userId)).limit(1);
    if (superAdmin) return { user: superAdmin, userType: 'super_admin' };

    // Check admin
    const [admin] = await db.select({ id: tbl_admin.id, name: tbl_admin.name, username: tbl_admin.username, email: tbl_admin.email, isActive: tbl_admin.isActive, uniqueId: tbl_admin.uniqueId })
        .from(tbl_admin).where(eq(tbl_admin.id, userId)).limit(1);
    if (admin) return { user: admin, userType: 'admin' };

    // Check staff
    const [staff] = await db.select({ id: tbl_staff.id, name: tbl_staff.name, username: tbl_staff.username, email: tbl_staff.email, isActive: tbl_staff.isActive, uniqueId: tbl_staff.uniqueId })
        .from(tbl_staff).where(eq(tbl_staff.id, userId)).limit(1);
    if (staff) return { user: staff, userType: 'staff' };

    // Check regular user
    const [regularUser] = await db.select({ id: tbl_user.id, name: tbl_user.name, username: tbl_user.username, email: tbl_user.email, isActive: tbl_user.isActive, uniqueId: tbl_user.uniqueId, userType: tbl_user.userType })
        .from(tbl_user).where(eq(tbl_user.id, userId)).limit(1);
    if (regularUser) return { user: regularUser, userType: regularUser.userType || 'user' };

    return { user: null, userType: '' };
}

/**
 * Fetch permission keys for admin/staff users.
 */
async function fetchPermissions(userType: string, uniqueId?: string | null): Promise<string[]> {
    if (!['admin', 'super_admin', 'staff'].includes(userType) || !uniqueId) return [];

    const [perm] = await db.select({
        canManageBooks: tbl_staff_permission.canManageBooks,
        canManageUsers: tbl_staff_permission.canManageUsers,
        canManageBorrowing: tbl_staff_permission.canManageBorrowing,
        canManageReservations: tbl_staff_permission.canManageReservations,
        canViewReports: tbl_staff_permission.canViewReports,
        canManageFines: tbl_staff_permission.canManageFines,
    }).from(tbl_staff_permission).where(eq(tbl_staff_permission.staffUniqueId, uniqueId)).limit(1);

    if (!perm) return [];

    return (Object.keys(perm) as (keyof typeof perm)[]).filter((k) => perm[k]);
}

// ─── Legacy ───────────────────────────────────────────────────────────────────

/** @deprecated Use generateTokens() instead */
export function generateToken(user: AuthUser): string {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
            email: user.email,
            userType: user.userType,
            sessionId: generateSessionId(),
            tokenType: 'access',
            jti: randomBytes(16).toString('hex'),
            iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: '7d', issuer: 'kalibro-library', subject: user.id.toString() }
    );
}