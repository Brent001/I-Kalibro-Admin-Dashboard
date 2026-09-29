import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { sql, desc } from 'drizzle-orm';
import { verifyToken } from '$lib/server/db/auth.js';
import { db } from '$lib/server/db/index.js';
import { redisClient, isRedisConfigured } from '$lib/server/db/cache.js';
import { tbl_security_log } from '$lib/server/db/schema/schema.js';
import { updateAllOverdueFines } from '$lib/server/utils/fineCalculation.js';

async function requireAdmin(cookies: { get(name: string): string | undefined }) {
  const token = cookies.get('token');
  const user = token ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin'].includes(user.userType)) throw error(403, 'Administrator access required');
  return user;
}

async function recordMaintenance(user: { id: number; userType: string }, action: string) {
  try {
    await db.insert(tbl_security_log).values({
      userId: user.id,
      userType: user.userType,
      eventType: `maintenance_${action}`.slice(0, 30)
    });
  } catch (logError) {
    console.warn('[maintenance] Could not write audit log:', logError);
  }
}

async function clearApplicationCache() {
  if (!isRedisConfigured()) return { cleared: 0, configured: false };

  const keys = [
    ...(await redisClient.keys('user:*:profile')),
    ...(await redisClient.keys('user:*:permissions'))
  ];
  await Promise.all(keys.map(key => redisClient.del(key)));
  return { cleared: keys.length, configured: true };
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const user = await requireAdmin(cookies);
  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (!['optimize_database', 'clear_cache', 'export_logs', 'rebuild_qr_index', 'recalculate_fines'].includes(action)) {
    throw error(400, 'Unknown maintenance action');
  }

  if (action === 'optimize_database') {
    await db.execute(sql`ANALYZE`);
    await recordMaintenance(user, action);
    return json({ success: true, message: 'Database statistics refreshed.' });
  }

  if (action === 'clear_cache') {
    const result = await clearApplicationCache();
    await recordMaintenance(user, action);
    return json({ success: true, message: result.configured ? `${result.cleared} application cache entries cleared.` : 'Redis is not configured; no cache entries were cleared.', ...result });
  }

  if (action === 'recalculate_fines') {
    const updates = await updateAllOverdueFines();
    await recordMaintenance(user, action);
    return json({ success: true, message: `${updates.length} overdue borrowing records recalculated.`, updated: updates.length });
  }

  if (action === 'rebuild_qr_index') {
    await db.execute(sql`ANALYZE tbl_book_copy`);
    await db.execute(sql`ANALYZE tbl_magazine_copy`);
    await db.execute(sql`ANALYZE tbl_thesis_copy`);
    await db.execute(sql`ANALYZE tbl_journal_copy`);
    await recordMaintenance(user, action);
    return json({ success: true, message: 'QR lookup statistics refreshed for all copy tables.' });
  }

  const rows = await db.select().from(tbl_security_log).orderBy(desc(tbl_security_log.timestamp)).limit(500);
  const header = ['id', 'userType', 'userId', 'eventType', 'ipAddress', 'userAgent', 'timestamp'];
  const csv = [
    header.join(','),
    ...rows.map(row => [row.id, row.userType, row.userId, row.eventType, row.ipAddress, row.userAgent, row.timestamp].map(csvCell).join(','))
  ].join('\n');
  await recordMaintenance(user, action);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="security-logs-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
};
