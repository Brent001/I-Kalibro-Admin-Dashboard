import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import {
  tbl_library_visit,
  tbl_book, tbl_book_borrowing, tbl_book_reservation, tbl_book_return_request, tbl_book_copy,
  tbl_magazine, tbl_magazine_borrowing, tbl_magazine_reservation, tbl_magazine_return_request,
  tbl_thesis, tbl_thesis_borrowing, tbl_thesis_reservation, tbl_thesis_return_request,
  tbl_journal, tbl_journal_borrowing, tbl_journal_reservation, tbl_journal_return_request,
  tbl_user, tbl_category, tbl_fine, tbl_payment, tbl_return,
} from '$lib/server/db/schema/schema.js';
import { and, eq, gte, lte, desc, sql, count, lt, or, isNull, ne } from 'drizzle-orm';
import { updateAllOverdueFines, calculateDaysOverdue, calculateFineAmount } from '$lib/server/utils/fineCalculation.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateRange(period: string) {
  const now = new Date();
  const end = new Date(now);
  let start: Date;
  switch (period) {
    case 'week':    start = new Date(now); start.setDate(now.getDate() - 7);   break;
    case 'month':   start = new Date(now); start.setDate(now.getDate() - 30);  break;
    case 'quarter': start = new Date(now); start.setDate(now.getDate() - 90);  break;
    case 'year':    start = new Date(now); start.setDate(now.getDate() - 365); break;
    default:        start = new Date(0);
  }
  return { start, end };
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url }) => {
  try {
    const period = url.searchParams.get('period') || 'month';
    const { start, end } = getDateRange(period);
    // use Date object for comparisons against timestamp columns
    const today = new Date();

    // Keep fines up to date before building the report
    await updateAllOverdueFines();

    // ══════════════════════════════════════════════════════════════════════════
    // 1. OVERVIEW METRICS  (all run in parallel)
    // ══════════════════════════════════════════════════════════════════════════
    const [
      // Visits
      totalVisitsRes,

      // Borrowings — active
      booksBorrowedActive, magazinesBorrowedActive, thesisBorrowedActive, journalsBorrowedActive,

      // Borrowings — period totals
      booksBorrowedPeriod, magazinesBorrowedPeriod, thesisBorrowedPeriod, journalsBorrowedPeriod,
      booksReturnedPeriod, magazinesReturnedPeriod, thesisReturnedPeriod, journalsReturnedPeriod,

      // Overdue counts
      booksOverdueCnt, magazinesOverdueCnt, thesisOverdueCnt, journalsOverdueCnt,

      // Reservations — pending
      booksPendingRes, magazinesPendingRes, thesisPendingRes, journalsPendingRes,
      // Reservations — period totals
      booksResPeriod, magazinesResPeriod, thesisResPeriod, journalsResPeriod,

      // Return requests — pending
      booksReturnReqPending, magazinesReturnReqPending, thesisReturnReqPending, journalsReturnReqPending,

      // Fines & payments
      totalUnpaidFinesRes, totalPaidFinesRes, paymentsCountRes,

      // Collection sizes
      totalBooksRes, totalMagazinesRes, totalThesisRes, totalJournalsRes,
      totalBookCopiesRes, availableBookCopiesRes,

      // Members
      activeStudentsRes, activeFacultyRes,
      newStudentsRes, newFacultyRes,

    ] = await Promise.all([
      // Visits
      db.select({ count: count() }).from(tbl_library_visit)
        .where(and(gte(tbl_library_visit.timeIn, start), lte(tbl_library_visit.timeIn, end))),

      // Active borrowings
      db.select({ count: count() }).from(tbl_book_borrowing).where(eq(tbl_book_borrowing.status, 'borrowed')),
      db.select({ count: count() }).from(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.status, 'borrowed')),
      db.select({ count: count() }).from(tbl_thesis_borrowing).where(eq(tbl_thesis_borrowing.status, 'borrowed')),
      db.select({ count: count() }).from(tbl_journal_borrowing).where(eq(tbl_journal_borrowing.status, 'borrowed')),

      // Period borrowings
      db.select({ count: count() }).from(tbl_book_borrowing).where(and(gte(tbl_book_borrowing.createdAt, start), lte(tbl_book_borrowing.createdAt, end))),
      db.select({ count: count() }).from(tbl_magazine_borrowing).where(and(gte(tbl_magazine_borrowing.createdAt, start), lte(tbl_magazine_borrowing.createdAt, end))),
      db.select({ count: count() }).from(tbl_thesis_borrowing).where(and(gte(tbl_thesis_borrowing.createdAt, start), lte(tbl_thesis_borrowing.createdAt, end))),
      db.select({ count: count() }).from(tbl_journal_borrowing).where(and(gte(tbl_journal_borrowing.createdAt, start), lte(tbl_journal_borrowing.createdAt, end))),

      // Period returns
      db.select({ count: count() }).from(tbl_book_borrowing).where(and(eq(tbl_book_borrowing.status, 'returned'), gte(tbl_book_borrowing.updatedAt, start), lte(tbl_book_borrowing.updatedAt, end))),
      db.select({ count: count() }).from(tbl_magazine_borrowing).where(and(eq(tbl_magazine_borrowing.status, 'returned'), gte(tbl_magazine_borrowing.updatedAt, start), lte(tbl_magazine_borrowing.updatedAt, end))),
      db.select({ count: count() }).from(tbl_thesis_borrowing).where(and(eq(tbl_thesis_borrowing.status, 'returned'), gte(tbl_thesis_borrowing.updatedAt, start), lte(tbl_thesis_borrowing.updatedAt, end))),
      db.select({ count: count() }).from(tbl_journal_borrowing).where(and(eq(tbl_journal_borrowing.status, 'returned'), gte(tbl_journal_borrowing.updatedAt, start), lte(tbl_journal_borrowing.updatedAt, end))),

      // Overdue (include both 'borrowed' and 'overdue' statuses — updateAllOverdueFines may set status to 'overdue')
      db.select({ count: count() }).from(tbl_book_borrowing).where(and(or(eq(tbl_book_borrowing.status, 'borrowed'), eq(tbl_book_borrowing.status, 'overdue')), lt(tbl_book_borrowing.dueDate, today), isNull(tbl_book_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_magazine_borrowing).where(and(or(eq(tbl_magazine_borrowing.status, 'borrowed'), eq(tbl_magazine_borrowing.status, 'overdue')), lt(tbl_magazine_borrowing.dueDate, today), isNull(tbl_magazine_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_thesis_borrowing).where(and(or(eq(tbl_thesis_borrowing.status, 'borrowed'), eq(tbl_thesis_borrowing.status, 'overdue')), lt(tbl_thesis_borrowing.dueDate, today), isNull(tbl_thesis_borrowing.returnDate))),
      db.select({ count: count() }).from(tbl_journal_borrowing).where(and(or(eq(tbl_journal_borrowing.status, 'borrowed'), eq(tbl_journal_borrowing.status, 'overdue')), lt(tbl_journal_borrowing.dueDate, today), isNull(tbl_journal_borrowing.returnDate))),

      // Pending reservations
      db.select({ count: count() }).from(tbl_book_reservation).where(eq(tbl_book_reservation.status, 'pending')),
      db.select({ count: count() }).from(tbl_magazine_reservation).where(eq(tbl_magazine_reservation.status, 'pending')),
      db.select({ count: count() }).from(tbl_thesis_reservation).where(eq(tbl_thesis_reservation.status, 'pending')),
      db.select({ count: count() }).from(tbl_journal_reservation).where(eq(tbl_journal_reservation.status, 'pending')),

      // Period reservations
      db.select({ count: count() }).from(tbl_book_reservation).where(and(gte(tbl_book_reservation.createdAt, start), lte(tbl_book_reservation.createdAt, end))),
      db.select({ count: count() }).from(tbl_magazine_reservation).where(and(gte(tbl_magazine_reservation.createdAt, start), lte(tbl_magazine_reservation.createdAt, end))),
      db.select({ count: count() }).from(tbl_thesis_reservation).where(and(gte(tbl_thesis_reservation.createdAt, start), lte(tbl_thesis_reservation.createdAt, end))),
      db.select({ count: count() }).from(tbl_journal_reservation).where(and(gte(tbl_journal_reservation.createdAt, start), lte(tbl_journal_reservation.createdAt, end))),

      // Pending return requests
      db.select({ count: count() }).from(tbl_book_return_request).where(eq(tbl_book_return_request.status, 'pending')),
      db.select({ count: count() }).from(tbl_magazine_return_request).where(eq(tbl_magazine_return_request.status, 'pending')),
      db.select({ count: count() }).from(tbl_thesis_return_request).where(eq(tbl_thesis_return_request.status, 'pending')),
      db.select({ count: count() }).from(tbl_journal_return_request).where(eq(tbl_journal_return_request.status, 'pending')),

      // Fines
      db.select({ total: sql<string>`COALESCE(SUM(${tbl_fine.fineAmount}), 0)` }).from(tbl_fine).where(eq(tbl_fine.status, 'unpaid')),
      db.select({ total: sql<string>`COALESCE(SUM(${tbl_fine.fineAmount}), 0)` }).from(tbl_fine).where(eq(tbl_fine.status, 'paid')),
      db.select({ count: count() }).from(tbl_payment).where(and(gte(tbl_payment.paymentDate, start), lte(tbl_payment.paymentDate, end))),

      // Collection sizes
      db.select({ count: count() }).from(tbl_book).where(eq(tbl_book.isActive, true)),
      db.select({ count: count() }).from(tbl_magazine).where(eq(tbl_magazine.isActive, true)),
      db.select({ count: count() }).from(tbl_thesis).where(eq(tbl_thesis.isActive, true)),
      db.select({ count: count() }).from(tbl_journal).where(eq(tbl_journal.isActive, true)),
      db.select({ count: count() }).from(tbl_book_copy).where(eq(tbl_book_copy.isActive, true)),
      db.select({ count: count() }).from(tbl_book_copy).where(and(eq(tbl_book_copy.isActive, true), eq(tbl_book_copy.status, 'available'))),

      // Members
      db.select({ count: count() }).from(tbl_user).where(and(eq(tbl_user.userType, 'student'), eq(tbl_user.isActive, true))),
      db.select({ count: count() }).from(tbl_user).where(and(eq(tbl_user.userType, 'faculty'), eq(tbl_user.isActive, true))),
      db.select({ count: count() }).from(tbl_user).where(and(eq(tbl_user.userType, 'student'), gte(tbl_user.createdAt, start), lte(tbl_user.createdAt, end))),
      db.select({ count: count() }).from(tbl_user).where(and(eq(tbl_user.userType, 'faculty'), gte(tbl_user.createdAt, start), lte(tbl_user.createdAt, end))),
    ]);

    // ── Derived totals ──────────────────────────────────────────────────────
    const n = (r: any[]) => Number(r[0]?.count ?? r[0]?.total ?? 0);

    const totalVisits        = n(totalVisitsRes);
    const activeBorrowings   = n(booksBorrowedActive) + n(magazinesBorrowedActive) + n(thesisBorrowedActive) + n(journalsBorrowedActive);
    const totalBorrowedPeriod= n(booksBorrowedPeriod) + n(magazinesBorrowedPeriod) + n(thesisBorrowedPeriod) + n(journalsBorrowedPeriod);
    const totalReturnedPeriod= n(booksReturnedPeriod) + n(magazinesReturnedPeriod) + n(thesisReturnedPeriod) + n(journalsReturnedPeriod);
    const totalOverdue       = n(booksOverdueCnt) + n(magazinesOverdueCnt) + n(thesisOverdueCnt) + n(journalsOverdueCnt);
    const totalPendingRes    = n(booksPendingRes) + n(magazinesPendingRes) + n(thesisPendingRes) + n(journalsPendingRes);
    const totalResPeriod     = n(booksResPeriod) + n(magazinesResPeriod) + n(thesisResPeriod) + n(journalsResPeriod);
    const totalPendingReturn = n(booksReturnReqPending) + n(magazinesReturnReqPending) + n(thesisReturnReqPending) + n(journalsReturnReqPending);
    const totalUnpaidFines   = Number(totalUnpaidFinesRes[0]?.total ?? 0);
    const totalPaidFines     = Number(totalPaidFinesRes[0]?.total ?? 0);
    const paymentsCount      = n(paymentsCountRes);

    const totalBooks     = n(totalBooksRes);
    const totalMagazines = n(totalMagazinesRes);
    const totalThesis    = n(totalThesisRes);
    const totalJournals  = n(totalJournalsRes);
    const totalItems     = totalBooks + totalMagazines + totalThesis + totalJournals;

    const activeStudents  = n(activeStudentsRes);
    const activeFaculty   = n(activeFacultyRes);
    const activeMembers   = activeStudents + activeFaculty;

    // ══════════════════════════════════════════════════════════════════════════
    // 2. CHART DATA  (parallel)
    // ══════════════════════════════════════════════════════════════════════════
    const [
      // Daily visits trend
      dailyVisitsRaw,
      // Daily borrowings trend (books only for simplicity, we union below)
      dailyBookBorrowsRaw,
      dailyMagBorrowsRaw,
      dailyThesisBorrowsRaw,
      dailyJournalBorrowsRaw,
      // Category distribution (books)
      categoryDistRaw,
      // Penalty trends
      penaltyTrendsRaw,
      // Payment trends
      paymentTrendsRaw,
      // Reservation status distribution
      bookResStatusRaw, magResStatusRaw, thesisResStatusRaw, journalResStatusRaw,
      // Fine status counts
      fineStatusRaw,
    ] = await Promise.all([
      // Daily visits
      db.select({ date: sql<string>`DATE(${tbl_library_visit.timeIn})`, count: count() })
        .from(tbl_library_visit)
        .where(and(gte(tbl_library_visit.timeIn, start), lte(tbl_library_visit.timeIn, end)))
        .groupBy(sql`DATE(${tbl_library_visit.timeIn})`)
        .orderBy(sql`DATE(${tbl_library_visit.timeIn})`),

      // Daily borrows per type
      db.select({ date: sql<string>`DATE(${tbl_book_borrowing.createdAt})`, count: count() })
        .from(tbl_book_borrowing).where(and(gte(tbl_book_borrowing.createdAt, start), lte(tbl_book_borrowing.createdAt, end)))
        .groupBy(sql`DATE(${tbl_book_borrowing.createdAt})`).orderBy(sql`DATE(${tbl_book_borrowing.createdAt})`),
      db.select({ date: sql<string>`DATE(${tbl_magazine_borrowing.createdAt})`, count: count() })
        .from(tbl_magazine_borrowing).where(and(gte(tbl_magazine_borrowing.createdAt, start), lte(tbl_magazine_borrowing.createdAt, end)))
        .groupBy(sql`DATE(${tbl_magazine_borrowing.createdAt})`).orderBy(sql`DATE(${tbl_magazine_borrowing.createdAt})`),
      db.select({ date: sql<string>`DATE(${tbl_thesis_borrowing.createdAt})`, count: count() })
        .from(tbl_thesis_borrowing).where(and(gte(tbl_thesis_borrowing.createdAt, start), lte(tbl_thesis_borrowing.createdAt, end)))
        .groupBy(sql`DATE(${tbl_thesis_borrowing.createdAt})`).orderBy(sql`DATE(${tbl_thesis_borrowing.createdAt})`),
      db.select({ date: sql<string>`DATE(${tbl_journal_borrowing.createdAt})`, count: count() })
        .from(tbl_journal_borrowing).where(and(gte(tbl_journal_borrowing.createdAt, start), lte(tbl_journal_borrowing.createdAt, end)))
        .groupBy(sql`DATE(${tbl_journal_borrowing.createdAt})`).orderBy(sql`DATE(${tbl_journal_borrowing.createdAt})`),

      // Category distribution
      db.select({ category: tbl_category.name, count: count() })
        .from(tbl_book).leftJoin(tbl_category, eq(tbl_book.categoryId, tbl_category.id))
        .where(eq(tbl_book.isActive, true))
        .groupBy(tbl_category.id, tbl_category.name).orderBy(desc(count())),

      // Penalty trends (weekly)
      db.select({
        week: sql<string>`DATE_TRUNC('week', ${tbl_fine.createdAt})`,
        total: sql<number>`COALESCE(SUM(${tbl_fine.fineAmount}), 0)`
      }).from(tbl_fine).where(and(gte(tbl_fine.createdAt, start), lte(tbl_fine.createdAt, end)))
        .groupBy(sql`DATE_TRUNC('week', ${tbl_fine.createdAt})`).orderBy(sql`DATE_TRUNC('week', ${tbl_fine.createdAt})`),

      // Payment trends (daily)
      db.select({
        date: sql<string>`DATE(${tbl_payment.paymentDate})`,
        total: sql<number>`COALESCE(SUM(${tbl_payment.amount}), 0)`,
        count: count()
      }).from(tbl_payment).where(and(gte(tbl_payment.paymentDate, start), lte(tbl_payment.paymentDate, end)))
        .groupBy(sql`DATE(${tbl_payment.paymentDate})`).orderBy(sql`DATE(${tbl_payment.paymentDate})`),

      // Reservation status breakdown per type
      db.select({ status: tbl_book_reservation.status, count: count() }).from(tbl_book_reservation)
        .where(and(gte(tbl_book_reservation.createdAt, start), lte(tbl_book_reservation.createdAt, end)))
        .groupBy(tbl_book_reservation.status),
      db.select({ status: tbl_magazine_reservation.status, count: count() }).from(tbl_magazine_reservation)
        .where(and(gte(tbl_magazine_reservation.createdAt, start), lte(tbl_magazine_reservation.createdAt, end)))
        .groupBy(tbl_magazine_reservation.status),
      db.select({ status: tbl_thesis_reservation.status, count: count() }).from(tbl_thesis_reservation)
        .where(and(gte(tbl_thesis_reservation.createdAt, start), lte(tbl_thesis_reservation.createdAt, end)))
        .groupBy(tbl_thesis_reservation.status),
      db.select({ status: tbl_journal_reservation.status, count: count() }).from(tbl_journal_reservation)
        .where(and(gte(tbl_journal_reservation.createdAt, start), lte(tbl_journal_reservation.createdAt, end)))
        .groupBy(tbl_journal_reservation.status),

      // Fine status
      db.select({ status: tbl_fine.status, count: count(), total: sql<number>`COALESCE(SUM(${tbl_fine.fineAmount}), 0)` })
        .from(tbl_fine).groupBy(tbl_fine.status),
    ]);

    // ── Merge daily borrows into a date-keyed map ───────────────────────────
    const borrowDateMap: Record<string, { books: number; magazines: number; thesis: number; journals: number }> = {};
    const addToBorrowMap = (rows: any[], key: keyof typeof borrowDateMap[string]) => {
      rows.forEach(r => {
        if (!borrowDateMap[r.date]) borrowDateMap[r.date] = { books: 0, magazines: 0, thesis: 0, journals: 0 };
        borrowDateMap[r.date][key] = r.count;
      });
    };
    addToBorrowMap(dailyBookBorrowsRaw,    'books');
    addToBorrowMap(dailyMagBorrowsRaw,     'magazines');
    addToBorrowMap(dailyThesisBorrowsRaw,  'thesis');
    addToBorrowMap(dailyJournalBorrowsRaw, 'journals');
    const dailyBorrowings = Object.entries(borrowDateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts, total: counts.books + counts.magazines + counts.thesis + counts.journals }));

    // ── Category distribution ───────────────────────────────────────────────
    const totalCatCount = categoryDistRaw.reduce((s, c) => s + c.count, 0);
    const categoryDistribution = categoryDistRaw.map(item => ({
      category: item.category || 'Uncategorized',
      count: item.count,
      percentage: totalCatCount > 0 ? Math.round((item.count / totalCatCount) * 100) : 0,
    }));

    // ── Merge reservation statuses ──────────────────────────────────────────
    const resStatusMap: Record<string, number> = {};
    const addResStatus = (rows: any[]) => rows.forEach(r => {
      resStatusMap[r.status] = (resStatusMap[r.status] || 0) + r.count;
    });
    addResStatus(bookResStatusRaw); addResStatus(magResStatusRaw);
    addResStatus(thesisResStatusRaw); addResStatus(journalResStatusRaw);
    const reservationStatusBreakdown = Object.entries(resStatusMap).map(([status, count]) => ({ status, count }));

    // ── Fine status ─────────────────────────────────────────────────────────
    const fineBreakdown = fineStatusRaw.map(r => ({
      status: r.status,
      count: r.count,
      total: Number(r.total),
    }));

    // ══════════════════════════════════════════════════════════════════════════
    // 3. TABLE DATA  (parallel detail queries)
    // ══════════════════════════════════════════════════════════════════════════
    const [
      topBooksRaw, topMagazinesRaw, topThesisRaw, topJournalsRaw,
      overdueBooksList, overdueMagazinesList, overdueThesisList, overdueJournalsList,
      recentPaymentsRaw,
      userFinesRaw,
    ] = await Promise.all([
      // Top borrowed per type
      db.select({ title: tbl_book.title, author: tbl_book.author, borrowCount: count() })
        .from(tbl_book_borrowing).leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
        .where(and(gte(tbl_book_borrowing.createdAt, start), lte(tbl_book_borrowing.createdAt, end)))
        .groupBy(tbl_book.id, tbl_book.title, tbl_book.author).orderBy(desc(count())).limit(5),

      db.select({ title: tbl_magazine.title, author: tbl_magazine.publisher, borrowCount: count() })
        .from(tbl_magazine_borrowing).leftJoin(tbl_magazine, eq(tbl_magazine_borrowing.magazineId, tbl_magazine.id))
        .where(and(gte(tbl_magazine_borrowing.createdAt, start), lte(tbl_magazine_borrowing.createdAt, end)))
        .groupBy(tbl_magazine.id, tbl_magazine.title, tbl_magazine.publisher).orderBy(desc(count())).limit(5),

      db.select({ title: tbl_thesis.title, author: tbl_thesis.author, borrowCount: count() })
        .from(tbl_thesis_borrowing).leftJoin(tbl_thesis, eq(tbl_thesis_borrowing.thesisId, tbl_thesis.id))
        .where(and(gte(tbl_thesis_borrowing.createdAt, start), lte(tbl_thesis_borrowing.createdAt, end)))
        .groupBy(tbl_thesis.id, tbl_thesis.title, tbl_thesis.author).orderBy(desc(count())).limit(5),

      db.select({ title: tbl_journal.title, author: tbl_journal.publisher, borrowCount: count() })
        .from(tbl_journal_borrowing).leftJoin(tbl_journal, eq(tbl_journal_borrowing.journalId, tbl_journal.id))
        .where(and(gte(tbl_journal_borrowing.createdAt, start), lte(tbl_journal_borrowing.createdAt, end)))
        .groupBy(tbl_journal.id, tbl_journal.title, tbl_journal.publisher).orderBy(desc(count())).limit(5),

      // Overdue detail lists
      db.select({ title: tbl_book.title, borrowerName: tbl_user.name, dueDate: tbl_book_borrowing.dueDate })
        .from(tbl_book_borrowing).leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
        .leftJoin(tbl_user, eq(tbl_book_borrowing.userId, tbl_user.id))
        .where(and(or(eq(tbl_book_borrowing.status, 'borrowed'), eq(tbl_book_borrowing.status, 'overdue')), lt(tbl_book_borrowing.dueDate, today), isNull(tbl_book_borrowing.returnDate)))
        .orderBy(tbl_book_borrowing.dueDate).limit(5),

      db.select({ title: tbl_magazine.title, borrowerName: tbl_user.name, dueDate: tbl_magazine_borrowing.dueDate })
        .from(tbl_magazine_borrowing).leftJoin(tbl_magazine, eq(tbl_magazine_borrowing.magazineId, tbl_magazine.id))
        .leftJoin(tbl_user, eq(tbl_magazine_borrowing.userId, tbl_user.id))
        .where(and(or(eq(tbl_magazine_borrowing.status, 'borrowed'), eq(tbl_magazine_borrowing.status, 'overdue')), lt(tbl_magazine_borrowing.dueDate, today), isNull(tbl_magazine_borrowing.returnDate)))
        .orderBy(tbl_magazine_borrowing.dueDate).limit(5),

      db.select({ title: tbl_thesis.title, borrowerName: tbl_user.name, dueDate: tbl_thesis_borrowing.dueDate })
        .from(tbl_thesis_borrowing).leftJoin(tbl_thesis, eq(tbl_thesis_borrowing.thesisId, tbl_thesis.id))
        .leftJoin(tbl_user, eq(tbl_thesis_borrowing.userId, tbl_user.id))
        .where(and(or(eq(tbl_thesis_borrowing.status, 'borrowed'), eq(tbl_thesis_borrowing.status, 'overdue')), lt(tbl_thesis_borrowing.dueDate, today), isNull(tbl_thesis_borrowing.returnDate)))
        .orderBy(tbl_thesis_borrowing.dueDate).limit(5),

      db.select({ title: tbl_journal.title, borrowerName: tbl_user.name, dueDate: tbl_journal_borrowing.dueDate })
        .from(tbl_journal_borrowing).leftJoin(tbl_journal, eq(tbl_journal_borrowing.journalId, tbl_journal.id))
        .leftJoin(tbl_user, eq(tbl_journal_borrowing.userId, tbl_user.id))
        .where(and(or(eq(tbl_journal_borrowing.status, 'borrowed'), eq(tbl_journal_borrowing.status, 'overdue')), lt(tbl_journal_borrowing.dueDate, today), isNull(tbl_journal_borrowing.returnDate)))
        .orderBy(tbl_journal_borrowing.dueDate).limit(5),

      // Recent payments
      db.select({
        transactionId: tbl_payment.transactionId,
        memberName: tbl_user.name,
        amount: tbl_payment.amount,
        paymentType: tbl_payment.paymentType,
        paymentMethod: tbl_payment.paymentMethod,
        paymentDate: tbl_payment.paymentDate,
      }).from(tbl_payment)
        .leftJoin(tbl_user, eq(tbl_payment.userId, tbl_user.id))
        .where(and(gte(tbl_payment.paymentDate, start), lte(tbl_payment.paymentDate, end)))
        .orderBy(desc(tbl_payment.paymentDate)).limit(10),

      // Top users by fines
      db.select({
        memberName: tbl_user.name,
        userType: tbl_user.userType,
        totalFine: sql<number>`COALESCE(SUM(${tbl_fine.fineAmount}), 0)`,
        fineCount: count(),
      }).from(tbl_fine)
        .leftJoin(tbl_user, eq(tbl_fine.userId, tbl_user.id))
        .where(eq(tbl_fine.status, 'unpaid'))
        .groupBy(tbl_user.id, tbl_user.name, tbl_user.userType)
        .orderBy(desc(sql`SUM(${tbl_fine.fineAmount})`)).limit(5),
    ]);

    // ── Process overdue list (merge all types) ──────────────────────────────
    // Build overdue list while calculating days and fines taking exemptions into account
    const combinedOverdues = [
      ...overdueBooksList.map(r => ({ ...r, itemType: 'Book' })),
      ...overdueMagazinesList.map(r => ({ ...r, itemType: 'Magazine' })),
      ...overdueThesisList.map(r => ({ ...r, itemType: 'Thesis' })),
      ...overdueJournalsList.map(r => ({ ...r, itemType: 'Journal' })),
    ];

    const overdueListDetailed = await Promise.all(combinedOverdues.map(async (r: any) => {
      const days = r.dueDate ? await calculateDaysOverdue(new Date(r.dueDate)) : 0;
      const fine = r.dueDate ? await calculateFineAmount(new Date(r.dueDate)) : 0;
      const hoursOverdue = fine > 0 ? Math.ceil(fine / 500) : 0;
      return {
        itemTitle: r.title || 'Unknown',
        borrowerName: r.borrowerName || 'Unknown',
        itemType: r.itemType,
        dueDate: r.dueDate,
        daysOverdue: days,
        fine: fine,
        hoursOverdue,
      };
    }));

    const overdueList = overdueListDetailed.sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 10);

    // ── Top items unified list ──────────────────────────────────────────────
    const topItems = [
      ...topBooksRaw.map(r => ({ ...r, itemType: 'Book' })),
      ...topMagazinesRaw.map(r => ({ ...r, itemType: 'Magazine' })),
      ...topThesisRaw.map(r => ({ ...r, itemType: 'Thesis' })),
      ...topJournalsRaw.map(r => ({ ...r, itemType: 'Journal' })),
    ]
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 10)
      .map(r => ({
        title: r.title || 'Unknown',
        author: r.author || '—',
        itemType: r.itemType,
        borrowCount: r.borrowCount,
      }));

    // ── Recent payments ─────────────────────────────────────────────────────
    const recentPayments = recentPaymentsRaw.map(r => ({
      transactionId: r.transactionId,
      memberName: r.memberName || 'Unknown',
      amount: Number(r.amount),
      paymentType: r.paymentType,
      paymentMethod: r.paymentMethod || 'cash',
      paymentDate: r.paymentDate,
    }));

    // ── Users with outstanding fines ────────────────────────────────────────
    const topDebtors = userFinesRaw.map(r => ({
      memberName: r.memberName || 'Unknown',
      userType: r.userType,
      totalFine: Number(r.totalFine),
      fineCount: r.fineCount,
    }));

    // ══════════════════════════════════════════════════════════════════════════
    // 4. COMPOSE RESPONSE
    // ══════════════════════════════════════════════════════════════════════════
    return json({
      success: true,
      data: {
        overview: {
          // Visits
          totalVisits,
          // Members
          activeMembers,
          activeStudents,
          activeFaculty,
          newMembers: n(newStudentsRes) + n(newFacultyRes),
          // Borrowings
          activeBorrowings,
          totalBorrowedPeriod,
          totalReturnedPeriod,
          // Overdue
          totalOverdue,
          overdueByType: {
            books:     n(booksOverdueCnt),
            magazines: n(magazinesOverdueCnt),
            thesis:    n(thesisOverdueCnt),
            journals:  n(journalsOverdueCnt),
          },
          // Reservations
          totalPendingReservations: totalPendingRes,
          totalReservationsPeriod: totalResPeriod,
          // Return requests
          totalPendingReturnRequests: totalPendingReturn,
          // Fines
          totalUnpaidFines,
          totalPaidFines,
          paymentsCount,
          // Collection
          totalItems,
          totalBooks,
          totalMagazines,
          totalThesis,
          totalJournals,
          totalBookCopies:     n(totalBookCopiesRes),
          availableBookCopies: n(availableBookCopiesRes),
        },
        charts: {
          dailyVisits: dailyVisitsRaw.map(r => ({ date: r.date, count: r.count })),
          dailyBorrowings,
          categoryDistribution,
          penaltyTrends: penaltyTrendsRaw.map(r => ({ date: r.week, amount: Number(r.total) })),
          paymentTrends: paymentTrendsRaw.map(r => ({ date: r.date, amount: Number(r.total), count: r.count })),
          borrowingsByType: [
            { type: 'Books',     borrowed: n(booksBorrowedPeriod),    returned: n(booksReturnedPeriod),    overdue: n(booksOverdueCnt) },
            { type: 'Magazines', borrowed: n(magazinesBorrowedPeriod),returned: n(magazinesReturnedPeriod),overdue: n(magazinesOverdueCnt) },
            { type: 'Thesis',    borrowed: n(thesisBorrowedPeriod),   returned: n(thesisReturnedPeriod),   overdue: n(thesisOverdueCnt) },
            { type: 'Journals',  borrowed: n(journalsBorrowedPeriod), returned: n(journalsReturnedPeriod), overdue: n(journalsOverdueCnt) },
          ],
          transactionTypes: [
            { type: 'Borrowed', count: totalBorrowedPeriod },
            { type: 'Returned', count: totalReturnedPeriod },
            { type: 'Overdue',  count: totalOverdue },
            { type: 'Reserved', count: totalResPeriod },
          ],
          reservationStatusBreakdown,
          fineBreakdown,
          memberActivity: [
            { type: 'Students', active: activeStudents, new: n(newStudentsRes) },
            { type: 'Faculty',  active: activeFaculty,  new: n(newFacultyRes) },
          ],
          collectionBreakdown: [
            { type: 'Books',     count: totalBooks },
            { type: 'Magazines', count: totalMagazines },
            { type: 'Thesis',    count: totalThesis },
            { type: 'Journals',  count: totalJournals },
          ],
        },
        tables: {
          topItems,
          overdueList,
          recentPayments,
          topDebtors,
        },
      },
    });

  } catch (err) {
    console.error('Reports API error:', err);
    throw error(500, { message: 'Internal server error' });
  }
};