import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { bookBorrowing, book, user } from '$lib/server/db/schema/schema.js';
import { eq, desc } from 'drizzle-orm';

// GET: List recent borrow transactions (last 50)
export const GET: RequestHandler = async () => {
  try {
    const transactions = await db
      .select({
        id: bookBorrowing.id,
        type: bookBorrowing.status,
        bookTitle: book.title,
        memberName: user.name,
        borrowDate: bookBorrowing.borrowDate,
        dueDate: bookBorrowing.dueDate,
        returnDate: bookBorrowing.returnDate,
        createdAt: bookBorrowing.createdAt
      })
      .from(bookBorrowing)
      .leftJoin(book, eq(bookBorrowing.bookId, book.id))
      .leftJoin(user, eq(bookBorrowing.userId, user.id))
      .orderBy(desc(bookBorrowing.createdAt))
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