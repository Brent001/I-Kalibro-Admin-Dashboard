import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { verifyToken, refreshAccessToken } from '$lib/server/db/auth.js';
import type { JWTPayload } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Access token lifetime in seconds — must match what generateTokens() uses (15 min).
const ACCESS_TOKEN_MAX_AGE_S = 15 * 60;

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
};

export const GET: RequestHandler = async ({ request, getClientAddress, cookies }) => {
    const startTime = Date.now();
    const clientIP = getClientAddress();
    const isProduction = process.env.NODE_ENV === 'production';

    // ── 1. Extract token ──────────────────────────────────────────────────────
    let token = cookies.get('token');

    if (!token) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    if (!token) {
        return json(
            { success: false, message: 'No authentication token provided', error: 'MISSING_TOKEN' },
            { status: 401, headers: NO_CACHE_HEADERS }
        );
    }

    // ── 2. Try to verify the token as-is ─────────────────────────────────────
    //
    // verifyToken() is the single source of truth: it checks JWT signature,
    // token type, DB session (hash + active + expiry), and live user status.
    // We do NOT duplicate that logic here.
    let user = await verifyToken(token, 'access');

    // ── 3. If expired, attempt a silent refresh ───────────────────────────────
    if (!user) {
        // Peek at the JWT without verification to distinguish "expired" from "invalid".
        // We only attempt a refresh when the JWT itself was structurally valid but expired.
        let isExpired = false;
        try {
            jwt.verify(token, JWT_SECRET);
        } catch (err) {
            isExpired = err instanceof jwt.TokenExpiredError;
        }

        if (isExpired) {
            const refreshToken = cookies.get('refresh_token');

            if (!refreshToken) {
                return json(
                    { success: false, message: 'Authentication token has expired', error: 'TOKEN_EXPIRED' },
                    { status: 401, headers: NO_CACHE_HEADERS }
                );
            }

            // refreshAccessToken() validates the refresh token against the DB session.
            const refreshed = await refreshAccessToken(refreshToken);

            if (!refreshed?.accessToken) {
                // Refresh token itself is invalid/expired/revoked – force re-login.
                cookies.delete('token', { path: '/' });
                cookies.delete('refresh_token', { path: '/' });
                return json(
                    { success: false, message: 'Session has expired, please log in again', error: 'SESSION_EXPIRED' },
                    { status: 401, headers: NO_CACHE_HEADERS }
                );
            }

            // Persist the new access token cookie with a proper maxAge so it
            // survives the tab staying open past the old token's expiry.
            cookies.set('token', refreshed.accessToken, {
                path: '/',
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'strict' : 'lax',
                maxAge: ACCESS_TOKEN_MAX_AGE_S,
            });

            token = refreshed.accessToken;
            user = await verifyToken(token, 'access');
        }
    }

    // ── 4. Final auth gate ────────────────────────────────────────────────────
    if (!user) {
        return json(
            { success: false, message: 'Invalid or expired authentication token', error: 'INVALID_TOKEN' },
            { status: 401, headers: NO_CACHE_HEADERS }
        );
    }

    // ── 5. Pull timing info from the (now-trusted) token ─────────────────────
    // At this point the token has passed full verification – safe to decode.
    const decoded = jwt.decode(token) as JWTPayload;

    return json(
        {
            success: true,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    userType: user.userType,
                    isActive: user.isActive,        // from live DB fetch, never hardcoded
                    permissions: user.permissions ?? [],
                },
                sessionInfo: {
                    authenticatedAt: new Date().toISOString(),
                    ipAddress: clientIP,
                    processingTime: Date.now() - startTime,
                    tokenIssued: decoded?.iat ? new Date(decoded.iat * 1000).toISOString() : null,
                    tokenExpires: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
                },
            },
        },
        { status: 200, headers: NO_CACHE_HEADERS }
    );
};

export const OPTIONS: RequestHandler = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        },
    });
};