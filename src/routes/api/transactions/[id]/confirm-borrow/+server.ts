import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { bookReservation, bookBorrowing, staffAccount } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Extract token from request
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookies = request.headers.get('Cookie');
  if (cookies) {
    const tokenMatch = cookies.match(/token=([^;]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
  }
  return null;
}

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  // Get token from cookies or Authorization header
  const token = cookies.get('token') || extractToken(request);

  if (!token) {
    throw error(401, { message: 'Not authenticated. Please log in.' });
  }

  // Check if session has been revoked
  if (await isSessionRevoked(token)) {
    throw error(401, { message: 'Your session has been revoked. Please log in again.' });
  }

  // Verify JWT token
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw error(401, { message: 'Invalid or expired token. Please log in again.' });
  }

  const staffId = decoded.userId || decoded.id;
  if (!staffId) {
    throw error(401, { message: 'Invalid token payload.' });
  }

  // Get staff account from database
  const staffDb = await db
    .select()
    .from(staffAccount)
    .where(eq(staffAccount.id, staffId))
    .limit(1);

  if (!staffDb.length || !staffDb[0].isActive) {
    throw error(401, { message: 'Staff account not found or inactive.' });
  }

  const staff = staffDb[0];

  // Parse request body
  let customDueDate: string | undefined;
  let method: string | undefined;
  let password: string | undefined;
  try {
    const body = await request.json();
    customDueDate = body.dueDate;
    method = body.method;
    password = body.password;
  } catch {
    throw error(400, { message: 'Invalid request body.' });
  }

  // Require password verification
  if (method !== "password" || !password || !password.trim()) {
    throw error(400, { message: 'Password verification required.' });
  }
  const valid = await bcrypt.compare(password, staff.password);
  if (!valid) {
    throw error(401, { message: 'Invalid staff password.' });
  }

  // Find reservation
  const id = Number(params.id);
  if (!id) throw error(400, { message: 'Invalid reservation ID' });

  const [reservation] = await db
    .select()
    .from(bookReservation)
    .where(eq(bookReservation.id, id))
    .limit(1);

  if (!reservation) throw error(404, { message: 'Reservation not found' });
  if (reservation.status !== 'active') throw error(400, { message: 'Reservation not active' });

  // Create borrowing record
  const today = new Date();
  let dueDate: Date;
  if (customDueDate) {
    dueDate = new Date(customDueDate);
  } else {
    dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 1);
    dueDate.setHours(8, 0, 0, 0); // Set to 8:00 AM
  }

  await db.insert(bookBorrowing).values({
    userId: reservation.userId,
    bookId: reservation.bookId,
    borrowDate: today,
    dueDate: dueDate,
    status: 'borrowed'
  });

  // Delete reservation after borrowing
  await db
    .delete(bookReservation)
    .where(eq(bookReservation.id, id));

  return json({ success: true });
};
