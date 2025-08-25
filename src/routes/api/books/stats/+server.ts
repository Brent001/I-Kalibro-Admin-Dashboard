// src/routes/api/stats/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { book, account, category, bookTransaction } from '$lib/server/db/schema/schema.js';
import { eq, count, sum, gt, isNull } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
  id: number;
  role: string;
  username: string;
  email: string;
}

async function authenticateUser(request: Request): Promise<AuthenticatedUser | null> {
  try {
    let token: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map(c => c.split('='))
        );
        token = cookies.token;
      }
    }
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;
    if (!userId) return null;
    const [user] = await db
      .select({
        id: account.id,
        username: account.username,
        email: account.email,
        role: account.role,
        isActive: account.isActive,
        tokenVersion: account.tokenVersion
      })
      .from(account)
      .where(eq(account.id, userId))
      .limit(1);
    if (!user || !user.isActive) return null;
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return null;
    }
    return {
      id: user.id,
      role: user.role || '',
      username: user.username || '',
      email: user.email || ''
    };
  } catch (err) {
    console.error('Authentication error:', err);
    return null;
  }
}

export const GET: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) throw error(401, { message: 'Unauthorized' });

    // Total books
    const totalBooksResult = await db.select({ count: count() }).from(book);
    const totalBooks = totalBooksResult[0]?.count || 0;

    // Total available copies
    const availableCopiesResult = await db.select({ total: sum(book.copiesAvailable) }).from(book);
    const availableCopies = availableCopiesResult[0]?.total || 0;

    // Currently borrowed books (active borrow transactions)
    const borrowedBooksResult = await db
      .select({ count: count() })
      .from(bookTransaction)
      .where(eq(bookTransaction.transactionType, 'borrow'))
      .where(eq(bookTransaction.status, 'active'));
    const borrowedBooks = borrowedBooksResult[0]?.count || 0;

    // Dynamic categories count
    const categoriesCountResult = await db.select({ count: count() }).from(category);
    const categoriesCount = categoriesCountResult[0]?.count || 0;

    // Books with low availability (<3 copies)
    const lowStockResult = await db
      .select({ count: count() })
      .from(book)
      .where(gt(book.copiesAvailable, 0))
      .where(gt(3, book.copiesAvailable));
    const lowStock = lowStockResult[0]?.count || 0;

    // Out of stock books
    const outOfStockResult = await db
      .select({ count: count() })
      .from(book)
      .where(eq(book.copiesAvailable, 0));
    const outOfStock = outOfStockResult[0]?.count || 0;

    // Total physical copies (available + borrowed)
    const totalPhysicalCopies = Number(availableCopies) + borrowedBooks;

    return json({
      success: true,
      data: {
        totalBooks,
        totalPhysicalCopies,
        availableCopies: Number(availableCopies),
        borrowedBooks,
        categoriesCount,
        lowStock,
        outOfStock,
        utilizationRate: totalPhysicalCopies > 0 ? Math.round((borrowedBooks / totalPhysicalCopies) * 100) : 0,
        availabilityRate: totalBooks > 0 ? Math.round((availableCopies / totalBooks) * 100) : 0
      }
    });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};