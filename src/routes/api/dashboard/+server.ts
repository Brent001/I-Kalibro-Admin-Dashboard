import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import {
  tbl_book, tbl_book_borrowing, tbl_user, tbl_book_copy,
  tbl_magazine, tbl_magazine_borrowing, tbl_magazine_copy,
  tbl_thesis, tbl_thesis_borrowing, tbl_thesis_copy,
  tbl_journal, tbl_journal_borrowing, tbl_journal_copy,
  tbl_book_reservation, tbl_magazine_reservation,
  tbl_thesis_reservation, tbl_journal_reservation
} from '$lib/server/db/schema/schema.js';
import { eq, count, lt, and, isNull, desc, sql, or } from 'drizzle-orm';
import { calculateDaysOverdue, calculateFineAmount } from '$lib/server/utils/fineCalculation.js';
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
      return json({ success: true, data: encryptedCachedData, encrypted: true, cached: true });
    }

    // use a Date object for comparison; Drizzle expects a Date rather than a string
    // normalize to midnight so we compare only the calendar day
    const today: Date = new Date();
    today.setHours(0, 0, 0, 0);
    // keep the string form for any client‑side logic if needed
    const todayStr = today.toISOString().slice(0, 10);

    // ─── Run queries in batches to avoid overwhelming connection pool ───

    // Batch 1: Basic counts (totals and active members)
    const [
      totalBooksResult,
      totalMagazinesResult,
      totalThesisResult,
      totalJournalsResult,
      activeMembersResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(tbl_book).where(eq(tbl_book.isActive, true)),
      db.select({ count: count() }).from(tbl_magazine).where(eq(tbl_magazine.isActive, true)),
      db.select({ count: count() }).from(tbl_thesis).where(eq(tbl_thesis.isActive, true)),
      db.select({ count: count() }).from(tbl_journal).where(eq(tbl_journal.isActive, true)),
      db.select({ count: count() }).from(tbl_user).where(eq(tbl_user.isActive, true)),
    ]);

    // Batch 2: Borrowing counts
    const [
      booksBorrowedResult,
      magazinesBorrowedResult,
      thesisBorrowedResult,
      journalsBorrowedResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(tbl_book_borrowing)
        .where(and(or(eq(tbl_book_borrowing.status, 'borrowed'), eq(tbl_book_borrowing.status, 'overdue')), isNull(tbl_book_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_magazine_borrowing)
        .where(and(or(eq(tbl_magazine_borrowing.status, 'borrowed'), eq(tbl_magazine_borrowing.status, 'overdue')), isNull(tbl_magazine_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_thesis_borrowing)
        .where(and(or(eq(tbl_thesis_borrowing.status, 'borrowed'), eq(tbl_thesis_borrowing.status, 'overdue')), isNull(tbl_thesis_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_journal_borrowing)
        .where(and(or(eq(tbl_journal_borrowing.status, 'borrowed'), eq(tbl_journal_borrowing.status, 'overdue')), isNull(tbl_journal_borrowing.returnDate))),
    ]);

    // Batch 3: Overdue counts
    const [
      overdueBooksCntResult,
      overdueMagazinesCntResult,
      overdueThesisCntResult,
      overdueJournalsCntResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(tbl_book_borrowing)
        .where(and(or(eq(tbl_book_borrowing.status, 'borrowed'), eq(tbl_book_borrowing.status, 'overdue')), lt(tbl_book_borrowing.dueDate, today), isNull(tbl_book_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_magazine_borrowing)
        .where(and(or(eq(tbl_magazine_borrowing.status, 'borrowed'), eq(tbl_magazine_borrowing.status, 'overdue')), lt(tbl_magazine_borrowing.dueDate, today), isNull(tbl_magazine_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_thesis_borrowing)
        .where(and(or(eq(tbl_thesis_borrowing.status, 'borrowed'), eq(tbl_thesis_borrowing.status, 'overdue')), lt(tbl_thesis_borrowing.dueDate, today), isNull(tbl_thesis_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_journal_borrowing)
        .where(and(or(eq(tbl_journal_borrowing.status, 'borrowed'), eq(tbl_journal_borrowing.status, 'overdue')), lt(tbl_journal_borrowing.dueDate, today), isNull(tbl_journal_borrowing.returnDate))),
    ]);

    // Batch 4: Reservation counts
    const [
      pendingBookReservationsResult,
      pendingMagazineReservationsResult,
      pendingThesisReservationsResult,
      pendingJournalReservationsResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(tbl_book_reservation).where(or(eq(tbl_book_reservation.status, 'pending'), eq(tbl_book_reservation.status, 'active'), eq(tbl_book_reservation.status, 'borrow_request'))),
      db.select({ count: count() }).from(tbl_magazine_reservation).where(or(eq(tbl_magazine_reservation.status, 'pending'), eq(tbl_magazine_reservation.status, 'active'), eq(tbl_magazine_reservation.status, 'borrow_request'))),
      db.select({ count: count() }).from(tbl_thesis_reservation).where(or(eq(tbl_thesis_reservation.status, 'pending'), eq(tbl_thesis_reservation.status, 'active'), eq(tbl_thesis_reservation.status, 'borrow_request'))),
      db.select({ count: count() }).from(tbl_journal_reservation).where(or(eq(tbl_journal_reservation.status, 'pending'), eq(tbl_journal_reservation.status, 'active'), eq(tbl_journal_reservation.status, 'borrow_request'))),
    ]);

    // Batch 5: Overdue detail lists
    const [
      overdueBooksListResult,
      overdueMagazinesListResult,
      overdueThesisListResult,
      overdueJournalsListResult,
    ] = await Promise.all([
      db.select({ id: tbl_book_borrowing.id, title: tbl_book.title, memberName: tbl_user.name, dueDate: tbl_book_borrowing.dueDate, itemType: sql<string>`'book'` })
        .from(tbl_book_borrowing)
        .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
        .leftJoin(tbl_user, eq(tbl_book_borrowing.userId, tbl_user.id))
        .where(and(or(eq(tbl_book_borrowing.status, 'borrowed'), eq(tbl_book_borrowing.status, 'overdue')), lt(tbl_book_borrowing.dueDate, today), isNull(tbl_book_borrowing.returnDate)))
        .orderBy(tbl_book_borrowing.dueDate).limit(5),

      db.select({ id: tbl_magazine_borrowing.id, title: tbl_magazine.title, memberName: tbl_user.name, dueDate: tbl_magazine_borrowing.dueDate, itemType: sql<string>`'magazine'` })
        .from(tbl_magazine_borrowing)
        .leftJoin(tbl_magazine, eq(tbl_magazine_borrowing.magazineId, tbl_magazine.id))
        .leftJoin(tbl_user, eq(tbl_magazine_borrowing.userId, tbl_user.id))
        .where(and(or(eq(tbl_magazine_borrowing.status, 'borrowed'), eq(tbl_magazine_borrowing.status, 'overdue')), lt(tbl_magazine_borrowing.dueDate, today), isNull(tbl_magazine_borrowing.returnDate)))
        .orderBy(tbl_magazine_borrowing.dueDate).limit(5),

      db.select({ id: tbl_thesis_borrowing.id, title: tbl_thesis.title, memberName: tbl_user.name, dueDate: tbl_thesis_borrowing.dueDate, itemType: sql<string>`'thesis'` })
        .from(tbl_thesis_borrowing)
        .leftJoin(tbl_thesis, eq(tbl_thesis_borrowing.thesisId, tbl_thesis.id))
        .leftJoin(tbl_user, eq(tbl_thesis_borrowing.userId, tbl_user.id))
        .where(and(or(eq(tbl_thesis_borrowing.status, 'borrowed'), eq(tbl_thesis_borrowing.status, 'overdue')), lt(tbl_thesis_borrowing.dueDate, today), isNull(tbl_thesis_borrowing.returnDate)))
        .orderBy(tbl_thesis_borrowing.dueDate).limit(5),

      db.select({ id: tbl_journal_borrowing.id, title: tbl_journal.title, memberName: tbl_user.name, dueDate: tbl_journal_borrowing.dueDate, itemType: sql<string>`'journal'` })
        .from(tbl_journal_borrowing)
        .leftJoin(tbl_journal, eq(tbl_journal_borrowing.journalId, tbl_journal.id))
        .leftJoin(tbl_user, eq(tbl_journal_borrowing.userId, tbl_user.id))
        .where(and(or(eq(tbl_journal_borrowing.status, 'borrowed'), eq(tbl_journal_borrowing.status, 'overdue')), lt(tbl_journal_borrowing.dueDate, today), isNull(tbl_journal_borrowing.returnDate)))
        .orderBy(tbl_journal_borrowing.dueDate).limit(5),
    ]);

    // Batch 6: Recent activity (run last as it's the most complex)
    const [
      recentBooksActivityResult,
      recentMagazinesActivityResult,
      recentThesisActivityResult,
      recentJournalsActivityResult,
    ] = await Promise.all([
      db.select({ id: tbl_book_borrowing.id, status: tbl_book_borrowing.status, title: tbl_book.title, memberName: tbl_user.name, createdAt: tbl_book_borrowing.createdAt, returnDate: tbl_book_borrowing.returnDate, itemType: sql<string>`'book'` })
        .from(tbl_book_borrowing)
        .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
        .leftJoin(tbl_user, eq(tbl_book_borrowing.userId, tbl_user.id))
        .orderBy(desc(tbl_book_borrowing.createdAt)).limit(5),

      db.select({ id: tbl_magazine_borrowing.id, status: tbl_magazine_borrowing.status, title: tbl_magazine.title, memberName: tbl_user.name, createdAt: tbl_magazine_borrowing.createdAt, returnDate: tbl_magazine_borrowing.returnDate, itemType: sql<string>`'magazine'` })
        .from(tbl_magazine_borrowing)
        .leftJoin(tbl_magazine, eq(tbl_magazine_borrowing.magazineId, tbl_magazine.id))
        .leftJoin(tbl_user, eq(tbl_magazine_borrowing.userId, tbl_user.id))
        .orderBy(desc(tbl_magazine_borrowing.createdAt)).limit(5),

      db.select({ id: tbl_thesis_borrowing.id, status: tbl_thesis_borrowing.status, title: tbl_thesis.title, memberName: tbl_user.name, createdAt: tbl_thesis_borrowing.createdAt, returnDate: tbl_thesis_borrowing.returnDate, itemType: sql<string>`'thesis'` })
        .from(tbl_thesis_borrowing)
        .leftJoin(tbl_thesis, eq(tbl_thesis_borrowing.thesisId, tbl_thesis.id))
        .leftJoin(tbl_user, eq(tbl_thesis_borrowing.userId, tbl_user.id))
        .orderBy(desc(tbl_thesis_borrowing.createdAt)).limit(5),

      db.select({ id: tbl_journal_borrowing.id, status: tbl_journal_borrowing.status, title: tbl_journal.title, memberName: tbl_user.name, createdAt: tbl_journal_borrowing.createdAt, returnDate: tbl_journal_borrowing.returnDate, itemType: sql<string>`'journal'` })
        .from(tbl_journal_borrowing)
        .leftJoin(tbl_journal, eq(tbl_journal_borrowing.journalId, tbl_journal.id))
        .leftJoin(tbl_user, eq(tbl_journal_borrowing.userId, tbl_user.id))
        .orderBy(desc(tbl_journal_borrowing.createdAt)).limit(5),
    ]);

    // ─── Aggregate numeric stats ───────────────────────────────────────────────
    const totalBooks      = Number(totalBooksResult[0]?.count)     || 0;
    const totalMagazines  = Number(totalMagazinesResult[0]?.count) || 0;
    const totalThesis     = Number(totalThesisResult[0]?.count)    || 0;
    const totalJournals   = Number(totalJournalsResult[0]?.count)  || 0;
    const totalItems      = totalBooks + totalMagazines + totalThesis + totalJournals;

    const activeMembers   = Number(activeMembersResult[0]?.count)  || 0;

    const booksBorrowed     = Number(booksBorrowedResult[0]?.count)     || 0;
    const magazinesBorrowed = Number(magazinesBorrowedResult[0]?.count) || 0;
    const thesisBorrowed    = Number(thesisBorrowedResult[0]?.count)    || 0;
    const journalsBorrowed  = Number(journalsBorrowedResult[0]?.count)  || 0;
    const totalBorrowed     = booksBorrowed + magazinesBorrowed + thesisBorrowed + journalsBorrowed;

    const overdueBooks     = Number(overdueBooksCntResult[0]?.count)     || 0;
    const overdueMagazines = Number(overdueMagazinesCntResult[0]?.count) || 0;
    const overdueThesis    = Number(overdueThesisCntResult[0]?.count)    || 0;
    const overdueJournals  = Number(overdueJournalsCntResult[0]?.count)  || 0;
    const totalOverdue     = overdueBooks + overdueMagazines + overdueThesis + overdueJournals;

    const pendingBookRes     = Number(pendingBookReservationsResult[0]?.count)     || 0;
    const pendingMagRes      = Number(pendingMagazineReservationsResult[0]?.count) || 0;
    const pendingThesisRes   = Number(pendingThesisReservationsResult[0]?.count)   || 0;
    const pendingJournalRes  = Number(pendingJournalReservationsResult[0]?.count)  || 0;
    const totalPendingReservations = pendingBookRes + pendingMagRes + pendingThesisRes + pendingJournalRes;

    // ─── Build overdue list (sorted by most overdue first, top 10) ─────────────
    // compute overdue days and fine using exemption-aware utilities
    const combined = [
      ...overdueBooksListResult,
      ...overdueMagazinesListResult,
      ...overdueThesisListResult,
      ...overdueJournalsListResult,
    ].filter(r => r.title && r.memberName);

    const overdueItemsRaw = await Promise.all(combined.map(async (r: any) => {
      try {
        const days = r.dueDate ? await calculateDaysOverdue(new Date(r.dueDate)) : 0;
        const fineCent = r.dueDate ? await calculateFineAmount(new Date(r.dueDate)) : 0;
        return {
          id: r.id,
          itemTitle: r.title || 'Unknown',
          memberName: r.memberName || 'Unknown',
          dueDate: r.dueDate,
          daysOverdue: days,
          // calculateFineAmount already returns pesos
          fine: Number(Number(fineCent).toFixed(2)),
          itemType: r.itemType,
        };
      } catch (e) {
        return { id: r.id, itemTitle: r.title || 'Unknown', memberName: r.memberName || 'Unknown', dueDate: r.dueDate, daysOverdue: 0, fine: 0, itemType: r.itemType };
      }
    }));

    const overdueItemsList = overdueItemsRaw.sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 10);

    // ─── Build recent activity (merge all, sort by date, top 10) ──────────────
    const recentActivity = [
      ...recentBooksActivityResult,
      ...recentMagazinesActivityResult,
      ...recentThesisActivityResult,
      ...recentJournalsActivityResult,
    ]
      .filter(r => r.title && r.memberName)
      .map(r => ({
        id: r.id,
        type: r.status || 'unknown',
        itemTitle: r.title || 'Unknown',
        memberName: r.memberName || 'Unknown',
        time: r.createdAt,
        returnDate: r.returnDate,
        itemType: r.itemType,
      }))
      .sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime())
      .slice(0, 10);

    // ─── Compose response ──────────────────────────────────────────────────────
    const dashboardData = {
      // Aggregated totals
      totalItems,
      totalBooks,
      totalMagazines,
      totalThesis,
      totalJournals,

      activeMembers,

      totalBorrowed,
      borrowedByType: { books: booksBorrowed, magazines: magazinesBorrowed, thesis: thesisBorrowed, journals: journalsBorrowed },

      totalOverdue,
      overdueByType: { books: overdueBooks, magazines: overdueMagazines, thesis: overdueThesis, journals: overdueJournals },

      totalPendingReservations,
      pendingReservationsByType: { books: pendingBookRes, magazines: pendingMagRes, thesis: pendingThesisRes, journals: pendingJournalRes },

      overdueItemsList,
      recentActivity,
      lastUpdated: new Date().toISOString(),
    };

    cachedData = dashboardData;
    lastCacheTime = now;

    const encryptedData = encryptData(dashboardData);
    return json({ success: true, data: encryptedData, encrypted: true, cached: false });

  } catch (err) {
    console.error('Dashboard API error:', err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    throw error(500, {
      message: isDevelopment
        ? `Dashboard API Error: ${err instanceof Error ? err.message : String(err)}`
        : 'Internal server error'
    });
  }
};

export const _clearDashboardCache = () => { cachedData = null; lastCacheTime = 0; };

export const POST: RequestHandler = async () => {
  try {
    _clearDashboardCache();
    const getHandler = GET as any;
    return await getHandler({});
  } catch (err) {
    console.error('Dashboard cache refresh error:', err);
    throw error(500, { message: 'Failed to refresh dashboard cache' });
  }
};