import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { bookTransaction, book, user } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

// GET: List recent transactions (last 50)
export const GET: RequestHandler = async () => {
  try {
    const transactions = await db
      .select({
        id: bookTransaction.id,
        type: bookTransaction.transactionType,
        status: bookTransaction.status,
        bookTitle: book.title,
        memberName: user.name,
        issueDate: bookTransaction.issueDate,
        dueDate: bookTransaction.dueDate,
        actualReturnDate: bookTransaction.actualReturnDate,
        createdAt: bookTransaction.createdAt
      })
      .from(bookTransaction)
      .leftJoin(book, eq(bookTransaction.bookId, book.id))
      .leftJoin(user, eq(bookTransaction.userId, user.id))
      .orderBy(bookTransaction.createdAt, 'desc')
      .limit(50);

    return json({
      success: true,
      data: { transactions }
    });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    throw error(500, { message: 'Internal server error' });
  }
};