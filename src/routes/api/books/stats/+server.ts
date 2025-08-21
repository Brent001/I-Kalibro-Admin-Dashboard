// src/routes/api/stats/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { book, account, issuedBook } from '$lib/server/db/schema/schema.js';
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
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    // Get total books count
    const totalBooksResult = await db
      .select({ count: count() })
      .from(book);
    const totalBooks = totalBooksResult[0]?.count || 0;

    // Get total available copies
    const availableCopiesResult = await db
      .select({ total: sum(book.copiesAvailable) })
      .from(book);
    const availableCopies = availableCopiesResult[0]?.total || 0;

    // Get currently borrowed books (books with no return date)
    const borrowedBooksResult = await db
      .select({ count: count() })
      .from(issuedBook)
      .where(isNull(issuedBook.returnDate));
    const borrowedBooks = borrowedBooksResult[0]?.count || 0;

    // Get unique categories count (this would work if you have a category field)
    // For now, we'll use a static count
    const categoriesCount = 12; // Based on the categories we defined earlier

    // Get books with low availability (less than 3 copies)
    const lowStockResult = await db
      .select({ count: count() })
      .from(book)
      .where(gt(book.copiesAvailable, 0));
    const availableBooks = lowStockResult[0]?.count || 0;

    // Get books that are completely out of stock
    const outOfStockResult = await db
      .select({ count: count() })
      .from(book)
      .where(eq(book.copiesAvailable, 0));
    const outOfStock = outOfStockResult[0]?.count || 0;

    // Calculate total physical copies (you might want to add a totalCopies field to track this)
    // For now, we'll estimate based on available + borrowed
    const totalPhysicalCopies = Number(availableCopies) + borrowedBooks;

    return json({
      success: true,
      data: {
        totalBooks,
        totalPhysicalCopies,
        availableCopies: Number(availableCopies),
        borrowedBooks,
        categoriesCount,
        availableBooks,
        outOfStock,
        // Additional useful stats
        utilizationRate: totalPhysicalCopies > 0 ? 
          Math.round((borrowedBooks / totalPhysicalCopies) * 100) : 0,
        availabilityRate: totalBooks > 0 ? 
          Math.round((availableBooks / totalBooks) * 100) : 0
      }
    });

  } catch (err) {
    console.error('Error fetching statistics:', err);
    
    if (err.status) {
      throw err;
    }

    throw error(500, { message: 'Internal server error' });
  }
};