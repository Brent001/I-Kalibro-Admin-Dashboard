import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { verifyToken } from '$lib/server/db/auth.js';
import { tbl_user, tbl_user_restriction } from '$lib/server/db/schema/schema.js';

const restrictionTypes = ['ban_borrowing', 'ban_reservation', 'temporary_suspension'] as const;

async function getStaffSession(cookies: { get: (name: string) => string | undefined }) {
  const token = cookies.get('token');
  const user = token ? await verifyToken(token) : null;
  return user?.userType === 'staff' ? user : null;
}

function parseUserId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const GET: RequestHandler = async ({ params, cookies }) => {
  const staff = await getStaffSession(cookies);
  if (!staff) return json({ success: false, message: 'Staff authentication required' }, { status: 403 });

  const userId = parseUserId(params.id);
  if (!userId) return json({ success: false, message: 'Invalid user ID' }, { status: 400 });

  try {
    const now = new Date();
    const restrictions = await db
      .select()
      .from(tbl_user_restriction)
      .where(and(
        eq(tbl_user_restriction.userId, userId),
        eq(tbl_user_restriction.isActive, true),
        lte(tbl_user_restriction.startDate, now),
        or(isNull(tbl_user_restriction.endDate), gte(tbl_user_restriction.endDate, now))
      ))
      .orderBy(desc(tbl_user_restriction.createdAt));

    return json({ success: true, restrictions });
  } catch (err) {
    console.error('Failed to fetch user restrictions:', err);
    return json({ success: false, message: 'Failed to load restrictions' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const staff = await getStaffSession(cookies);
  if (!staff) return json({ success: false, message: 'Staff authentication required' }, { status: 403 });

  const userId = parseUserId(params.id);
  if (!userId) return json({ success: false, message: 'Invalid user ID' }, { status: 400 });

  try {
    const body = await request.json();
    const { restrictionType, reason, endDate } = body;
    if (!restrictionTypes.includes(restrictionType)) {
      return json({ success: false, message: 'Choose a valid restriction type' }, { status: 400 });
    }
    if (reason !== undefined && reason !== null && typeof reason !== 'string') {
      return json({ success: false, message: 'Reason must be text' }, { status: 400 });
    }

    const [targetUser] = await db.select({ id: tbl_user.id }).from(tbl_user).where(eq(tbl_user.id, userId)).limit(1);
    if (!targetUser) return json({ success: false, message: 'Member not found' }, { status: 404 });

    let parsedEndDate: Date | null = null;
    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (Number.isNaN(parsedEndDate.getTime()) || parsedEndDate <= new Date()) {
        return json({ success: false, message: 'End date must be in the future' }, { status: 400 });
      }
    }

    const [restriction] = await db.insert(tbl_user_restriction).values({
      userId,
      restrictionType,
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
      startDate: new Date(),
      endDate: parsedEndDate,
      appliedBy: staff.id,
      isActive: true
    }).returning();

    return json({ success: true, restriction }, { status: 201 });
  } catch (err) {
    console.error('Failed to add user restriction:', err);
    return json({ success: false, message: 'Failed to add restriction' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, request, cookies }) => {
  const staff = await getStaffSession(cookies);
  if (!staff) return json({ success: false, message: 'Staff authentication required' }, { status: 403 });

  const userId = parseUserId(params.id);
  if (!userId) return json({ success: false, message: 'Invalid user ID' }, { status: 400 });

  try {
    const body = await request.json();
    const restrictionId = Number(body.restrictionId);
    if (!Number.isInteger(restrictionId) || restrictionId <= 0) {
      return json({ success: false, message: 'Invalid restriction ID' }, { status: 400 });
    }

    const [restriction] = await db.update(tbl_user_restriction)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(tbl_user_restriction.id, restrictionId),
        eq(tbl_user_restriction.userId, userId),
        eq(tbl_user_restriction.isActive, true)
      ))
      .returning({ id: tbl_user_restriction.id });

    if (!restriction) return json({ success: false, message: 'Active restriction not found' }, { status: 404 });
    return json({ success: true });
  } catch (err) {
    console.error('Failed to remove user restriction:', err);
    return json({ success: false, message: 'Failed to remove restriction' }, { status: 500 });
  }
};