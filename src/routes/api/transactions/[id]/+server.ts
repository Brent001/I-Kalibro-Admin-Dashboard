import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import {
  tbl_book_borrowing,
  tbl_magazine_borrowing,
  tbl_thesis_borrowing,
  tbl_book_reservation,
  tbl_magazine_reservation,
  tbl_thesis_reservation,
  tbl_journal_borrowing
} from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!id) throw error(400, { message: 'Invalid transaction ID' });

  try {
    // Check and cancel/delete from borrow request tables first
    const [bookReq] = await db.select().from(tbl_book_reservation).where(eq(tbl_book_reservation.id, id)).limit(1);
    if (bookReq) {
      await db.update(tbl_book_reservation).set({ status: 'cancelled' }).where(eq(tbl_book_reservation.id, id));
      return json({ success: true, message: 'Book reservation cancelled' });
    }

    const [magReq] = await db.select().from(tbl_magazine_reservation).where(eq(tbl_magazine_reservation.id, id)).limit(1);
    if (magReq) {
      await db.update(tbl_magazine_reservation).set({ status: 'cancelled' }).where(eq(tbl_magazine_reservation.id, id));
      return json({ success: true, message: 'Magazine reservation cancelled' });
    }

    const [thesisReq] = await db.select().from(tbl_thesis_reservation).where(eq(tbl_thesis_reservation.id, id)).limit(1);
    if (thesisReq) {
      await db.update(tbl_thesis_reservation).set({ status: 'cancelled' }).where(eq(tbl_thesis_reservation.id, id));
      return json({ success: true, message: 'Thesis reservation cancelled' });
    }

    

    // If not a reservation, check and delete borrowings
    const book = await db.select().from(tbl_book_borrowing).where(eq(tbl_book_borrowing.id, id)).limit(1);
    if (book.length) {
      await db.delete(tbl_book_borrowing).where(eq(tbl_book_borrowing.id, id));
      return json({ success: true, message: 'Book borrowing deleted' });
    }

    // Magazine
    const mag = await db.select().from(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.id, id)).limit(1);
    if (mag.length) {
      await db.delete(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.id, id));
      return json({ success: true, message: 'Magazine borrowing deleted' });
    }

    // Thesis
    const thesis = await db.select().from(tbl_thesis_borrowing).where(eq(tbl_thesis_borrowing.id, id)).limit(1);
    if (thesis.length) {
      await db.delete(tbl_thesis_borrowing).where(eq(tbl_thesis_borrowing.id, id));
      return json({ success: true, message: 'Thesis borrowing deleted' });
    }

    // Journal
    const journal = await db.select().from(tbl_journal_borrowing).where(eq(tbl_journal_borrowing.id, id)).limit(1);
    if (journal.length) {
      await db.delete(tbl_journal_borrowing).where(eq(tbl_journal_borrowing.id, id));
      return json({ success: true, message: 'Journal borrowing deleted' });
    }

    throw error(404, { message: 'Transaction not found' });
  } catch (err: any) {
    console.error('DELETE /api/transactions/[id] error:', err);
    throw error(500, { message: 'Failed to delete transaction' });
  }
};