import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import {
  tbl_library_visit,
  tbl_user,
  tbl_student,
  tbl_faculty
} from '$lib/server/db/schema/schema.js';
import { and, eq, gte, lt, lte, desc, sql } from 'drizzle-orm';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (period) {
    case 'day':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      break;
    case 'year':
      start = new Date(now);
      start.setDate(now.getDate() - 365);
      break;
    default: // 'all'
      start = new Date(0);
  }

  return { start, end };
}

function formatDuration(timeIn: Date | null, timeOut: Date | null): string {
  if (!timeIn || !timeOut) return '—';
  const diffMs = new Date(timeOut).getTime() - new Date(timeIn).getTime();
  if (diffMs <= 0) return '—';
  const mins  = Math.floor(diffMs / 60_000);
  const hours = Math.floor(mins / 60);
  const rem   = mins % 60;
  return hours > 0 ? `${hours}h ${rem}m` : `${mins} min`;
}

// ─── GET /api/reports/visits ──────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url }) => {
  try {
    const period = url.searchParams.get('period') || 'month';
    const dateParam = url.searchParams.get('date');   // YYYY-MM-DD
    const timeParam = url.searchParams.get('time');   // HH:mm  (only used with date)

    // ── Build time-range filters ──────────────────────────────────────────────

    let filters: ReturnType<typeof gte>[] = [];

    if (dateParam) {
      // Specific calendar day (optionally narrowed to a single minute)
      const dayStart = new Date(dateParam);
      dayStart.setHours(0, 0, 0, 0);

      if (timeParam) {
        const [hour, minute] = timeParam.split(':').map(Number);
        const minuteStart = new Date(dayStart);
        minuteStart.setHours(hour, minute, 0, 0);
        const minuteEnd = new Date(minuteStart);
        minuteEnd.setMinutes(minute + 1);
        filters = [
          gte(tbl_library_visit.timeIn, minuteStart),
          lt(tbl_library_visit.timeIn, minuteEnd)
        ];
      } else {
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
        filters = [
          gte(tbl_library_visit.timeIn, dayStart),
          lt(tbl_library_visit.timeIn, dayEnd)
        ];
      }
    } else {
      // Period-based range
      const { start, end } = getDateRange(period);
      filters = [
        gte(tbl_library_visit.timeIn, start),
        lte(tbl_library_visit.timeIn, end)
      ];
    }

    // ── Single query: visit + user + student/faculty identifier ──────────────
    //
    // We LEFT JOIN tbl_user so named-user visits are enriched, then LEFT JOIN
    // tbl_student and tbl_faculty to surface the enrollment / faculty number as
    // `idNumber` on the returned row.

    const rows = await db
      .select({
        // Visit columns
        id:          tbl_library_visit.id,
        userId:      tbl_library_visit.userId,
        visitorName: tbl_library_visit.visitorName,
        visitorType: tbl_library_visit.visitorType,
        purpose:     tbl_library_visit.purpose,
        timeIn:      tbl_library_visit.timeIn,
        timeOut:     tbl_library_visit.timeOut,
        createdAt:   tbl_library_visit.createdAt,

        // User columns (null when walk-in / userId is null)
        userName:    tbl_user.name,
        userEmail:   tbl_user.email,
        userType:    tbl_user.userType,

        // Identifiers from sub-tables (coalesce → one idNumber field)
        enrollmentNo:  tbl_student.enrollmentNo,
        facultyNumber: tbl_faculty.facultyNumber,
      })
      .from(tbl_library_visit)
      .leftJoin(tbl_user,    eq(tbl_user.id,    tbl_library_visit.userId))
      .leftJoin(tbl_student, eq(tbl_student.userId, tbl_library_visit.userId))
      .leftJoin(tbl_faculty, eq(tbl_faculty.userId, tbl_library_visit.userId))
      .where(and(...filters))
      .orderBy(desc(tbl_library_visit.timeIn));

    // ── Shape the response ────────────────────────────────────────────────────

    const visits = rows.map((row) => {
      // Prefer the linked user's name if available, otherwise use the stored
      // visitor name (walk-in guests, externals, etc.)
      const resolvedName = row.userName ?? row.visitorName ?? null;

      // Resolve the identifier: students → enrollment no, faculty → faculty no,
      // walk-ins without a linked user → nothing useful to show
      const idNumber = row.enrollmentNo ?? row.facultyNumber ?? null;

      // Derive status from whether the visitor has checked out
      const status = row.timeOut ? 'checked_out' : 'checked_in';

      return {
        id:          row.id,
        userId:      row.userId,
        visitorName: resolvedName,
        visitorType: row.visitorType,
        idNumber,
        purpose:     row.purpose ?? '',
        timeIn:      row.timeIn,
        timeOut:     row.timeOut,
        status,
        duration:    formatDuration(row.timeIn, row.timeOut),
        createdAt:   row.createdAt,

        // Keep nested user object for any legacy consumers
        user: row.userName
          ? { name: row.userName, email: row.userEmail }
          : null,
      };
    });

    return json({ success: true, visits });

  } catch (err) {
    console.error('[GET /api/reports/visits] Error:', err);
    throw error(500, { message: 'Internal server error' });
  }
};