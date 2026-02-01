import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_qr_scan_log, tbl_user } from '$lib/server/db/schema/schema.js';
import { and, eq, gte, lte, lt, desc } from 'drizzle-orm';

// Utility: get date range for period
function getDateRange(period: string) {
  const now = new Date();
  let start: Date, end: Date;
  end = new Date(now);

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
    default:
      start = new Date(0); // all time
  }
  return { start, end };
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const period = url.searchParams.get('period') || 'month';
    const date = url.searchParams.get('date');
    const time = url.searchParams.get('time');

    const { start, end } = getDateRange(period);

    // Build filters
    let filters: any[] = [gte(tbl_qr_scan_log.scannedAt, start), lte(tbl_qr_scan_log.scannedAt, end)];

    if (date) {
      // Filter by specific date
      const dateObj = new Date(date);
      const nextDay = new Date(dateObj);
      nextDay.setDate(dateObj.getDate() + 1);
      filters = [
        gte(tbl_qr_scan_log.scannedAt, dateObj),
        lt(tbl_qr_scan_log.scannedAt, nextDay)
      ];
    }

    if (time) {
      // Filter by specific time (HH:mm)
      // Only works if date is also provided
      if (date) {
        const [hour, minute] = time.split(':').map(Number);
        const dateObj = new Date(date);
        dateObj.setHours(hour, minute, 0, 0);
        const nextMinute = new Date(dateObj);
        nextMinute.setMinutes(minute + 1);
        filters.push(gte(tbl_qr_scan_log.scannedAt, dateObj));
        filters.push(lt(tbl_qr_scan_log.scannedAt, nextMinute));
      }
    }

    // Query visits
    const visitsRaw = await db
      .select({
        id: tbl_qr_scan_log.id,
        userId: tbl_qr_scan_log.userId,
        scannedAt: tbl_qr_scan_log.scannedAt,
        deviceId: tbl_qr_scan_log.deviceId,
        qrType: tbl_qr_scan_log.qrType
      })
      .from(tbl_qr_scan_log)
      .where(and(...filters))
      .orderBy(desc(tbl_qr_scan_log.scannedAt));

    // Optionally join user info
    const visits = await Promise.all(
      visitsRaw.map(async (visit) => {
        let userInfo = null;
        if (visit.userId) {
          const userRes = await db
            .select({ name: tbl_user.name, email: tbl_user.email })
            .from(tbl_user)
            .where(eq(tbl_user.id, visit.userId));
          userInfo = userRes[0] || null;
        }
        
        // Calculate duration
        let duration = "—";
        if (visit.timeIn && visit.timeOut) {
          const diffMs = new Date(visit.timeOut).getTime() - new Date(visit.timeIn).getTime();
          const mins = Math.floor(diffMs / 60000);
          duration = mins > 0 ? `${mins} min` : "—";
        }
        
        return {
          ...visit,
          user: userInfo,
          duration
        };
      })
    );

    return json({
      success: true,
      visits
    });
  } catch (err) {
    console.error('Error fetching visit logs:', err);
    throw error(500, { message: 'Internal server error' });
  }
};