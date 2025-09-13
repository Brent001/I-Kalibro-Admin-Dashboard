// File: src/routes/api/user/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { user, bookBorrowing, book } from '$lib/server/db/schema/schema.js';
import { eq, count } from 'drizzle-orm';

// GET: Return specific user details with issued books
export const GET: RequestHandler = async ({ params }) => {
  try {
    const userId = parseInt(params.id);

    if (isNaN(userId)) {
      throw error(400, { message: 'Invalid user ID' });
    }

    // Get user basic info
    const userInfo = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userInfo.length === 0) {
      throw error(404, { message: 'User not found' });
    }

    const u = userInfo[0];
    let memberDetails: any = {
      ...u,
      type: u.role === 'student' ? 'Student' : 'Faculty'
    };

    // Get issued books count
    const issuedBooksCount = await db
      .select({ count: count() })
      .from(bookBorrowing)
      .where(eq(bookBorrowing.userId, userId))
      .where(eq(bookBorrowing.status, 'borrowed'));

    // Get detailed issued books information
    const issuedBooks = await db
      .select({
        id: bookBorrowing.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        borrowDate: bookBorrowing.borrowDate,
        dueDate: bookBorrowing.dueDate,
        returnDate: bookBorrowing.returnDate,
        status: bookBorrowing.status
      })
      .from(bookBorrowing)
      .leftJoin(book, eq(bookBorrowing.bookId, book.id))
      .where(eq(bookBorrowing.userId, userId))
      .where(eq(bookBorrowing.status, 'borrowed'));

    memberDetails.booksCount = issuedBooksCount[0]?.count ?? 0;
    memberDetails.issuedBooks = issuedBooks;

    return json({
      success: true,
      data: memberDetails
    });

  } catch (err: any) {
    console.error('Error fetching user details:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};