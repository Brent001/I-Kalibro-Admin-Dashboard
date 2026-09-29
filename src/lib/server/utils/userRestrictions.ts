import { error } from '@sveltejs/kit';
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_user_restriction } from '$lib/server/db/schema/schema.js';

export async function assertUserCanBorrow(userId: number) {
  const now = new Date();
  const [restriction] = await db
    .select({ restrictionType: tbl_user_restriction.restrictionType })
    .from(tbl_user_restriction)
    .where(and(
      eq(tbl_user_restriction.userId, userId),
      eq(tbl_user_restriction.isActive, true),
      lte(tbl_user_restriction.startDate, now),
      or(isNull(tbl_user_restriction.endDate), gte(tbl_user_restriction.endDate, now)),
      or(
        eq(tbl_user_restriction.restrictionType, 'ban_borrowing'),
        eq(tbl_user_restriction.restrictionType, 'temporary_suspension')
      )
    ))
    .limit(1);

  if (restriction) {
    throw error(403, { message: 'This member is currently restricted from borrowing.' });
  }
}