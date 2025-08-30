import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { libraryVisit, bookTransaction, penalty, user, book } from '$lib/server/db/schema/schema.js';
import { and, eq, gte, lte, desc } from 'drizzle-orm';

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
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(0); // all time
  }
  return { start, end };
}

// GET: Return reports based on query params
export const GET: RequestHandler = async ({ url }) => {
  try {
    const period = url.searchParams.get('period') || 'month';
    const type = url.searchParams.get('type') || 'overview';
    const { start, end } = getDateRange(period);

    // Overview
    if (type === 'overview') {
      // Total Visits
      const totalVisits = await db.select().from(libraryVisit).then(rows => rows.length);

      // Total Transactions
      const totalTransactions = await db.select().from(bookTransaction).then(rows => rows.length);

      // Active Borrowings
      const activeBorrowings = await db
        .select()
        .from(bookTransaction)
        .where(eq(bookTransaction.status, 'active'))
        .then(rows => rows.length);

      // Overdue Books
      const overdueBooks = await db
        .select()
        .from(bookTransaction)
        .where(eq(bookTransaction.status, 'overdue'))
        .then(rows => rows.length);

      // Total Penalties
      const totalPenalties = await db
        .select()
        .from(penalty)
        .then(rows => rows.reduce((sum, p) => sum + (p.amount || 0), 0));

      // New Members
      const newMembers = await db
        .select()
        .from(user)
        .where(gte(user.createdAt, start))
        .then(rows => rows.length);

      // Popular Books (top 5 by borrow count)
      const popularBooks = await db
        .select({
          title: book.title,
          author: book.author,
        })
        .from(book)
        .limit(5);

      // Recent Activity (dummy for now)
      const recentActivity = await db
        .select({
          type: bookTransaction.transactionType,
          description: book.title,
          timestamp: bookTransaction.createdAt
        })
        .from(bookTransaction)
        .leftJoin(book, eq(bookTransaction.bookId, book.id))
        .orderBy(desc(bookTransaction.createdAt))
        .limit(5);

      return json({
        success: true,
        data: {
          overview: {
            totalVisits,
            totalTransactions,
            activeBorrowings,
            overdueBooks,
            totalPenalties,
            newMembers,
            popularBooks,
            recentActivity
          }
        }
      });
    }

    // Visits
    if (type === 'visits') {
      const totalVisits = await db
        .select()
        .from(libraryVisit)
        .where(and(gte(libraryVisit.timeIn, start), lte(libraryVisit.timeIn, end)))
        .then(rows => rows.length);

      // Visitor Types
      const visitorTypes = [
        { type: 'student', count: 0 },
        { type: 'faculty', count: 0 },
        { type: 'external', count: 0 }
      ];
      const visits = await db
        .select()
        .from(libraryVisit)
        .where(and(gte(libraryVisit.timeIn, start), lte(libraryVisit.timeIn, end)));
      visits.forEach(v => {
        const idx = visitorTypes.findIndex(t => t.type === v.visitorType);
        if (idx !== -1) visitorTypes[idx].count += 1;
      });

      // Average Duration (dummy)
      const averageDuration = "0:45";

      // Peak Hours (dummy)
      const peakHours = [{ hour: "14:00", count: 10 }];

      // Daily Visits (typed)
      type DailyVisit = { date: string; count: number };
      const dailyVisits: DailyVisit[] = [];

      return json({
        success: true,
        data: {
          visits: {
            totalVisits,
            dailyVisits,
            visitorTypes,
            peakHours,
            averageDuration
          }
        }
      });
    }

    // Transactions
    if (type === 'transactions') {
      const totalTransactions = await db
        .select()
        .from(bookTransaction)
        .where(and(gte(bookTransaction.createdAt, start), lte(bookTransaction.createdAt, end)))
        .then(rows => rows.length);

      // Overdue List
      const overdueList = await db
        .select()
        .from(bookTransaction)
        .where(eq(bookTransaction.status, 'overdue'));

      return json({
        success: true,
        data: {
          transactions: {
            totalTransactions,
            byType: [],
            dailyTransactions: [],
            topBooks: [],
            overdueList
          }
        }
      });
    }

    // Penalties
    if (type === 'penalties') {
      const totalAmount = await db
        .select()
        .from(penalty)
        .then(rows => rows.reduce((sum, p) => sum + (p.amount || 0), 0));
      const paidAmount = await db
        .select()
        .from(penalty)
        .where(eq(penalty.status, 'paid'))
        .then(rows => rows.reduce((sum, p) => sum + (p.amount || 0), 0));
      const unpaidAmount = totalAmount - paidAmount;

      return json({
        success: true,
        data: {
          penalties: {
            totalAmount,
            paidAmount,
            unpaidAmount,
            byType: [],
            recentPenalties: []
          }
        }
      });
    }

    // Members
    if (type === 'members') {
      const activeMembers = await db
        .select()
        .from(user)
        .where(eq(user.isActive, true))
        .then(rows => rows.length);

      const newThisMonth = await db
        .select()
        .from(user)
        .where(gte(user.createdAt, start))
        .then(rows => rows.length);

      return json({
        success: true,
        data: {
          members: {
            activeMembers,
            newThisMonth,
            topBorrowers: [],
            memberActivity: []
          }
        }
      });
    }

    // Books
    if (type === 'books') {
      const totalBooks = await db.select().from(book).then(rows => rows.length);
      const availableBooks = await db.select().from(book).where(gte(book.copiesAvailable, 1)).then(rows => rows.length);
      const issuedBooks = await db.select().from(book).where(eq(book.copiesAvailable, 0)).then(rows => rows.length);
      const reservedBooks = 0; // Placeholder

      return json({
        success: true,
        data: {
          books: {
            totalBooks,
            availableBooks,
            issuedBooks,
            reservedBooks,
            categoryStats: [],
            popularAuthors: []
          }
        }
      });
    }

    // Default
    return json({ success: false, message: 'Invalid report type' }, { status: 400 });
  } catch (err) {
    console.error('Error fetching reports:', err);
    throw error(500, { message: 'Internal server error' });
  }
};