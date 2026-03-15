import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_staff, tbl_admin, tbl_super_admin, tbl_user, tbl_student, tbl_faculty } from '$lib/server/db/schema/schema.js';
import { eq, and } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedActor {
  id: number;
  userType: 'super_admin' | 'admin' | 'staff';
}

/**
 * Mirrors the authenticateUser pattern from /api/books:
 * reads the token from the Authorization header first, then falls back
 * to the 'token' cookie — exactly how the working endpoints do it.
 */
async function authenticateActor(request: Request): Promise<AuthenticatedActor | null> {
  try {
    let token: string | null = null;

    // 1. Try Authorization: Bearer <token>
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Fall back to cookie
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map(c => {
            const idx = c.indexOf('=');
            return [c.slice(0, idx), c.slice(idx + 1)];
          })
        );
        token = cookies['token'] ?? null;
      }
    }

    if (!token) return null;

    // 3. Revocation check (same as books API)
    if (await isSessionRevoked(token)) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;
    if (!userId) return null;

    // 4. Confirm actor exists and is active — check all three privileged tables
    const [superAdminRow] = await db
      .select({ id: tbl_super_admin.id, isActive: tbl_super_admin.isActive })
      .from(tbl_super_admin)
      .where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true)))
      .limit(1);
    if (superAdminRow) return { id: userId, userType: 'super_admin' };

    const [adminRow] = await db
      .select({ id: tbl_admin.id, isActive: tbl_admin.isActive })
      .from(tbl_admin)
      .where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true)))
      .limit(1);
    if (adminRow) return { id: userId, userType: 'admin' };

    const [staffRow] = await db
      .select({ id: tbl_staff.id, isActive: tbl_staff.isActive })
      .from(tbl_staff)
      .where(and(eq(tbl_staff.id, userId), eq(tbl_staff.isActive, true)))
      .limit(1);
    if (staffRow) return { id: userId, userType: 'staff' };

    return null;
  } catch (err) {
    console.error('[process-qr] Auth error:', err);
    return null;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const actor = await authenticateActor(request);
    if (!actor) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse scanned content ─────────────────────────────────────────────────
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length < 2) {
      return json({ error: 'Invalid QR/barcode content' }, { status: 400 });
    }

    const scanned = content.trim();

    // ── Try student lookup by enrollmentNo ────────────────────────────────────
    const [studentRow] = await db
      .select({
        userId: tbl_student.userId,
        enrollmentNo: tbl_student.enrollmentNo,
      })
      .from(tbl_student)
      .where(eq(tbl_student.enrollmentNo, scanned))
      .limit(1);

    if (studentRow) {
      const [userInfo] = await db
        .select({
          id: tbl_user.id,
          username: tbl_user.username,
          name: tbl_user.name,
          userType: tbl_user.userType,
          isActive: tbl_user.isActive,
        })
        .from(tbl_user)
        .where(eq(tbl_user.id, studentRow.userId))
        .limit(1);

      if (userInfo?.isActive) {
        return json({
          success: true,
          processed: true,
          user: {
            id: userInfo.id,
            username: userInfo.username,
            name: userInfo.name,
            userType: userInfo.userType,
            idNumber: studentRow.enrollmentNo,
          },
          type: 'student',
        });
      }
    }

    // ── Try faculty lookup by facultyNumber ───────────────────────────────────
    const [facultyRow] = await db
      .select({
        userId: tbl_faculty.userId,
        facultyNumber: tbl_faculty.facultyNumber,
      })
      .from(tbl_faculty)
      .where(eq(tbl_faculty.facultyNumber, scanned))
      .limit(1);

    if (facultyRow) {
      const [userInfo] = await db
        .select({
          id: tbl_user.id,
          username: tbl_user.username,
          name: tbl_user.name,
          userType: tbl_user.userType,
          isActive: tbl_user.isActive,
        })
        .from(tbl_user)
        .where(eq(tbl_user.id, facultyRow.userId))
        .limit(1);

      if (userInfo?.isActive) {
        return json({
          success: true,
          processed: true,
          user: {
            id: userInfo.id,
            username: userInfo.username,
            name: userInfo.name,
            userType: userInfo.userType,
            idNumber: facultyRow.facultyNumber,
          },
          type: 'faculty',
        });
      }
    }

    // ── Nothing matched ───────────────────────────────────────────────────────
    return json(
      { success: false, error: 'ID not found. Not a registered student or faculty number.' },
      { status: 404 }
    );

  } catch (error) {
    console.error('[process-qr] Error:', error);
    return json({ error: 'Failed to process QR code' }, { status: 500 });
  }
};