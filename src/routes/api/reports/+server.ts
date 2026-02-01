import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { 
  tbl_qr_scan_log, 
  tbl_book_borrowing, 
  tbl_user, 
  tbl_book, 
  tbl_category,
  tbl_fine
} from '$lib/server/db/schema/schema.js';
import { and, eq, gte, lte, desc, sql, count, lt, or, isNull } from 'drizzle-orm';
import { updateAllOverdueFines, calculateFineAmount, calculateDaysOverdue } from '$lib/server/utils/fineCalculation.js';

// Utility: get date range for period
function getDateRange(period: string) {
  const now = new Date();
  let start: Date, end: Date;
  end = new Date(now);
  
  switch (period) {
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      break;
    case 'quarter':
      start = new Date(now);
      start.setDate(now.getDate() - 90);
      break;
    case 'year':
      start = new Date(now);
      start.setDate(now.getDate() - 365);
      break;
    default:
      start = new Date(0); // all time
  }
  return { start, end };
}

// GET: Return comprehensive dashboard data
export const GET: RequestHandler = async ({ url }) => {
  try {
    const period = url.searchParams.get('period') || 'month';
    const { start, end } = getDateRange(period);

    // CRITICAL: Update all overdue fines before generating report
    console.log('Updating all overdue fines...');
    await updateAllOverdueFines();
    console.log('Fines updated successfully');

    // Overview Statistics
    const totalVisits = await db
      .select({ count: count() })
      .from(tbl_qr_scan_log)
      .where(and(gte(tbl_qr_scan_log.scannedAt, start), lte(tbl_qr_scan_log.scannedAt, end)))
      .then(result => result[0]?.count || 0);

    const totalTransactions = await db
      .select({ count: count() })
      .from(tbl_book_borrowing)
      .where(and(gte(tbl_book_borrowing.createdAt, start), lte(tbl_book_borrowing.createdAt, end)))
      .then(result => result[0]?.count || 0);

    const activeBorrowings = await db
      .select({ count: count() })
      .from(tbl_book_borrowing)
      .where(eq(tbl_book_borrowing.status, 'borrowed'))
      .then(result => result[0]?.count || 0);

    // Overdue Books with calculated fines
    const overdueBorrowingsRaw = await db
      .select({
        id: tbl_book_borrowing.id,
        bookTitle: tbl_book.title,
        borrowerName: tbl_user.name,
        dueDate: tbl_book_borrowing.dueDate,
        status: tbl_book_borrowing.status,
        createdAt: tbl_book_borrowing.createdAt
      })
      .from(tbl_book_borrowing)
      .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
      .leftJoin(tbl_user, eq(tbl_book_borrowing.userId, tbl_user.id))
      .where(and(
        lt(tbl_book_borrowing.dueDate, new Date().toISOString().split('T')[0]),
        or(eq(tbl_book_borrowing.status, 'borrowed'), eq(tbl_book_borrowing.status, 'overdue')),
        isNull(tbl_book_borrowing.returnDate)
      ))
      .orderBy(desc(tbl_book_borrowing.createdAt));

    const overdueBooks = overdueBorrowingsRaw.length;

    const overdueList = overdueBorrowingsRaw.slice(0, 10).map(item => {
      const dueDate = item.dueDate ? new Date(item.dueDate) : new Date();
      const daysOverdue = calculateDaysOverdue(dueDate);
      // Calculate fine based on days overdue (10 pesos per day)
      const fine = daysOverdue * 10;
      
      return {
        bookTitle: item.bookTitle || 'Unknown Book',
        borrowerName: item.borrowerName || 'Unknown Borrower',
        daysOverdue,
        fine
      };
    });

    // Calculate total penalties from all unpaid fines
    const totalPenaltiesResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${tbl_fine.fineAmount}), 0)`
      })
      .from(tbl_fine)
      .where(eq(tbl_fine.status, 'unpaid'))
      .then(result => result[0]?.total || '0');

    const totalPenalties = Number(totalPenaltiesResult);

    const availableBooks = await db
      .select({ count: count() })
      .from(tbl_book)
      .where(sql`1=1`) // All books are available by default
      .then(result => result[0]?.count || 0);

    // Daily Visits for Chart
    const dailyVisitsRaw = await db
      .select({
        date: sql<string>`DATE(${tbl_qr_scan_log.scannedAt})`,
        count: count()
      })
      .from(tbl_qr_scan_log)
      .where(and(gte(tbl_qr_scan_log.scannedAt, start), lte(tbl_qr_scan_log.scannedAt, end)))
      .groupBy(sql`DATE(${tbl_qr_scan_log.scannedAt})`)
      .orderBy(sql`DATE(${tbl_qr_scan_log.scannedAt})`);

    const dailyVisits = dailyVisitsRaw.map(item => ({
      date: item.date,
      count: item.count
    }));

    // Transaction Types Distribution
    const borrowedCount = await db.select({ count: count() })
      .from(tbl_book_borrowing)
      .where(and(eq(tbl_book_borrowing.status, 'borrowed'), gte(tbl_book_borrowing.createdAt, start), lte(tbl_book_borrowing.createdAt, end)))
      .then(r => r[0]?.count || 0);

    const returnedCount = await db.select({ count: count() })
      .from(tbl_book_borrowing)
      .where(and(eq(tbl_book_borrowing.status, 'returned'), gte(tbl_book_borrowing.createdAt, start), lte(tbl_book_borrowing.createdAt, end)))
      .then(r => r[0]?.count || 0);

    const overdueCount = await db.select({ count: count() })
      .from(tbl_book_borrowing)
      .where(and(eq(tbl_book_borrowing.status, 'overdue'), gte(tbl_book_borrowing.createdAt, start), lte(tbl_book_borrowing.createdAt, end)))
      .then(r => r[0]?.count || 0);

    const transactionTypes = [
      { type: 'Borrowed', count: borrowedCount },
      { type: 'Returned', count: returnedCount },
      { type: 'Overdue', count: overdueCount }
    ];

    // Category Distribution
    const categoryStatsRaw = await db
      .select({
        category: tbl_category.name,
        count: count()
      })
      .from(tbl_book)
      .leftJoin(tbl_category, eq(tbl_book.categoryId, tbl_category.id))
      .groupBy(tbl_category.id, tbl_category.name)
      .orderBy(desc(count()));

    const totalBooksCount = categoryStatsRaw.reduce((sum, cat) => sum + cat.count, 0);
    const categoryDistribution = categoryStatsRaw.map(item => ({
      category: item.category || 'Uncategorized',
      count: item.count,
      percentage: totalBooksCount > 0 ? Math.round((item.count / totalBooksCount) * 100) : 0
    }));

    // Penalty Trends (weekly aggregation using fine table)
    const penaltyTrendsRaw = await db
      .select({
        week: sql<string>`DATE_TRUNC('week', ${tbl_fine.createdAt})`,
        totalFine: sql<number>`COALESCE(SUM(${tbl_fine.fineAmount}), 0)`
      })
      .from(tbl_fine)
      .where(and(
        gte(tbl_fine.createdAt, start),
        lte(tbl_fine.createdAt, end)
      ))
      .groupBy(sql`DATE_TRUNC('week', ${tbl_fine.createdAt})`)
      .orderBy(sql`DATE_TRUNC('week', ${tbl_fine.createdAt})`);

    const penaltyTrends = penaltyTrendsRaw.map(item => ({
      date: item.week,
      amount: Number(item.totalFine)
    }));

    // Member Activity Summary
    const studentCount = await db
      .select({ count: count() })
      .from(tbl_user)
      .where(and(eq(tbl_user.userType, 'student'), eq(tbl_user.isActive, true)))
      .then(result => result[0]?.count || 0);

    const facultyCount = await db
      .select({ count: count() })
      .from(tbl_user)
      .where(and(eq(tbl_user.userType, 'faculty'), eq(tbl_user.isActive, true)))
      .then(result => result[0]?.count || 0);

    const newStudents = await db
      .select({ count: count() })
      .from(tbl_user)
      .where(and(
        eq(tbl_user.userType, 'student'),
        gte(tbl_user.createdAt, start),
        lte(tbl_user.createdAt, end)
      ))
      .then(result => result[0]?.count || 0);

    const newFaculty = await db
      .select({ count: count() })
      .from(tbl_user)
      .where(and(
        eq(tbl_user.userType, 'faculty'),
        gte(tbl_user.createdAt, start),
        lte(tbl_user.createdAt, end)
      ))
      .then(result => result[0]?.count || 0);

    const memberActivity = [
      { type: 'Students', active: studentCount, new: newStudents },
      { type: 'Faculty', active: facultyCount, new: newFaculty }
    ];

    // Top Books by Borrow Count
    const topBooksRaw = await db
      .select({
        title: tbl_book.title,
        author: tbl_book.author,
        borrowCount: count()
      })
      .from(tbl_book_borrowing)
      .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
      .where(and(
        gte(tbl_book_borrowing.createdAt, start),
        lte(tbl_book_borrowing.createdAt, end)
      ))
      .groupBy(tbl_book.id, tbl_book.title, tbl_book.author)
      .orderBy(desc(count()))
      .limit(5);

    const topBooks = topBooksRaw.map(item => ({
      title: item.title || 'Unknown Title',
      author: item.author || 'Unknown Author',
      borrowCount: item.borrowCount
    }));

    return json({
      success: true,
      data: {
        overview: {
          totalVisits,
          totalTransactions,
          activeBorrowings,
          overdueBooks,
          totalPenalties,
          availableBooks
        },
        charts: {
          dailyVisits,
          transactionTypes,
          categoryDistribution,
          penaltyTrends,
          memberActivity
        },
        tables: {
          topBooks,
          overdueList
        }
      }
    });

  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    throw error(500, { message: 'Internal server error' });
  }
};