import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { bookReservation, bookBorrowing } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!id) throw error(400, { message: 'Invalid reservation ID' });

  // Find reservation
  const [reservation] = await db
    .select()
    .from(bookReservation)
    .where(eq(bookReservation.id, id))
    .limit(1);

  if (!reservation) throw error(404, { message: 'Reservation not found' });
  if (reservation.status !== 'active') throw error(400, { message: 'Reservation not active' });

  // Create borrowing record
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(today.getDate() + 1);
  dueDate.setHours(8, 0, 0, 0); // Set to 8:00 AM

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
