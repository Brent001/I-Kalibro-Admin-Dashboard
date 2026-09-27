import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked, refreshAccessToken } from '$lib/server/db/auth.js';
import { db } from '$lib/server/db/index.js';
import { tbl_library_settings } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

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

// Device detection utilities
function detectDeviceType(userAgent: string) {
  const ua = userAgent.toLowerCase();
  return {
    isMobile: /mobi|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua),
    isAndroid: /android/i.test(ua),
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isSafari: /^((?!chrome|android).)*safari/i.test(userAgent),
    isChrome: /chrome/i.test(ua) && !/edge/i.test(ua),
    isFirefox: /firefox/i.test(ua),
    isEdge: /edge/i.test(ua)
  };
}

// Browser capability check
function checkBrowserCapabilities(userAgent: string) {
  const device = detectDeviceType(userAgent);
  const supportsCamera = device.isChrome || device.isFirefox || device.isEdge ||
                        device.isSafari || device.isAndroid;
  return {
    supportsCamera,
    recommendedSettings: {
      fps: device.isMobile ? 6 : 10,
      qrboxPercentage: device.isMobile ? 0.8 : 0.7,
      preferredCamera: device.isMobile ? 'environment' : 'user'
    }
  };
}

/**
 * Fetch the scan method configured in tbl_library_settings.
 * Defaults to 'qrcode' if the setting is missing or the query fails.
 */
async function getVisitScanMethod(): Promise<'qrcode' | 'barcode' | 'both'> {
    try {
        const [row] = await db
            .select({ settingValue: tbl_library_settings.settingValue })
            .from(tbl_library_settings)
            .where(eq(tbl_library_settings.settingKey, 'visitScanMethod'))
            .limit(1);
        const method = row?.settingValue;
        if (method === 'barcode' || method === 'both') return method;
    } catch (err) {
        console.warn('[qr_scanner] Could not read visitScanMethod from DB (non-fatal):', (err as any)?.message);
    }
    return 'qrcode';
}

export const load: PageServerLoad = async ({ cookies, url, request }) => {
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
            console.warn('[qr_scanner] Session revoked');
            clearAuthCookies(cookies);
            throw redirect(302, '/');
        }
    } catch (err) {
        if (err instanceof Response || (err as any)?.status) throw err;
        console.warn('[qr_scanner] isSessionRevoked check failed (non-fatal):', (err as any)?.message);
    }

    // ── 3. Extract user from verified token ───────────────────────────────────
    const userId = decoded.userId || decoded.id;

    if (!userId) {
        console.warn('[qr_scanner] Token missing user ID');
        clearAuthCookies(cookies);
        throw redirect(302, '/');
    }

    // Normalize role
    const userTypeRaw = decoded.userType || decoded.role || 'user';
    const roleMap: { [key: string]: string } = {
        'super_admin': 'admin',
        'superadmin': 'admin',
        'admin': 'admin',
        'staff': 'staff',
        'librarian': 'staff',
        'student': 'student',
        'faculty': 'faculty'
    };

    const normalizedUserType = String(userTypeRaw).toLowerCase().replace(/[,\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    const role = roleMap[normalizedUserType] || 'user';

    // Only allow admin/staff roles to access scanner
    if (!(role === 'admin' || role === 'staff')) {
        console.warn('Unauthorized role for QR scanner:', userTypeRaw);
        clearAuthCookies(cookies);
        throw redirect(302, '/');
    }

    // ── 4. Fetch scan method from DB settings ─────────────────────────────────
    const visitScanMethod = await getVisitScanMethod();

    // Get device and browser info
    const userAgent = request.headers.get('user-agent') || '';
    const device = detectDeviceType(userAgent);
    const capabilities = checkBrowserCapabilities(userAgent);

    const isSecureContext = url.protocol === 'https:' ||
                           url.hostname === 'localhost' ||
                           url.hostname === '127.0.0.1';

    const displayName = decoded.name || decoded.fullName || decoded.username || '';
    const displayUsername = decoded.username || decoded.email || '';

    return {
        user: {
            id: userId,
            name: displayName,
            username: displayUsername,
            email: decoded.email || '',
            userType: normalizedUserType
        },
        scanner: {
            device,
            capabilities,
            isSecureContext,
            visitScanMethod,           // ← 'qrcode' | 'barcode' | 'both'
            config: capabilities.recommendedSettings,
            errors: {
                httpsRequired: null,
                unsupportedBrowser: !capabilities.supportsCamera ? 'Browser does not support camera access' : null
            }
        }
    };
};