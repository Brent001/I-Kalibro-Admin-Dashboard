import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_book_borrowing, tbl_magazine_borrowing, tbl_research_borrowing, tbl_multimedia_borrowing } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!id) throw error(400, { message: 'Invalid transaction ID' });

  // Try to delete from all borrowing tables
  try {
    // Try book borrowing
    let result = await db.delete(tbl_book_borrowing).where(eq(tbl_book_borrowing.id, id));
    if ((result.rowCount ?? 0) > 0) {
      return json({ success: true, message: 'Book borrowing deleted' });
    }

    // Try magazine borrowing
    result = await db.delete(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.id, id));
    if ((result.rowCount ?? 0) > 0) {
      return json({ success: true, message: 'Magazine borrowing deleted' });
    }

    // Try research borrowing
    result = await db.delete(tbl_research_borrowing).where(eq(tbl_research_borrowing.id, id));
    if ((result.rowCount ?? 0) > 0) {
      return json({ success: true, message: 'Research document borrowing deleted' });
    }

    // Try multimedia borrowing
    result = await db.delete(tbl_multimedia_borrowing).where(eq(tbl_multimedia_borrowing.id, id));
    if ((result.rowCount ?? 0) > 0) {
      return json({ success: true, message: 'Multimedia borrowing deleted' });
    }

    throw error(404, { message: 'Transaction not found' });
  } catch (err: any) {
    console.error('DELETE /api/transactions/[id] error:', err);
    throw error(500, { message: 'Failed to delete transaction' });
  }
};