import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

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
  const token = cookies.get('token');
  
  if (!token) {
    throw redirect(302, '/');
  }

  try {
    // Check if session revoked (admin/session logout)
    if (await isSessionRevoked(token)) {
      console.warn('Session has been revoked');
      cookies.delete('token', { path: '/' });
      cookies.delete('refresh_token', { path: '/' });
      throw redirect(302, '/');
    }

    // Verify JWT token and derive user from token (follow members page pattern)
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      cookies.delete('token', { path: '/' });
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
      cookies.delete('token', { path: '/' });
      cookies.delete('refresh_token', { path: '/' });
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

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      console.warn('Invalid or expired token:', error.message);
      cookies.delete('token', { path: '/' });
      cookies.delete('refresh_token', { path: '/' });
      throw redirect(302, '/');
    }
    
    console.error('Dashboard auth check error:', error);
    cookies.delete('token', { path: '/' });
    cookies.delete('refresh_token', { path: '/' });
    throw redirect(302, '/');
  }
};