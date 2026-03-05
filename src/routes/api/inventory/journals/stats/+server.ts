// src/routes/api/inventory/journals/stats/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_journal, tbl_staff, tbl_admin, tbl_super_admin, tbl_category, tbl_journal_borrowing } from '$lib/server/db/schema/schema.js';
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

    // Total journals
    const totalJournalsResult = await db.select({ count: count() }).from(tbl_journal);
    const totalJournals = Number(totalJournalsResult[0]?.count || 0);

    // Total available copies
    const availableCopiesResult = await db.select({ total: sqlSum(tbl_journal.availableCopies) }).from(tbl_journal);
    const availableCopies = Number(availableCopiesResult[0]?.total || 0);

    // Currently borrowed journals (active borrow transactions)
    let borrowedJournals = 0;
    try {
      const borrowedJournalsResult = await db
        .select({ count: count() })
        .from(tbl_journal_borrowing)
        .where(eq(tbl_journal_borrowing.status, 'borrowed'));
      borrowedJournals = Number(borrowedJournalsResult[0]?.count || 0);
    } catch (e) {
      console.warn('Could not fetch borrowed journals:', e);
      borrowedJournals = 0;
    }

    // Dynamic categories count (only journal categories)
    const categoriesCountResult = await db
      .select({ count: count() })
      .from(tbl_category)
      .where(eq(tbl_category.itemType, 'journal'));
    const categoriesCount = Number(categoriesCountResult[0]?.count || 0);

    // Journals with low availability (<3 copies)
    const lowStockResult = await db
      .select({ count: count() })
      .from(tbl_journal)
      .where(and(
        gt(tbl_journal.availableCopies, 0),
        lt(tbl_journal.availableCopies, 3)
      ));
    const lowStock = Number(lowStockResult[0]?.count || 0);

    // Out of stock journals
    const outOfStockResult = await db
      .select({ count: count() })
      .from(tbl_journal)
      .where(eq(tbl_journal.availableCopies, 0));
    const outOfStock = Number(outOfStockResult[0]?.count || 0);

    // Total physical copies (available + borrowed)
    const totalPhysicalCopies = Number(availableCopies) + borrowedJournals;

    // include convenience aliases so client code can use simpler names
    const utilization = totalPhysicalCopies > 0 ? Math.round((borrowedJournals / totalPhysicalCopies) * 100) : 0;
    const availability = totalJournals > 0 ? Math.round((availableCopies / totalJournals) * 100) : 0;

    return json({
      success: true,
      data: {
        totalJournals,
        totalBooks: totalJournals, // alias for UI consistency
        totalPhysicalCopies,
        availableCopies: Number(availableCopies),
        borrowedJournals,
        borrowedBooks: borrowedJournals, // alias for the borrowed card
        categoriesCount,
        lowStock,
        outOfStock,
        utilizationRate: utilization,
        availabilityRate: availability,
        // aliases used by the journal inventory page
        utilization,
        availability
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
