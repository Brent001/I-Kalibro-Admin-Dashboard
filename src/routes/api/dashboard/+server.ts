import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { book, user, bookBorrowing } from '$lib/server/db/schema/schema.js';
import { eq, count, lt, and, isNull, desc, sql } from 'drizzle-orm';
import { encryptData } from '$lib/utils/encryption.js';

// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
let cachedData: any = null;
let lastCacheTime = 0;

// GET: Dashboard summary stats with caching and optimized queries
export const GET: RequestHandler = async () => {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cachedData && (now - lastCacheTime) < CACHE_DURATION) {
      const encryptedCachedData = encryptData(cachedData);
      return json({
        success: true,
        data: encryptedCachedData,
        encrypted: true,
        cached: true
      });
    }

    // Get current date for overdue calculations
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // Optimize with parallel queries using Promise.all
    const [
      totalBooksResult,
      activeMembersResult,
      booksBorrowedResult,
      overdueBooksResult,
      overdueBooksListResult,
      recentActivityResult
    ] = await Promise.all([
      // Total books count
      db.select({ count: count() }).from(book),
      
      // Active members count
      db.select({ count: count() })
        .from(user)
        .where(eq(user.isActive, true)),
      
      // Currently borrowed books count
      db.select({ count: count() })
        .from(bookBorrowing)
        .where(and(
          eq(bookBorrowing.status, 'borrowed'),
          isNull(bookBorrowing.returnDate)
        )),
      
      // Overdue books count (optimized with single query)
      db.select({ count: count() })
        .from(bookBorrowing)
        .where(and(
          eq(bookBorrowing.status, 'borrowed'),
          lt(bookBorrowing.dueDate, todayStr),
          isNull(bookBorrowing.returnDate)
        )),
      
      // Overdue books list with details (limited to 10 most overdue)
      db.select({
        id: bookBorrowing.id,
        bookTitle: book.title,
        memberName: user.name,
        dueDate: bookBorrowing.dueDate,
        userId: bookBorrowing.userId,
        bookId: bookBorrowing.bookId
      })
        .from(bookBorrowing)
        .leftJoin(book, eq(bookBorrowing.bookId, book.id))
        .leftJoin(user, eq(bookBorrowing.userId, user.id))
        .where(and(
          eq(bookBorrowing.status, 'borrowed'),
          lt(bookBorrowing.dueDate, todayStr),
          isNull(bookBorrowing.returnDate)
        ))
        .orderBy(bookBorrowing.dueDate) // Oldest overdue first
        .limit(10),
      
      // Recent activity (last 10 transactions)
      db.select({
        id: bookBorrowing.id,
        type: bookBorrowing.status,
        bookTitle: book.title,
        memberName: user.name,
        time: bookBorrowing.createdAt,
        borrowDate: bookBorrowing.borrowDate,
        returnDate: bookBorrowing.returnDate
      })
        .from(bookBorrowing)
        .leftJoin(book, eq(bookBorrowing.bookId, book.id))
        .leftJoin(user, eq(bookBorrowing.userId, user.id))
        .orderBy(desc(bookBorrowing.createdAt))
        .limit(10)
    ]);

    // Extract counts with proper fallbacks
    const totalBooks = Number(totalBooksResult[0]?.count) || 0;
    const activeMembers = Number(activeMembersResult[0]?.count) || 0;
    const booksBorrowed = Number(booksBorrowedResult[0]?.count) || 0;
    const overdueBooks = Number(overdueBooksResult[0]?.count) || 0;

    // Process overdue books with days calculation
    const overdueBooksList = overdueBooksListResult
      .filter(row => row.bookTitle && row.memberName) // Filter out invalid joins
      .map(row => {
        let daysOverdue = 0;
        if (row.dueDate) {
          try {
            const dueDate = new Date(row.dueDate);
            daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
          } catch (e) {
            console.warn('Invalid due date:', row.dueDate);
          }
        }
        
        return {
          id: row.id,
          bookTitle: row.bookTitle || 'Unknown Book',
          memberName: row.memberName || 'Unknown Member',
          dueDate: row.dueDate,
          daysOverdue
        };
      });

    // Process recent activity with better type handling
    const recentActivity = recentActivityResult
      .filter(row => row.bookTitle && row.memberName) // Filter out invalid joins
      .map(row => ({
        id: row.id,
        type: row.type || 'unknown',
        bookTitle: row.bookTitle || 'Unknown Book',
        memberName: row.memberName || 'Unknown Member',
        time: row.time,
        borrowDate: row.borrowDate,
        returnDate: row.returnDate
      }));

    // Prepare response data
    const dashboardData = {
      totalBooks,
      activeMembers,
      booksBorrowed,
      overdueBooks,
      recentActivity,
      overdueBooksList,
      lastUpdated: new Date().toISOString()
    };

    // Cache the results
    cachedData = dashboardData;
    lastCacheTime = now;

    // Encrypt the response data
    const encryptedData = encryptData(dashboardData);

    return json({
      success: true,
      data: encryptedData,
      encrypted: true,
      cached: false
    });

  } catch (err) {
    console.error('Dashboard API error:', err);

    const isDevelopment = process.env.NODE_ENV === 'development';

    throw error(500, {
      message: isDevelopment 
        ? `Dashboard API Error: ${err instanceof Error ? err.message : String(err) || 'Unknown error'}`
        : 'Internal server error'
    });
  }
};

// Helper function to clear cache (useful for testing or manual refresh)
export const _clearDashboardCache = () => {
  cachedData = null;
  lastCacheTime = 0;
};

// Optional: POST endpoint to manually refresh cache
export const POST: RequestHandler = async () => {
  try {
    // Clear cache to force fresh data
    _clearDashboardCache();
    
    // Call GET to regenerate data
    const getHandler = GET as any;
    return await getHandler({});
    
  } catch (err) {
    console.error('Dashboard cache refresh error:', err);
    throw error(500, { message: 'Failed to refresh dashboard cache' });
  }
};