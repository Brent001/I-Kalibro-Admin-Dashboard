import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_user, tbl_student, tbl_faculty } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

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
      .select({ id: tbl_user.id, isActive: tbl_user.isActive })
      .from(tbl_user)
      .where(eq(tbl_user.id, userId))
      .limit(1);

    if (!userRow || !userRow.isActive) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const { content } = await request.json();
    if (!content || typeof content !== 'string') {
      return json({ error: 'Invalid QR content' }, { status: 400 });
    }

    // Interpret scanned content as student enrollmentNo or facultyNumber
    // Try student lookup
    const studentRows = await db
      .select({ userId: tbl_student.userId, enrollmentNo: tbl_student.enrollmentNo })
      .from(tbl_student)
      .where(eq(tbl_student.enrollmentNo, content))
      .limit(1);

    if (studentRows.length > 0) {
      const student = studentRows[0];
      const [userInfo] = await db.select({ id: tbl_user.id, username: tbl_user.username, name: tbl_user.name, userType: tbl_user.userType })
        .from(tbl_user)
        .where(eq(tbl_user.id, student.userId))
        .limit(1);
      if (userInfo) {
        return json({ success: true, processed: true, user: userInfo, type: 'student' });
      }
    }

    // Try faculty lookup
    const facultyRows = await db
      .select({ userId: tbl_faculty.userId, facultyNumber: tbl_faculty.facultyNumber })
      .from(tbl_faculty)
      .where(eq(tbl_faculty.facultyNumber, content))
      .limit(1);

    if (facultyRows.length > 0) {
      const faculty = facultyRows[0];
      const [userInfo] = await db.select({ id: tbl_user.id, username: tbl_user.username, name: tbl_user.name, userType: tbl_user.userType })
        .from(tbl_user)
        .where(eq(tbl_user.id, faculty.userId))
        .limit(1);
      if (userInfo) {
        return json({ success: true, processed: true, user: userInfo, type: 'faculty' });
      }
    }

    return json({ error: 'Scanned ID not found (not a student or faculty number)' }, { status: 400 });

  } catch (error) {
    console.error('QR processing API error:', error);
    return json(
      { error: 'Failed to process QR code' },
      { status: 500 }
    );
  }
};