import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { bookBorrowing, bookReturn, book } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params }) => {
  try {
    const borrowingId = parseInt(params.id);
    if (isNaN(borrowingId)) throw error(400, { message: 'Invalid borrowing ID' });

    // Get borrowing record
    const borrowing = await db
      .select()
      .from(bookBorrowing)
      .where(eq(bookBorrowing.id, borrowingId))
      .limit(1);

    if (!borrowing.length) throw error(404, { message: 'Borrowing record not found' });

    const b = borrowing[0];

    // Insert into bookReturn
    await db.insert(bookReturn).values({
      borrowingId: b.id,
      userId: b.userId,
      bookId: b.bookId,
      returnDate: new Date(),
      finePaid: b.fine ?? 0,
      remarks: 'Returned via API'
    });

    // Update status in bookBorrowing instead of deleting
    await db
      .update(bookBorrowing)
      .set({ status: 'returned', returnDate: new Date() })
      .where(eq(bookBorrowing.id, borrowingId));

    // Optionally, increment book availability
    await db
      .update(book)
      .set({ copiesAvailable: (b.copiesAvailable ?? 0) + 1 })
      .where(eq(book.id, b.bookId));

    return json({ success: true, message: 'Book returned and record moved to book_return.' });
  } catch (err: any) {
    console.error('Return error:', err);
    throw error(500, { message: 'Failed to process return.' });
  }
};