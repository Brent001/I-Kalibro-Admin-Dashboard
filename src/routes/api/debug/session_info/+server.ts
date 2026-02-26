import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

const JWT_SECRET = env.JWT_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

function maskToken(t: string | null | undefined) {
  if (!t) return null;
  if (t.length <= 20) return '*** masked ***';
  return t.slice(0, 6) + '...' + t.slice(-6);
}

export const GET: RequestHandler = async ({ request, cookies }) => {
  try {
    const cookieToken = (() => {
      try { return cookies.get('token') || cookies.get('client_token') || null; } catch { return null; }
    })();

    const headerAuth = request.headers.get('authorization') || request.headers.get('Authorization') || null;
    const rawCookieHeader = request.headers.get('cookie') || null;

    let decoded = null;
    const token = cookieToken || (headerAuth && headerAuth.startsWith('Bearer ') ? headerAuth.substring(7) : null);
    if (token) {
      try { decoded = jwt.verify(token, JWT_SECRET); } catch (e) { decoded = { error: String(e) }; }
    }

    return json({
      success: true,
      data: {
        cookieTokenPresent: Boolean(cookieToken),
        cookieTokenMasked: maskToken(cookieToken),
        headerAuthPresent: Boolean(headerAuth),
        headerAuthMasked: maskToken(headerAuth && headerAuth.startsWith('Bearer ') ? headerAuth.substring(7) : headerAuth),
        rawCookieHeaderPresent: Boolean(rawCookieHeader),
        rawCookieHeaderLength: rawCookieHeader ? rawCookieHeader.length : 0,
        decodedToken: decoded
      }
    });
  } catch (err) {
    return json({ success: false, error: String(err) }, { status: 500 });
  }
};
