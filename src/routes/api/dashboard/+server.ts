import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { book, user, bookTransaction } from '$lib/server/db/schema/schema.js';
import { eq, count, gt } from 'drizzle-orm';

// GET: Dashboard summary stats
export const GET: RequestHandler = async () => {
  try {
    // Total books
    const [{ count: totalBooks }] = await db.select({ count: count() }).from(book);

    // Active members (students + faculty)
    const [{ count: activeMembers }] = await db
      .select({ count: count() })
      .from(user)
      .where(eq(user.isActive, true));

    // Books borrowed (active borrow transactions)
    const [{ count: booksBorrowed }] = await db
      .select({ count: count() })
      .from(bookTransaction)
      .where(eq(bookTransaction.transactionType, 'borrow'))
      .where(eq(bookTransaction.status, 'active'));

    // Overdue books (active borrow transactions where dueDate < today and actualReturnDate is null)
    const today = new Date();
    const [{ count: overdueBooks }] = await db
      .select({ count: count() })
      .from(bookTransaction)
      .where(eq(bookTransaction.transactionType, 'borrow'))
      .where(eq(bookTransaction.status, 'active'))
      .where(gt(today, bookTransaction.dueDate))
      .where(eq(bookTransaction.actualReturnDate, null));

    // Recent activity (last 10 transactions)
    const recentActivity = await db
      .select({
        id: bookTransaction.id,
        type: bookTransaction.transactionType,
        bookTitle: book.title,
        memberName: user.name,
        time: bookTransaction.createdAt
      })
      .from(bookTransaction)
      .leftJoin(book, eq(bookTransaction.bookId, book.id))
      .leftJoin(user, eq(bookTransaction.userId, user.id))
      .orderBy(bookTransaction.createdAt)
      .limit(10);

    return json({
      success: true,
      data: {
        totalBooks: Number(totalBooks) || 0,
        activeMembers: Number(activeMembers) || 0,
        booksBorrowed: Number(booksBorrowed) || 0,
        overdueBooks: Number(overdueBooks) || 0,
        recentActivity
      }
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    throw error(500, { message: 'Internal server error' });
  }
};