import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_notification, tbl_user, tbl_admin, tbl_staff, tbl_super_admin } from '$lib/server/db/schema/schema.js';
import jwt from 'jsonwebtoken';
import { eq, and, desc, inArray } from 'drizzle-orm';
// only look at the real environment variable rather than mixing two sources
// keep the same logic that `+server.ts` in the login handler uses so there
// is no chance of signing with one secret and verifying with another.
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

async function authenticateStaff(request: Request, cookies?: any) {
  try {
    let token: string | null = null;

    // Prefer SvelteKit cookies when provided
    if (cookies) {
      try {
        token = cookies.get('token') || cookies.get('client_token') || null;
      } catch (e) {
        // ignore
      }
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!token && authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);

    // Fallback: parse raw Cookie header if still missing
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookiesRaw = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
        token = cookiesRaw.client_token || cookiesRaw.token || null;
      }
    }

    if (!token) return null;

    let decoded: any = null;
    let userId: any = null;
    let tokenUserType: any = null;

    // verify the token using our secret; do NOT fall back to jwt.decode as that
    // completely bypasses signature checking and was only added for local
    // debugging.  In production we should treat a verify failure as a dead
    // token, log an appropriate message, and return `null` so the caller can
    // reject the request.
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId || decoded.id;
      tokenUserType = decoded.userType || decoded.type || null;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        console.warn('authenticateStaff: token expired');
      } else {
        console.warn('authenticateStaff: token verification failed', err.message);
      }
      return null;
    }

    // If token explicitly carries userType (incl. super_admin), trust it and return
    if (userId && tokenUserType && ['staff', 'admin', 'super_admin'].includes(tokenUserType)) {
      return { id: Number(userId), userType: tokenUserType };
    }

    // Fallback: try to find the id in known actor tables
    if (!userId) return null;

    // 1) tbl_user
    const [userRow] = await db.select({ id: tbl_user.id, userType: tbl_user.userType }).from(tbl_user).where(eq(tbl_user.id, userId)).limit(1);
    if (userRow && ['staff', 'admin'].includes(userRow.userType || '')) {
      const resolved = { id: userRow.id, userType: userRow.userType };
      console.debug('authenticateStaff: resolved from tbl_user', resolved);
      return resolved;
    }

    // 2) tbl_admin
    const [adminRow] = await db.select({ id: tbl_admin.id }).from(tbl_admin).where(eq(tbl_admin.id, userId)).limit(1);
    if (adminRow) {
      const resolved = { id: adminRow.id, userType: 'admin' };
      console.debug('authenticateStaff: resolved from tbl_admin', resolved);
      return resolved;
    }

    // 3) tbl_staff
    const [staffRow] = await db.select({ id: tbl_staff.id }).from(tbl_staff).where(eq(tbl_staff.id, userId)).limit(1);
    if (staffRow) {
      const resolved = { id: staffRow.id, userType: 'staff' };
      console.debug('authenticateStaff: resolved from tbl_staff', resolved);
      return resolved;
    }

    // 4) tbl_super_admin
    const [superRow] = await db.select({ id: tbl_super_admin.id }).from(tbl_super_admin).where(eq(tbl_super_admin.id, userId)).limit(1);
    if (superRow) {
      const resolved = { id: superRow.id, userType: 'super_admin' };
      console.debug('authenticateStaff: resolved from tbl_super_admin', resolved);
      return resolved;
    }

    return null;
  } catch (err) {
    console.error('auth error', err);
    return null;
  }
}

export const GET: RequestHandler = async ({ request, url, cookies }) => {
  const staff = await authenticateStaff(request, cookies);
  if (!staff) return error(401, { message: 'Unauthorized' });

  try {
    const unreadOnly = (url.searchParams.get('unread') || '').toLowerCase() === 'true';

    let whereClause: any = and(eq(tbl_notification.recipientId, staff.id), eq(tbl_notification.recipientType, staff.userType));
    if (unreadOnly) whereClause = and(whereClause, eq(tbl_notification.isRead, false));

    const rows = await db
      .select({ id: tbl_notification.id, title: tbl_notification.title, message: tbl_notification.message, type: tbl_notification.type, relatedItemType: tbl_notification.relatedItemType, relatedItemId: tbl_notification.relatedItemId, isRead: tbl_notification.isRead, sentAt: tbl_notification.sentAt, createdAt: tbl_notification.createdAt })
      .from(tbl_notification)
      .where(whereClause)
      .orderBy(desc(tbl_notification.sentAt));

    return json({ success: true, data: rows });
  } catch (err: any) {
    console.error('fetch notifications error', err);
    return error(500, { message: 'Failed to fetch notifications' });
  }
};

// Patch: allow marking notifications as read/unread or marking many as read
export const PATCH: RequestHandler = async ({ request, cookies }) => {
  const staff = await authenticateStaff(request as Request, cookies);
  if (!staff) return error(401, { message: 'Unauthorized' });

  let body: any;
  try { body = await request.json(); } catch (e) { return error(400, { message: 'Invalid JSON' }); }

  const ids = Array.isArray(body.id) ? body.id.map(Number) : (body.id ? [Number(body.id)] : []);
  if (!ids.length) return error(400, { message: 'id or id[] required' });

  try {
    await db.update(tbl_notification).set({ isRead: Boolean(body.isRead) }).where(and(eq(tbl_notification.recipientId, staff.id), eq(tbl_notification.recipientType, staff.userType), inArray(tbl_notification.id, ids)));
    return json({ success: true });
  } catch (err: any) {
    console.error('mark notifications error', err);
    return error(500, { message: 'Failed to update notifications' });
  }
};
