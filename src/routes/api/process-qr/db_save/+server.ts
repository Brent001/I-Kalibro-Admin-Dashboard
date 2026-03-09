import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_user, tbl_library_visit } from '$lib/server/db/schema/schema.js';
import { eq, and, isNull, desc } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    // Verify authentication
    const token = cookies.get('client_token');
    if (!token) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;

    // Verify user exists and is active
    const [userRow] = await db
      .select({ id: tbl_user.id, isActive: tbl_user.isActive, username: tbl_user.username, name: tbl_user.name, userType: tbl_user.userType })
      .from(tbl_user)
      .where(eq(tbl_user.id, userId))
      .limit(1);

    if (!userRow || !userRow.isActive) {
      return json({ error: 'User not found or inactive' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const action = body.action; // 'time_in' or 'time_out'
    const username = body.username || userRow.username;
    const fullName = body.fullName || userRow.name;
    const visitorType = body.visitorType || userRow.userType || 'user';
    const purpose = body.purpose || ''; // Only for time_in

    if (!action || (action !== 'time_in' && action !== 'time_out')) {
      return json({ error: 'Invalid action. Must be "time_in" or "time_out"' }, { status: 400 });
    }

    // Handle TIME IN
    if (action === 'time_in') {
      // Check for recent time-in entries to prevent duplicates
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentEntry = await db
        .select()
        .from(tbl_library_visit)
        .where(
          and(
            eq(tbl_library_visit.userId, userId),
            isNull(tbl_library_visit.timeOut) // Only check entries without time out
          )
        )
        .orderBy(desc(tbl_library_visit.timeIn))
        .limit(1);

      if (recentEntry.length > 0) {
        const timeDiff = Date.now() - recentEntry[0].timeIn.getTime();
        if (timeDiff < 5 * 60 * 1000) {
          return json({
            error: 'You already have an active time-in entry. Please time out first.',
            lastCheckIn: recentEntry[0].timeIn
          }, { status: 409 });
        }
      }

      // Insert new library visit with purpose
      const [newVisit] = await db.insert(tbl_library_visit).values({
        userId,
        visitorName: fullName,
        visitorType,
        purpose,
        timeIn: new Date(),
        timeOut: null,
        createdAt: new Date()
      }).returning({
        id: tbl_library_visit.id,
        timeIn: tbl_library_visit.timeIn
      });

      return json({
        success: true,
        action: 'time_in',
        message: 'Time in recorded successfully',
        timestamp: newVisit.timeIn.toISOString(),
        visitId: newVisit.id
      });
    }

    // Handle TIME OUT
    if (action === 'time_out') {
      // Find the most recent active visit (without time out)
      const [activeVisit] = await db
        .select()
        .from(tbl_library_visit)
        .where(
          and(
            eq(tbl_library_visit.userId, userId),
            isNull(tbl_library_visit.timeOut)
          )
        )
        .orderBy(desc(tbl_library_visit.timeIn))
        .limit(1);

      if (!activeVisit) {
        return json({
          error: 'No active time-in entry found. Please time in first.',
        }, { status: 404 });
      }

      // Update the visit with time out
      const timeOutTimestamp = new Date();
      await db
        .update(tbl_library_visit)
        .set({ timeOut: timeOutTimestamp })
        .where(eq(tbl_library_visit.id, activeVisit.id));

      return json({
        success: true,
        action: 'time_out',
        message: 'Time out recorded successfully',
        timestamp: timeOutTimestamp.toISOString(),
        visitId: activeVisit.id,
        timeIn: activeVisit.timeIn.toISOString()
      });
    }
    
  } catch (error) {
    console.error('Library visit save API error:', error);
    
    // Handle JWT errors
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    // Handle database constraint errors
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return json({
        error: 'Duplicate entry detected.',
      }, { status: 409 });
    }
    
    return json(
      { error: 'Failed to save library visit' },
      { status: 500 }
    );
  }
  // Fallback: ensure a Response is always returned to satisfy RequestHandler type
  return json({ error: 'Unhandled request' }, { status: 500 });
};