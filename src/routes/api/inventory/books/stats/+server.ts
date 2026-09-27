// src/routes/api/stats/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_book, tbl_staff, tbl_admin, tbl_super_admin, tbl_category, tbl_book_borrowing } from '$lib/server/db/schema/schema.js';
import { eq, count, sum as sqlSum, and, lt, gt } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

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
    
    // Check if session has been revoked
    if (await isSessionRevoked(token)) {
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;
    if (!userId) return null;
    
    // Check all admin roles
    try {
      const [superAdmin] = await db
        .select({
          id: tbl_super_admin.id,
          username: tbl_super_admin.username,
          email: tbl_super_admin.email,
          isActive: tbl_super_admin.isActive
        })
        .from(tbl_super_admin)
        .where(eq(tbl_super_admin.id, userId))
        .limit(1);
      if (superAdmin && superAdmin.isActive) {
        return {
          id: superAdmin.id,
          role: 'super_admin',
          username: superAdmin.username || '',
          email: superAdmin.email || ''
        };
      }
    } catch (e) {
      console.warn('Error checking super_admin:', e);
    }
    
    try {
      const [admin] = await db
        .select({
          id: tbl_admin.id,
          username: tbl_admin.username,
          email: tbl_admin.email,
          isActive: tbl_admin.isActive
        })
        .from(tbl_admin)
        .where(eq(tbl_admin.id, userId))
        .limit(1);
      if (admin && admin.isActive) {
        return {
          id: admin.id,
          role: 'admin',
          username: admin.username || '',
          email: admin.email || ''
        };
      }
    } catch (e) {
      console.warn('Error checking admin:', e);
    }
    
    try {
      const [staff] = await db
        .select({
          id: tbl_staff.id,
          username: tbl_staff.username,
          email: tbl_staff.email,
          isActive: tbl_staff.isActive
        })
        .from(tbl_staff)
        .where(eq(tbl_staff.id, userId))
        .limit(1);
      if (staff && staff.isActive) {
        return {
          id: staff.id,
          role: 'staff',
          username: staff.username || '',
          email: staff.email || ''
        };
      }
    } catch (e) {
      console.warn('Error checking staff:', e);
    }
    
    return null;
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
    const totalBooksResult = await db.select({ count: count() }).from(tbl_book);
    const totalBooks = Number(totalBooksResult[0]?.count || 0);

    // Total available copies
    const availableCopiesResult = await db.select({ total: sqlSum(tbl_book.availableCopies) }).from(tbl_book);
    const availableCopies = Number(availableCopiesResult[0]?.total || 0);

    // Currently borrowed books (active borrow transactions)
    let borrowedBooks = 0;
    try {
      const borrowedBooksResult = await db
        .select({ count: count() })
        .from(tbl_book_borrowing)
        .where(eq(tbl_book_borrowing.status, 'borrowed'));
      borrowedBooks = Number(borrowedBooksResult[0]?.count || 0);
    } catch (e) {
      console.warn('Could not fetch borrowed books:', e);
      borrowedBooks = 0;
    }

    // Dynamic categories count
    const categoriesCountResult = await db.select({ count: count() }).from(tbl_category);
    const categoriesCount = Number(categoriesCountResult[0]?.count || 0);

    // Books with low availability (<3 copies)
    const lowStockResult = await db
      .select({ count: count() })
      .from(tbl_book)
      .where(and(
        gt(tbl_book.availableCopies, 0),
        lt(tbl_book.availableCopies, 3)
      ));
    const lowStock = Number(lowStockResult[0]?.count || 0);

    // Out of stock books
    const outOfStockResult = await db
      .select({ count: count() })
      .from(tbl_book)
      .where(eq(tbl_book.availableCopies, 0));
    const outOfStock = Number(outOfStockResult[0]?.count || 0);

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
  } catch (err: any) {
    console.error('Error fetching statistics:', err);
    if (err?.status) {
      throw err;
    }
    throw error(500, { message: 'Internal server error: ' + (err?.message || 'Unknown error') });
  }
};