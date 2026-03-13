import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked, refreshAccessToken } from '$lib/server/db/auth.js';
import { getStaffInfo, getRecentVisits, calculateScanStats, formatVisitResponse } from '$lib/server/services/barcodeService.js';

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

/**
 * Load page data - recent scans and statistics
 */
export const load: PageServerLoad = async ({ cookies }) => {
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
            console.warn('[barcode] Session revoked');
            clearAuthCookies(cookies);
            throw redirect(302, '/');
        }
    } catch (err) {
        // Re-throw redirects, swallow other errors (revocation check is best-effort)
        if (err instanceof Response || (err as any)?.status) throw err;
        console.warn('[barcode] isSessionRevoked check failed (non-fatal):', (err as any)?.message);
    }

    // ── 3. Extract user from verified token ───────────────────────────────────
    const userId = decoded.userId || decoded.id;
    const userType = decoded.userType;

    if (!userId) {
        console.warn('[barcode] Token missing user ID');
        clearAuthCookies(cookies);
        throw redirect(302, '/');
    }

    // Check authorization - only super_admin, admin, and staff can access
    const staffRoles = ['super_admin', 'admin', 'staff'];
    if (!userType || !staffRoles.includes(userType)) {
        return {
            authorized: false,
            hardwareSupport: false,
            recentScans: [],
            stats: {
                totalScans: 0,
                studentsScanned: 0,
                facultyScanned: 0
            }
        };
    }

    try {
        // Get staff info and recent visits in parallel
        const [staffInfo, recentVisits] = await Promise.all([
            getStaffInfo(userId),
            getRecentVisits(20)
        ]);

        // Calculate statistics
        const stats = calculateScanStats(recentVisits);

        // Format recent scans for display
        const formattedScans = recentVisits.map(formatVisitResponse);

        return {
            authorized: true,
            staffName: staffInfo?.name || 'Staff Member',
            staffDepartment: staffInfo?.department || '',
            staffPosition: staffInfo?.position || '',
            recentScans: formattedScans,
            stats,
            // indicate server supports hardware scanner POST actions
            hardwareSupport: true
        };
    } catch (err) {
        console.error('Error loading barcode scanner page:', err);
        return {
            authorized: true,
            staffName: 'Staff Member',
            recentScans: [],
            stats: {
                totalScans: 0,
                studentsScanned: 0,
                facultyScanned: 0
            }
            ,
            hardwareSupport: true
        };
    }
};

// Server-side action to support hardware barcode scanners that POST the barcode
export const actions = {
    scan: async ({ request, cookies }) => {
        try {
            // Support hardware scanners sending POSTs without session cookies
            const HARDWARE_KEY = process.env.BARCODE_HARDWARE_KEY || process.env.BARCODE_HARDWARE_TOKEN || '';
            const hwKeyHeader = request.headers.get('x-hardware-key') || request.headers.get('x-api-key') || '';

            // Try normal user auth first
            const resolved = await resolveToken(cookies);
            const user = resolved ? { id: resolved.decoded.userId || resolved.decoded.id } : null;
            const isHardware = HARDWARE_KEY && hwKeyHeader && HARDWARE_KEY === hwKeyHeader;

            if (!user && !isHardware) {
                return { success: false, error: 'Unauthorized' };
            }

            const form = await request.formData();
            const rawBarcode = form.get('barcode');
            const barcode = typeof rawBarcode === 'string' ? rawBarcode.trim() : (rawBarcode ? String(rawBarcode).trim() : '');
            const action = (form.get('action') as string) || 'time_in';
            const purpose = (form.get('purpose') as string) || 'Library Access';

            if (!barcode) {
                return { success: false, error: 'Missing barcode' };
            }

            // Forward the scan to the internal API endpoint so the same validation
            // and DB logic is used (preserves a single source of truth).
            const apiUrl = new URL('/api/barcode/scan-member', request.url).toString();
            // Forward hardware key header when request originates from scanner device
            const forwardHeaders: Record<string, string> = {
                'content-type': 'application/json'
            };

            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
                forwardHeaders.cookie = cookieHeader;
            }

            if (isHardware) {
                forwardHeaders['x-hardware-key'] = hwKeyHeader;
            }

            const apiResp = await fetch(apiUrl, {
                method: 'POST',
                headers: forwardHeaders,
                body: JSON.stringify({ barcode, action, purpose })
            });

            const jsonResult = await apiResp.json();
            return { success: apiResp.ok, result: jsonResult };
        } catch (err) {
            console.error('scan action error:', err);
            return { success: false, error: 'Error processing scan' };
        }
    }
};