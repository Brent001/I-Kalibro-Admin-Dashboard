import { error } from '@sveltejs/kit';
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_user_restriction } from '$lib/server/db/schema/schema.js';

async function getActiveRestrictionTypes(userId: number) {
  const now = new Date();
  const restrictions = await db
    .select({ restrictionType: tbl_user_restriction.restrictionType })
    .from(tbl_user_restriction)
    .where(and(
      eq(tbl_user_restriction.userId, userId),
      eq(tbl_user_restriction.isActive, true),
      lte(tbl_user_restriction.startDate, now),
      or(isNull(tbl_user_restriction.endDate), gte(tbl_user_restriction.endDate, now)),
    ));

  return new Set(restrictions.map(restriction => restriction.restrictionType));
}

export async function assertUserCanBorrow(userId: number) {
  const restrictionTypes = await getActiveRestrictionTypes(userId);

  if (restrictionTypes.has('ban_borrowing') || restrictionTypes.has('temporary_suspension')) {
    throw error(403, { message: 'This member is currently restricted from borrowing.' });
  }
}

export async function assertUserCanReserve(userId: number) {
  const restrictionTypes = await getActiveRestrictionTypes(userId);

  if (restrictionTypes.has('ban_reservation') || restrictionTypes.has('temporary_suspension')) {
    throw error(403, { message: 'This member is currently restricted from making reservations.' });
  }
}