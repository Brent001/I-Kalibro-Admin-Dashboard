import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked, refreshAccessToken } from '$lib/server/db/auth.js';

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
  
  // Most modern browsers support getUserMedia
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

// QR code processing logic
function processQRCode(content: string) {
  // Add your business logic here
  try {
    // Example: Validate format, extract data, log to database, etc.
    console.log('Processing QR code:', content.substring(0, 50) + '...');
    
    // You can add database operations here
    // Example: await db.insert(scanLogs).values({ content, userId, timestamp: new Date() });
    
    return {
      success: true,
      processed: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('QR processing error:', error);
    return {
      success: false,
      error: 'Failed to process QR code',
      timestamp: new Date().toISOString()
    };
  }
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
        // Re-throw redirects, swallow other errors (revocation check is best-effort)
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

    // Map/normalize role similar to members page
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

    // Get device and browser info
    const userAgent = request.headers.get('user-agent') || '';
    const device = detectDeviceType(userAgent);
    const capabilities = checkBrowserCapabilities(userAgent);
    
    // Check if HTTPS (for camera access)
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
            config: capabilities.recommendedSettings,
            errors: {
                httpsRequired: null, // Removed HTTPS restriction
                unsupportedBrowser: !capabilities.supportsCamera ? 'Browser does not support camera access' : null
            }
        }
    };
};