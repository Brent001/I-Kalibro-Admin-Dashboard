import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked, refreshAccessToken } from '$lib/server/db/auth.js';
import { decryptData } from '$lib/utils/encryption.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ACCESS_TOKEN_MAX_AGE_S = 15 * 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearAuthCookies(cookies: Parameters<PageServerLoad>[0]['cookies']) {
    cookies.delete('token', { path: '/' });
    cookies.delete('refresh_token', { path: '/' });
}

/**
 * Resolve a valid, non-expired access token.
 *
 * 1. Try the existing token.
 * 2. If it's expired, silently refresh using the refresh_token cookie.
 * 3. If refresh succeeds, write the new token cookie and return the decoded payload.
 * 4. If anything else fails, return null so the caller can redirect.
 */
async function resolveToken(
    cookies: Parameters<PageServerLoad>[0]['cookies']
): Promise<{ token: string; decoded: any } | null> {
    const token = cookies.get('token');
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { token, decoded };
    } catch (err) {
        if (!(err instanceof jwt.TokenExpiredError)) {
            // Structurally invalid — don't bother refreshing
            return null;
        }
    }

    // ── Token expired: attempt silent refresh ─────────────────────────────────
    const refreshToken = cookies.get('refresh_token');
    if (!refreshToken) return null;

    try {
        const refreshed = await refreshAccessToken(refreshToken);
        if (!refreshed?.accessToken) return null;

        cookies.set('token', refreshed.accessToken, {
            path: '/',
            httpOnly: true,
            secure: IS_PRODUCTION,
            sameSite: IS_PRODUCTION ? 'strict' : 'lax',
            maxAge: ACCESS_TOKEN_MAX_AGE_S,
        });

        const decoded = jwt.verify(refreshed.accessToken, JWT_SECRET);
        return { token: refreshed.accessToken, decoded };
    } catch {
        return null;
    }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export const actions = {
    default: async () => ({ success: true }),

    refreshDashboard: async ({ cookies, fetch }) => {
        const token = cookies.get('token');
        if (!token) return { success: false, error: 'Not authenticated' };

        try {
            const res = await fetch('/api/dashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                return { success: true, data: data.data };
            }

            return { success: false, error: 'Failed to fetch dashboard data' };
        } catch (error) {
            console.error('Dashboard refresh error:', error);
            return { success: false, error: 'Error refreshing dashboard' };
        }
    },
};

// ─── Load ─────────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async ({ cookies, fetch }) => {
    // ── 1. Resolve a valid token (refresh silently if expired) ────────────────
    const resolved = await resolveToken(cookies);

    if (!resolved) {
        clearAuthCookies(cookies);
        throw redirect(302, '/');
    }

    const { token, decoded } = resolved;

    // ── 2. Revocation check ───────────────────────────────────────────────────
    try {
        if (await isSessionRevoked(token)) {
            console.warn('[dashboard] Session revoked');
            clearAuthCookies(cookies);
            throw redirect(302, '/');
        }
    } catch (err) {
        // Re-throw redirects, swallow other errors (revocation check is best-effort)
        if (err instanceof Response || (err as any)?.status) throw err;
        console.warn('[dashboard] isSessionRevoked check failed (non-fatal):', (err as any)?.message);
    }

    // ── 3. Extract user from verified token ───────────────────────────────────
    const userId = decoded.userId || decoded.id;

    if (!userId) {
        console.warn('[dashboard] Token missing user ID');
        clearAuthCookies(cookies);
        throw redirect(302, '/');
    }

    // ── 4. Fetch dashboard data (never fails the page load) ───────────────────
    const emptyDashboard = {
        totalBooks: 0,
        activeMembers: 0,
        booksBorrowed: 0,
        overdueBooks: 0,
        recentActivity: [],
        overdueBooksList: [],
    };

    let dashboard: any = emptyDashboard;

    try {
        const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
        });

        if (res.ok) {
            const result = await res.json();
            if (result.success && result.data) {
                dashboard = result.encrypted ? decryptData(result.data) : result.data;
            }
        } else {
            console.warn('[dashboard] API returned', res.status);
        }
    } catch (err) {
        console.warn('[dashboard] Data fetch failed (non-fatal):', (err as any)?.message);
    }

    // ── 5. Return ─────────────────────────────────────────────────────────────
    return {
        user: {
            id: userId,
            username: decoded.username,
            email: decoded.email,
            userType: decoded.userType,
        },
        dashboard,
    };
};