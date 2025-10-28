import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { 
  libraryVisit, 
  bookBorrowing, 
  user, 
  book, 
  category,
  bookReservation 
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
      .from(libraryVisit)
      .where(and(gte(libraryVisit.timeIn, start), lte(libraryVisit.timeIn, end)))
      .then(result => result[0]?.count || 0);

    const totalTransactions = await db
      .select({ count: count() })
      .from(bookBorrowing)
      .where(and(gte(bookBorrowing.createdAt, start), lte(bookBorrowing.createdAt, end)))
      .then(result => result[0]?.count || 0);

    const activeBorrowings = await db
      .select({ count: count() })
      .from(bookBorrowing)
      .where(eq(bookBorrowing.status, 'borrowed'))
      .then(result => result[0]?.count || 0);

    // Overdue Books with calculated fines
    const overdueBorrowingsRaw = await db
      .select({
        id: bookBorrowing.id,
        bookTitle: book.title,
        borrowerName: user.name,
        dueDate: bookBorrowing.dueDate,
        status: bookBorrowing.status,
        fine: bookBorrowing.fine,
        createdAt: bookBorrowing.createdAt
      })
      .from(bookBorrowing)
      .leftJoin(book, eq(bookBorrowing.bookId, book.id))
      .leftJoin(user, eq(bookBorrowing.userId, user.id))
      .where(and(
        lt(bookBorrowing.dueDate, new Date().toISOString()),
        or(eq(bookBorrowing.status, 'borrowed'), eq(bookBorrowing.status, 'overdue')),
        isNull(bookBorrowing.returnDate)
      ))
      .orderBy(desc(bookBorrowing.createdAt));

    const overdueBooks = overdueBorrowingsRaw.length;

    const overdueList = overdueBorrowingsRaw.slice(0, 10).map(item => {
      const dueDate = item.dueDate ? new Date(item.dueDate) : new Date();
      const daysOverdue = calculateDaysOverdue(dueDate);
      // Use the fine from DB (already calculated by updateAllOverdueFines)
      const fine = item.fine || 0;
      
      return {
        bookTitle: item.bookTitle || 'Unknown Book',
        borrowerName: item.borrowerName || 'Unknown Borrower',
        daysOverdue,
        fine
      };
    });

    // Calculate total penalties from all overdue books
    const totalPenaltiesResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${bookBorrowing.fine}), 0)`
      })
      .from(bookBorrowing)
      .where(
        and(
          or(eq(bookBorrowing.status, 'borrowed'), eq(bookBorrowing.status, 'overdue')),
          isNull(bookBorrowing.returnDate)
        )
      )
      .then(result => result[0]?.total || 0);

    const totalPenalties = Number(totalPenaltiesResult);

    const availableBooks = await db
      .select({ count: count() })
      .from(book)
      .where(gte(book.copiesAvailable, 1))
      .then(result => result[0]?.count || 0);

    // Daily Visits for Chart
    const dailyVisitsRaw = await db
      .select({
        date: sql<string>`DATE(${libraryVisit.timeIn})`,
        count: count()
      })
      .from(libraryVisit)
      .where(and(gte(libraryVisit.timeIn, start), lte(libraryVisit.timeIn, end)))
      .groupBy(sql`DATE(${libraryVisit.timeIn})`)
      .orderBy(sql`DATE(${libraryVisit.timeIn})`);

    const dailyVisits = dailyVisitsRaw.map(item => ({
      date: item.date,
      count: item.count
    }));

    // Transaction Types Distribution
    const borrowedCount = await db.select({ count: count() })
      .from(bookBorrowing)
      .where(and(eq(bookBorrowing.status, 'borrowed'), gte(bookBorrowing.createdAt, start), lte(bookBorrowing.createdAt, end)))
      .then(r => r[0]?.count || 0);

    const returnedCount = await db.select({ count: count() })
      .from(bookBorrowing)
      .where(and(eq(bookBorrowing.status, 'returned'), gte(bookBorrowing.createdAt, start), lte(bookBorrowing.createdAt, end)))
      .then(r => r[0]?.count || 0);

    const overdueCount = await db.select({ count: count() })
      .from(bookBorrowing)
      .where(and(eq(bookBorrowing.status, 'overdue'), gte(bookBorrowing.createdAt, start), lte(bookBorrowing.createdAt, end)))
      .then(r => r[0]?.count || 0);

    const reservedCount = await db.select({ count: count() })
      .from(bookReservation)
      .where(and(eq(bookReservation.status, 'active'), gte(bookReservation.createdAt, start), lte(bookReservation.createdAt, end)))
      .then(r => r[0]?.count || 0);

    const transactionTypes = [
      { type: 'Borrowed', count: borrowedCount },
      { type: 'Returned', count: returnedCount },
      { type: 'Overdue', count: overdueCount },
      { type: 'Reserved', count: reservedCount }
    ];

    // Category Distribution
    const categoryStatsRaw = await db
      .select({
        category: category.name,
        count: count()
      })
      .from(book)
      .leftJoin(category, eq(book.categoryId, category.id))
      .groupBy(category.name)
      .orderBy(desc(count()));

    const totalBooksCount = categoryStatsRaw.reduce((sum, cat) => sum + cat.count, 0);
    const categoryDistribution = categoryStatsRaw.map(item => ({
      category: item.category || 'Uncategorized',
      count: item.count,
      percentage: totalBooksCount > 0 ? Math.round((item.count / totalBooksCount) * 100) : 0
    }));

    // Penalty Trends (weekly aggregation using stored fines)
    const penaltyTrendsRaw = await db
      .select({
        week: sql<string>`DATE_TRUNC('week', ${bookBorrowing.createdAt})`,
        totalFine: sql<number>`COALESCE(SUM(${bookBorrowing.fine}), 0)`
      })
      .from(bookBorrowing)
      .where(and(
        or(eq(bookBorrowing.status, 'overdue'), eq(bookBorrowing.status, 'returned')),
        gte(bookBorrowing.createdAt, start),
        lte(bookBorrowing.createdAt, end)
      ))
      .groupBy(sql`DATE_TRUNC('week', ${bookBorrowing.createdAt})`)
      .orderBy(sql`DATE_TRUNC('week', ${bookBorrowing.createdAt})`);

    const penaltyTrends = penaltyTrendsRaw.map(item => ({
      date: item.week,
      amount: Number(item.totalFine)
    }));

    // Member Activity Summary
    const studentCount = await db
      .select({ count: count() })
      .from(user)
      .where(and(eq(user.role, 'student'), eq(user.isActive, true)))
      .then(result => result[0]?.count || 0);

    const facultyCount = await db
      .select({ count: count() })
      .from(user)
      .where(and(eq(user.role, 'faculty'), eq(user.isActive, true)))
      .then(result => result[0]?.count || 0);

    const newStudents = await db
      .select({ count: count() })
      .from(user)
      .where(and(
        eq(user.role, 'student'),
        gte(user.createdAt, start),
        lte(user.createdAt, end)
      ))
      .then(result => result[0]?.count || 0);

    const newFaculty = await db
      .select({ count: count() })
      .from(user)
      .where(and(
        eq(user.role, 'faculty'),
        gte(user.createdAt, start),
        lte(user.createdAt, end)
      ))
      .then(result => result[0]?.count || 0);

    const memberActivity = [
      { type: 'Students', active: studentCount, new: newStudents },
      { type: 'Faculty', active: facultyCount, new: newFaculty }
    ];

    // Top Books by Borrow Count
    const topBooksRaw = await db
      .select({
        title: book.title,
        author: book.author,
        borrowCount: count()
      })
      .from(bookBorrowing)
      .leftJoin(book, eq(bookBorrowing.bookId, book.id))
      .where(and(
        gte(bookBorrowing.createdAt, start),
        lte(bookBorrowing.createdAt, end)
      ))
      .groupBy(book.id, book.title, book.author)
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