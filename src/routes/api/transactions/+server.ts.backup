import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { bookBorrowing, bookReservation, book, user } from '$lib/server/db/schema/schema.js';
import { eq, desc } from 'drizzle-orm';

// GET: List all transactions (borrowings + reservations)
export const GET: RequestHandler = async () => {
  try {
    // Fetch borrowing transactions
    const borrowings = await db
      .select({
        id: bookBorrowing.id,
        type: bookBorrowing.status,
        bookId: book.bookId,
        bookTitle: book.title,
        memberId: user.username,
        memberName: user.name,
        borrowDate: bookBorrowing.borrowDate,
        dueDate: bookBorrowing.dueDate,
        returnDate: bookBorrowing.returnDate,
        status: bookBorrowing.status,
        createdAt: bookBorrowing.createdAt
      })
      .from(bookBorrowing)
      .leftJoin(book, eq(bookBorrowing.bookId, book.id))
      .leftJoin(user, eq(bookBorrowing.userId, user.id))
      .orderBy(desc(bookBorrowing.createdAt))
      .limit(50);

    // Fetch reservation transactions
    const reservations = await db
      .select({
        id: bookReservation.id,
        type: bookReservation.status,
        bookId: book.bookId,
        bookTitle: book.title,
        memberId: user.username,
        memberName: user.name,
        borrowDate: bookReservation.reservationDate,
        dueDate: bookReservation.reservationDate,
        returnDate: '' as unknown as Date, // Fix: Use empty string as Date
        status: bookReservation.status,
        createdAt: bookReservation.createdAt
      })
      .from(bookReservation)
      .leftJoin(book, eq(bookReservation.bookId, book.id))
      .leftJoin(user, eq(bookReservation.userId, user.id))
      .orderBy(desc(bookReservation.createdAt))
      .limit(50);

    // Combine and mark transaction types
    const allTransactions = [
      ...borrowings.map(b => ({ ...b, type: 'Borrow' })),
      ...reservations.map(r => ({ ...r, type: 'Reserve' }))
    ].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return json({
      success: true,
      data: { transactions: allTransactions }
    });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    throw error(500, { message: 'Internal server error' });
  }
};