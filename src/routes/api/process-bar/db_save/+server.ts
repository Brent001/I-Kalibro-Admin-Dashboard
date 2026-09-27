import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import {
  tbl_staff,
  tbl_admin,
  tbl_super_admin,
  tbl_user,
  tbl_student,
  tbl_faculty,
  tbl_library_visit,
} from '$lib/server/db/schema/schema.js';
import { eq, and, isNull, desc } from 'drizzle-orm';
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
    console.error('[db_save] Auth error:', err);
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

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await request.json();
    const { content, action, purpose } = body;

    if (!content || typeof content !== 'string') {
      return json({ error: 'Missing scanned content' }, { status: 400 });
    }
    if (!action || (action !== 'time_in' && action !== 'time_out')) {
      return json({ error: 'Invalid action. Must be "time_in" or "time_out"' }, { status: 400 });
    }

    // ── Re-resolve the visitor server-side (prevents spoofing) ───────────────
    const scanned = content.trim();

    let visitorUserId: number | null = null;
    let visitorName: string = '';
    let visitorType: string = '';
    let idNumber: string = '';

    // Try student first
    const [studentRow] = await db
      .select({ userId: tbl_student.userId, enrollmentNo: tbl_student.enrollmentNo })
      .from(tbl_student)
      .where(eq(tbl_student.enrollmentNo, scanned))
      .limit(1);

    if (studentRow) {
      const [userInfo] = await db
        .select({
          id: tbl_user.id,
          name: tbl_user.name,
          userType: tbl_user.userType,
          isActive: tbl_user.isActive,
        })
        .from(tbl_user)
        .where(eq(tbl_user.id, studentRow.userId))
        .limit(1);

      if (userInfo?.isActive) {
        visitorUserId = userInfo.id;
        visitorName   = userInfo.name;
        visitorType   = userInfo.userType;
        idNumber      = studentRow.enrollmentNo;
      }
    }

    // Try faculty if no student matched
    if (!visitorUserId) {
      const [facultyRow] = await db
        .select({ userId: tbl_faculty.userId, facultyNumber: tbl_faculty.facultyNumber })
        .from(tbl_faculty)
        .where(eq(tbl_faculty.facultyNumber, scanned))
        .limit(1);

      if (facultyRow) {
        const [userInfo] = await db
          .select({
            id: tbl_user.id,
            name: tbl_user.name,
            userType: tbl_user.userType,
            isActive: tbl_user.isActive,
          })
          .from(tbl_user)
          .where(eq(tbl_user.id, facultyRow.userId))
          .limit(1);

        if (userInfo?.isActive) {
          visitorUserId = userInfo.id;
          visitorName   = userInfo.name;
          visitorType   = userInfo.userType;
          idNumber      = facultyRow.facultyNumber;
        }
      }
    }

    if (!visitorUserId) {
      return json(
        { success: false, error: 'Scanned ID not found or user is inactive.' },
        { status: 404 }
      );
    }

    // ── TIME IN ───────────────────────────────────────────────────────────────
    if (action === 'time_in') {
      // Prevent duplicate time-in: check for an open visit (no time_out yet)
      const [activeVisit] = await db
        .select({ id: tbl_library_visit.id, timeIn: tbl_library_visit.timeIn })
        .from(tbl_library_visit)
        .where(
          and(
            eq(tbl_library_visit.userId, visitorUserId),
            isNull(tbl_library_visit.timeOut)
          )
        )
        .orderBy(desc(tbl_library_visit.timeIn))
        .limit(1);

      if (activeVisit) {
        const ageMs       = Date.now() - activeVisit.timeIn.getTime();
        const eightHoursMs = 8 * 60 * 60 * 1000;

        if (ageMs < eightHoursMs) {
          return json({
            success: false,
            error: 'This visitor already has an active time-in. Please time out first.',
            lastCheckIn: activeVisit.timeIn.toISOString(),
          }, { status: 409 });
        }

        // Stale open visit: auto-close before allowing a new time-in
        await db
          .update(tbl_library_visit)
          .set({ timeOut: new Date(activeVisit.timeIn.getTime() + eightHoursMs) })
          .where(eq(tbl_library_visit.id, activeVisit.id));
      }

      const [newVisit] = await db
        .insert(tbl_library_visit)
        .values({
          userId:      visitorUserId,
          visitorName: visitorName,
          visitorType: visitorType,
          purpose:     (purpose || '').trim(),
          timeIn:      new Date(),
          timeOut:     null,
          createdAt:   new Date(),
        })
        .returning({
          id:     tbl_library_visit.id,
          timeIn: tbl_library_visit.timeIn,
        });

      return json({
        success:     true,
        action:      'time_in',
        message:     'Time in recorded successfully',
        timestamp:   newVisit.timeIn.toISOString(),
        visitId:     newVisit.id,
        visitorName,
        visitorType,
        idNumber,
      });
    }

    // ── TIME OUT ──────────────────────────────────────────────────────────────
    if (action === 'time_out') {
      const [activeVisit] = await db
        .select()
        .from(tbl_library_visit)
        .where(
          and(
            eq(tbl_library_visit.userId, visitorUserId),
            isNull(tbl_library_visit.timeOut)
          )
        )
        .orderBy(desc(tbl_library_visit.timeIn))
        .limit(1);

      if (!activeVisit) {
        return json({
          success: false,
          error: 'No active time-in found for this visitor. Please time in first.',
        }, { status: 404 });
      }

      const timeOutTimestamp = new Date();
      await db
        .update(tbl_library_visit)
        .set({ timeOut: timeOutTimestamp })
        .where(eq(tbl_library_visit.id, activeVisit.id));

      return json({
        success:     true,
        action:      'time_out',
        message:     'Time out recorded successfully',
        timestamp:   timeOutTimestamp.toISOString(),
        visitId:     activeVisit.id,
        timeIn:      activeVisit.timeIn.toISOString(),
        visitorName,
        visitorType,
        idNumber,
      });
    }

  } catch (error) {
    console.error('[db_save] Error:', error);

    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return json({ success: false, error: 'Duplicate entry detected.' }, { status: 409 });
    }

    return json({ success: false, error: 'Failed to save library visit' }, { status: 500 });
  }

  return json({ success: false, error: 'Unhandled request' }, { status: 500 });
};