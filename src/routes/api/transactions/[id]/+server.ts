import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { bookBorrowing, bookReservation } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!id) throw error(400, { message: 'Invalid transaction ID' });

  // Try to delete from borrowings first
  const deletedBorrowing = await db.delete(bookBorrowing).where(eq(bookBorrowing.id, id));
  if (deletedBorrowing.rowCount > 0) {
    return json({ success: true, message: 'Borrowing deleted' });
  }

  // Try to delete from reservations
  const deletedReservation = await db.delete(bookReservation).where(eq(bookReservation.id, id));
  if (deletedReservation.rowCount > 0) {
    return json({ success: true, message: 'Reservation deleted' });
  }

  throw error(404, { message: 'Transaction not found' });
};