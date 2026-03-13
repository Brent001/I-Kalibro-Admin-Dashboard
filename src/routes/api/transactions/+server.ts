// src/routes/api/transactions/+server.ts - Unified transaction management

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and, desc, count, inArray, lt, or, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_book_borrowing,
    tbl_magazine_borrowing,
    tbl_thesis_borrowing,
    tbl_journal_borrowing,
    tbl_book_reservation,
    tbl_magazine_reservation,
    tbl_thesis_reservation,
    tbl_journal_reservation,
    tbl_book,
    tbl_magazine,
    tbl_thesis,
    tbl_journal,
    tbl_user,
    tbl_staff,
    tbl_book_copy,
    tbl_magazine_copy,
    tbl_thesis_copy,
    tbl_journal_copy,
    tbl_super_admin,
    tbl_admin,
    tbl_student,
    tbl_faculty
} from '$lib/server/db/schema/schema.js';
import { loadFineSettings, calculateFineAmount, calculateDaysOverdue } from '$lib/server/utils/fineCalculation.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// How long (in ms) after a return before the record is promoted to 'fulfilled'.
// Must match REVERSAL_WINDOW_MS in the revert endpoint.
const FULFILLMENT_DELAY_MS = 60 * 60 * 1000; // 1 hour

// ─── Reservation status reference ────────────────────────────────────────────
// tbl_*_reservation.status values (from schema + app logic):
//   'pending'   – submitted, awaiting staff review
//   'approved'  – approved by staff, item held for pickup
//   'rejected'  – rejected by staff
//   'fulfilled' – converted into a borrowing record
//   'expired'   – passed expiry date without pickup
//   'cancelled' – cancelled by user or staff
//
// Tab mapping:
//   'reserve'   tab → pending + approved   (open/actionable)
//   'fulfilled' tab → fulfilled            (alongside fulfilled borrowings)
//   'cancelled' tab → cancelled + rejected + expired
//   'all'       tab → all statuses (no filter)
//   any other tab   → sql`false`  (exclude reservations entirely)
// ─────────────────────────────────────────────────────────────────────────────

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin' | 'staff' | 'user';
}

async function authenticateUser(request: Request): Promise<AuthenticatedUser | null> {
    try {
        let token: string | null = null;

        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);

        if (!token) {
            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
                const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
                token = cookies.token;
            }
        }

        if (!token) return null;

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId  = decoded.userId;
        if (!userId) return null;

        const [staff] = await db.select({ id: tbl_staff.id }).from(tbl_staff)
            .where(and(eq(tbl_staff.id, userId), eq(tbl_staff.isActive, true))).limit(1);
        if (staff) return { id: userId, userType: 'staff' };

        const [admin] = await db.select({ id: tbl_admin.id }).from(tbl_admin)
            .where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true))).limit(1);
        if (admin) return { id: userId, userType: 'admin' };

        const [superAdmin] = await db.select({ id: tbl_super_admin.id }).from(tbl_super_admin)
            .where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true))).limit(1);
        if (superAdmin) return { id: userId, userType: 'super_admin' };

        const [user] = await db.select({ id: tbl_user.id }).from(tbl_user)
            .where(and(eq(tbl_user.id, userId), eq(tbl_user.isActive, true))).limit(1);
        if (user) return { id: userId, userType: 'user' };

        return null;
    } catch (err) {
        console.error('Auth error:', err);
        return null;
    }
}

/**
 * Promote 'returned' borrowings older than FULFILLMENT_DELAY_MS to 'fulfilled'.
 * Runs at the top of every GET so tab counts are always accurate without a cron job.
 */
async function promoteExpiredReturns(): Promise<void> {
    const cutoff = new Date(Date.now() - FULFILLMENT_DELAY_MS);
    try {
        await Promise.all([
            db.update(tbl_book_borrowing).set({ status: 'fulfilled' })
                .where(and(eq(tbl_book_borrowing.status, 'returned'), lt(tbl_book_borrowing.returnDate, cutoff))),
            db.update(tbl_magazine_borrowing).set({ status: 'fulfilled' })
                .where(and(eq(tbl_magazine_borrowing.status, 'returned'), lt(tbl_magazine_borrowing.returnDate, cutoff))),
            db.update(tbl_thesis_borrowing).set({ status: 'fulfilled' })
                .where(and(eq(tbl_thesis_borrowing.status, 'returned'), lt(tbl_thesis_borrowing.returnDate, cutoff))),
            db.update(tbl_journal_borrowing).set({ status: 'fulfilled' })
                .where(and(eq(tbl_journal_borrowing.status, 'returned'), lt(tbl_journal_borrowing.returnDate, cutoff))),
        ]);
    } catch (err) {
        console.warn('[transactions] promoteExpiredReturns error (non-fatal):', err);
    }
}

/**
 * Returns the Drizzle condition to filter reservation records for the active tab,
 * or null if no status filter should be applied (tab === 'all').
 */
function reservationStatusCond(statusCol: any, tab: string): any {
    switch (tab) {
        case 'reserve':   return inArray(statusCol, ['pending', 'approved']);
        case 'fulfilled': return eq(statusCol, 'fulfilled');
        case 'cancelled': return inArray(statusCol, ['cancelled', 'rejected', 'expired']);
        case 'all':       return null; // no filter — include all statuses
        default:          return sql`false`; // borrow / return / overdue tabs: hide reservations
    }
}

/** Map a borrowing record status to a display transaction type. */
function borrowType(status: string | null): string {
    if (!status) return 'borrow';
    const s = status.toLowerCase();
    if (s === 'returned' || s === 'fulfilled') return 'return';
    return 'borrow';
}

// ════════════════════════════════════════════════════════════════════════════
// GET - Fetch all transactions
// ════════════════════════════════════════════════════════════════════════════
export const GET: RequestHandler = async ({ request, url }) => {
    try {
        // Promote returned → fulfilled after 1-hour revert window expires
        await promoteExpiredReturns();

        const user = await authenticateUser(request);
        if (!user) throw error(401, { message: 'Unauthorized' });

        const page      = parseInt(url.searchParams.get('page')  || '1',  10);
        const limit     = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 500);
        const itemType  = url.searchParams.get('itemType') || 'all';
        const transType = url.searchParams.get('type') || null;
        const offset    = (page - 1) * limit;

        const search     = url.searchParams.get('search')     || '';
        const tab        = url.searchParams.get('tab')        || 'all';
        const period     = url.searchParams.get('period')     || 'all';
        const customDays = url.searchParams.get('customDays') || '';

        // Date range filter
        let fromDate: Date | null = null;
        if (period !== 'all') {
            let days: number | null = null;
            if (period === 'custom' && customDays) days = parseInt(customDays, 10);
            else if (period.endsWith('d'))         days = parseInt(period.slice(0, -1), 10);
            if (days && !isNaN(days)) {
                fromDate = new Date();
                fromDate.setDate(fromDate.getDate() - days);
            }
        }

        let transactions: any[] = [];
        let totalCount = 0;

        // ════════════════════════════════════════════════════════════════════
        // BOOKS
        // ════════════════════════════════════════════════════════════════════
        if (itemType === 'book' || itemType === 'all') {

            // Book borrowings
            if (!transType || transType === 'borrow' || transType === 'return') {
                const conds: any[] = [];
                if (search) conds.push(or(
                    sql`${tbl_book.title} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_book_copy.callNumber} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                ));
                if (fromDate) conds.push(sql`${tbl_book_borrowing.createdAt} >= ${fromDate}`);
                if      (tab === 'borrow')    conds.push(inArray(tbl_book_borrowing.status, ['borrowed', 'overdue']));
                else if (tab === 'return')    conds.push(eq(tbl_book_borrowing.status, 'returned'));
                else if (tab === 'fulfilled') conds.push(eq(tbl_book_borrowing.status, 'fulfilled'));
                else if (tab === 'cancelled') conds.push(eq(tbl_book_borrowing.status, 'cancelled'));
                else if (tab === 'overdue')   conds.push(and(inArray(tbl_book_borrowing.status, ['borrowed', 'overdue']), lt(tbl_book_borrowing.dueDate, new Date()), isNull(tbl_book_borrowing.returnDate)));
                else if (tab === 'reserve')   conds.push(sql`false`);

                const [{ count: c }] = await db.select({ count: count() }).from(tbl_book_borrowing)
                    .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
                    .leftJoin(tbl_book_copy, eq(tbl_book_borrowing.bookCopyId, tbl_book_copy.id))
                    .leftJoin(tbl_user, eq(tbl_book_borrowing.userId, tbl_user.id))
                    .where(and(...conds));
                totalCount += Number(c) || 0;

                const rows = await db.select({
                    id: tbl_book_borrowing.id, itemType: sql<string>`'book'`,
                    itemId: tbl_book.id, itemTitle: tbl_book.title, callNumber: tbl_book_copy.callNumber,
                    userId: tbl_user.id, userName: tbl_user.name,
                    borrowDate: tbl_book_borrowing.borrowDate, dueDate: tbl_book_borrowing.dueDate,
                    returnDate: tbl_book_borrowing.returnDate, status: tbl_book_borrowing.status,
                    approvedBy: tbl_book_borrowing.approvedBy, createdAt: tbl_book_borrowing.createdAt
                }).from(tbl_book_borrowing)
                    .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
                    .leftJoin(tbl_book_copy, eq(tbl_book_borrowing.bookCopyId, tbl_book_copy.id))
                    .leftJoin(tbl_user, eq(tbl_book_borrowing.userId, tbl_user.id))
                    .where(and(...conds)).orderBy(desc(tbl_book_borrowing.createdAt));

                transactions.push(...rows.map(t => ({ ...t, type: borrowType(t.status), recordKind: 'borrowing' })));
            }

            // Book reservations
            if (!transType || transType === 'reserve') {
                const sc = reservationStatusCond(tbl_book_reservation.status, tab);
                const conds: any[] = [];
                if (sc) conds.push(sc);
                if (search) conds.push(or(
                    sql`${tbl_book.title} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                ));
                if (fromDate) conds.push(sql`${tbl_book_reservation.createdAt} >= ${fromDate}`);

                const [{ count: c }] = await db.select({ count: count() }).from(tbl_book_reservation)
                    .leftJoin(tbl_book, eq(tbl_book_reservation.bookId, tbl_book.id))
                    .leftJoin(tbl_user, eq(tbl_book_reservation.userId, tbl_user.id))
                    .where(and(...conds));
                totalCount += Number(c) || 0;

                const rows = await db.select({
                    id: tbl_book_reservation.id, itemType: sql<string>`'book'`,
                    itemId: tbl_book.id, itemTitle: tbl_book.title, callNumber: sql<string | null>`null`,
                    userId: tbl_user.id, userName: tbl_user.name,
                    borrowDate: tbl_book_reservation.requestedBorrowDate, dueDate: tbl_book_reservation.requestedDueDate,
                    returnDate: sql<string | null>`null`, status: tbl_book_reservation.status,
                    approvedBy: tbl_book_reservation.reviewedBy, createdAt: tbl_book_reservation.createdAt
                }).from(tbl_book_reservation)
                    .leftJoin(tbl_book, eq(tbl_book_reservation.bookId, tbl_book.id))
                    .leftJoin(tbl_user, eq(tbl_book_reservation.userId, tbl_user.id))
                    .where(and(...conds)).orderBy(desc(tbl_book_reservation.createdAt));

                transactions.push(...rows.map(t => ({ ...t, type: 'reserve', recordKind: 'reservation' })));
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // MAGAZINES
        // ════════════════════════════════════════════════════════════════════
        if (itemType === 'magazine' || itemType === 'all') {

            // Magazine borrowings
            if (!transType || transType === 'borrow' || transType === 'return') {
                const conds: any[] = [];
                if (search) conds.push(or(
                    sql`${tbl_magazine.title} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_magazine_copy.callNumber} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                ));
                if (fromDate) conds.push(sql`${tbl_magazine_borrowing.createdAt} >= ${fromDate}`);
                if      (tab === 'borrow')    conds.push(inArray(tbl_magazine_borrowing.status, ['borrowed', 'overdue']));
                else if (tab === 'return')    conds.push(eq(tbl_magazine_borrowing.status, 'returned'));
                else if (tab === 'fulfilled') conds.push(eq(tbl_magazine_borrowing.status, 'fulfilled'));
                else if (tab === 'cancelled') conds.push(eq(tbl_magazine_borrowing.status, 'cancelled'));
                else if (tab === 'overdue')   conds.push(and(inArray(tbl_magazine_borrowing.status, ['borrowed', 'overdue']), lt(tbl_magazine_borrowing.dueDate, new Date()), isNull(tbl_magazine_borrowing.returnDate)));
                else if (tab === 'reserve')   conds.push(sql`false`);

                const [{ count: c }] = await db.select({ count: count() }).from(tbl_magazine_borrowing)
                    .leftJoin(tbl_magazine, eq(tbl_magazine_borrowing.magazineId, tbl_magazine.id))
                    .leftJoin(tbl_magazine_copy, eq(tbl_magazine_borrowing.magazineCopyId, tbl_magazine_copy.id))
                    .leftJoin(tbl_user, eq(tbl_magazine_borrowing.userId, tbl_user.id))
                    .where(and(...conds));
                totalCount += Number(c) || 0;

                const rows = await db.select({
                    id: tbl_magazine_borrowing.id, itemType: sql<string>`'magazine'`,
                    itemId: tbl_magazine.id, itemTitle: tbl_magazine.title, callNumber: tbl_magazine_copy.callNumber,
                    userId: tbl_user.id, userName: tbl_user.name,
                    borrowDate: tbl_magazine_borrowing.borrowDate, dueDate: tbl_magazine_borrowing.dueDate,
                    returnDate: tbl_magazine_borrowing.returnDate, status: tbl_magazine_borrowing.status,
                    approvedBy: tbl_magazine_borrowing.approvedBy, createdAt: tbl_magazine_borrowing.createdAt
                }).from(tbl_magazine_borrowing)
                    .leftJoin(tbl_magazine, eq(tbl_magazine_borrowing.magazineId, tbl_magazine.id))
                    .leftJoin(tbl_magazine_copy, eq(tbl_magazine_borrowing.magazineCopyId, tbl_magazine_copy.id))
                    .leftJoin(tbl_user, eq(tbl_magazine_borrowing.userId, tbl_user.id))
                    .where(and(...conds)).orderBy(desc(tbl_magazine_borrowing.createdAt));

                transactions.push(...rows.map(t => ({ ...t, type: borrowType(t.status), recordKind: 'borrowing' })));
            }

            // Magazine reservations
            if (!transType || transType === 'reserve') {
                const sc = reservationStatusCond(tbl_magazine_reservation.status, tab);
                const conds: any[] = [];
                if (sc) conds.push(sc);
                if (search) conds.push(or(
                    sql`${tbl_magazine.title} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                ));
                if (fromDate) conds.push(sql`${tbl_magazine_reservation.createdAt} >= ${fromDate}`);

                const [{ count: c }] = await db.select({ count: count() }).from(tbl_magazine_reservation)
                    .leftJoin(tbl_magazine, eq(tbl_magazine_reservation.magazineId, tbl_magazine.id))
                    .leftJoin(tbl_user, eq(tbl_magazine_reservation.userId, tbl_user.id))
                    .where(and(...conds));
                totalCount += Number(c) || 0;

                const rows = await db.select({
                    id: tbl_magazine_reservation.id, itemType: sql<string>`'magazine'`,
                    itemId: tbl_magazine.id, itemTitle: tbl_magazine.title, callNumber: sql<string | null>`null`,
                    userId: tbl_user.id, userName: tbl_user.name,
                    borrowDate: tbl_magazine_reservation.requestedBorrowDate, dueDate: tbl_magazine_reservation.requestedDueDate,
                    returnDate: sql<string | null>`null`, status: tbl_magazine_reservation.status,
                    approvedBy: tbl_magazine_reservation.reviewedBy, createdAt: tbl_magazine_reservation.createdAt
                }).from(tbl_magazine_reservation)
                    .leftJoin(tbl_magazine, eq(tbl_magazine_reservation.magazineId, tbl_magazine.id))
                    .leftJoin(tbl_user, eq(tbl_magazine_reservation.userId, tbl_user.id))
                    .where(and(...conds)).orderBy(desc(tbl_magazine_reservation.createdAt));

                transactions.push(...rows.map(t => ({ ...t, type: 'reserve', recordKind: 'reservation' })));
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // THESIS
        // ════════════════════════════════════════════════════════════════════
        if (itemType === 'thesis' || itemType === 'all') {

            // Thesis borrowings
            if (!transType || transType === 'borrow' || transType === 'return') {
                const conds: any[] = [];
                if (search) conds.push(or(
                    sql`${tbl_thesis.title} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_thesis_copy.callNumber} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                ));
                if (fromDate) conds.push(sql`${tbl_thesis_borrowing.createdAt} >= ${fromDate}`);
                if      (tab === 'borrow')    conds.push(inArray(tbl_thesis_borrowing.status, ['borrowed', 'overdue']));
                else if (tab === 'return')    conds.push(eq(tbl_thesis_borrowing.status, 'returned'));
                else if (tab === 'fulfilled') conds.push(eq(tbl_thesis_borrowing.status, 'fulfilled'));
                else if (tab === 'cancelled') conds.push(eq(tbl_thesis_borrowing.status, 'cancelled'));
                else if (tab === 'overdue')   conds.push(and(inArray(tbl_thesis_borrowing.status, ['borrowed', 'overdue']), lt(tbl_thesis_borrowing.dueDate, new Date()), isNull(tbl_thesis_borrowing.returnDate)));
                else if (tab === 'reserve')   conds.push(sql`false`);

                const [{ count: c }] = await db.select({ count: count() }).from(tbl_thesis_borrowing)
                    .leftJoin(tbl_thesis, eq(tbl_thesis_borrowing.thesisId, tbl_thesis.id))
                    .leftJoin(tbl_thesis_copy, eq(tbl_thesis_borrowing.thesisCopyId, tbl_thesis_copy.id))
                    .leftJoin(tbl_user, eq(tbl_thesis_borrowing.userId, tbl_user.id))
                    .where(and(...conds));
                totalCount += Number(c) || 0;

                const rows = await db.select({
                    id: tbl_thesis_borrowing.id, itemType: sql<string>`'thesis'`,
                    itemId: tbl_thesis.id, itemTitle: tbl_thesis.title, callNumber: tbl_thesis_copy.callNumber,
                    userId: tbl_user.id, userName: tbl_user.name,
                    borrowDate: tbl_thesis_borrowing.borrowDate, dueDate: tbl_thesis_borrowing.dueDate,
                    returnDate: tbl_thesis_borrowing.returnDate, status: tbl_thesis_borrowing.status,
                    approvedBy: tbl_thesis_borrowing.approvedBy, createdAt: tbl_thesis_borrowing.createdAt
                }).from(tbl_thesis_borrowing)
                    .leftJoin(tbl_thesis, eq(tbl_thesis_borrowing.thesisId, tbl_thesis.id))
                    .leftJoin(tbl_thesis_copy, eq(tbl_thesis_borrowing.thesisCopyId, tbl_thesis_copy.id))
                    .leftJoin(tbl_user, eq(tbl_thesis_borrowing.userId, tbl_user.id))
                    .where(and(...conds)).orderBy(desc(tbl_thesis_borrowing.createdAt));

                transactions.push(...rows.map(t => ({ ...t, type: borrowType(t.status), recordKind: 'borrowing' })));
            }

            // Thesis reservations
            if (!transType || transType === 'reserve') {
                const sc = reservationStatusCond(tbl_thesis_reservation.status, tab);
                const conds: any[] = [];
                if (sc) conds.push(sc);
                if (search) conds.push(or(
                    sql`${tbl_thesis.title} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                ));
                if (fromDate) conds.push(sql`${tbl_thesis_reservation.createdAt} >= ${fromDate}`);

                const [{ count: c }] = await db.select({ count: count() }).from(tbl_thesis_reservation)
                    .leftJoin(tbl_thesis, eq(tbl_thesis_reservation.thesisId, tbl_thesis.id))
                    .leftJoin(tbl_user, eq(tbl_thesis_reservation.userId, tbl_user.id))
                    .where(and(...conds));
                totalCount += Number(c) || 0;

                const rows = await db.select({
                    id: tbl_thesis_reservation.id, itemType: sql<string>`'thesis'`,
                    itemId: tbl_thesis.id, itemTitle: tbl_thesis.title, callNumber: sql<string | null>`null`,
                    userId: tbl_user.id, userName: tbl_user.name,
                    borrowDate: tbl_thesis_reservation.requestedBorrowDate, dueDate: tbl_thesis_reservation.requestedDueDate,
                    returnDate: sql<string | null>`null`, status: tbl_thesis_reservation.status,
                    approvedBy: tbl_thesis_reservation.reviewedBy, createdAt: tbl_thesis_reservation.createdAt
                }).from(tbl_thesis_reservation)
                    .leftJoin(tbl_thesis, eq(tbl_thesis_reservation.thesisId, tbl_thesis.id))
                    .leftJoin(tbl_user, eq(tbl_thesis_reservation.userId, tbl_user.id))
                    .where(and(...conds)).orderBy(desc(tbl_thesis_reservation.createdAt));

                transactions.push(...rows.map(t => ({ ...t, type: 'reserve', recordKind: 'reservation' })));
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // JOURNALS
        // ════════════════════════════════════════════════════════════════════
        if (itemType === 'journal' || itemType === 'all') {

            // Journal borrowings
            if (!transType || transType === 'borrow' || transType === 'return') {
                const conds: any[] = [];
                if (search) conds.push(or(
                    sql`${tbl_journal.title} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_journal_copy.callNumber} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                ));
                if (fromDate) conds.push(sql`${tbl_journal_borrowing.createdAt} >= ${fromDate}`);
                if      (tab === 'borrow')    conds.push(inArray(tbl_journal_borrowing.status, ['borrowed', 'overdue']));
                else if (tab === 'return')    conds.push(eq(tbl_journal_borrowing.status, 'returned'));
                else if (tab === 'fulfilled') conds.push(eq(tbl_journal_borrowing.status, 'fulfilled'));
                else if (tab === 'cancelled') conds.push(eq(tbl_journal_borrowing.status, 'cancelled'));
                else if (tab === 'overdue')   conds.push(and(inArray(tbl_journal_borrowing.status, ['borrowed', 'overdue']), lt(tbl_journal_borrowing.dueDate, new Date()), isNull(tbl_journal_borrowing.returnDate)));
                else if (tab === 'reserve')   conds.push(sql`false`);

                const [{ count: c }] = await db.select({ count: count() }).from(tbl_journal_borrowing)
                    .leftJoin(tbl_journal, eq(tbl_journal_borrowing.journalId, tbl_journal.id))
                    .leftJoin(tbl_journal_copy, eq(tbl_journal_borrowing.journalCopyId, tbl_journal_copy.id))
                    .leftJoin(tbl_user, eq(tbl_journal_borrowing.userId, tbl_user.id))
                    .where(and(...conds));
                totalCount += Number(c) || 0;

                const rows = await db.select({
                    id: tbl_journal_borrowing.id, itemType: sql<string>`'journal'`,
                    itemId: tbl_journal.id, itemTitle: tbl_journal.title, callNumber: tbl_journal_copy.callNumber,
                    userId: tbl_user.id, userName: tbl_user.name,
                    borrowDate: tbl_journal_borrowing.borrowDate, dueDate: tbl_journal_borrowing.dueDate,
                    returnDate: tbl_journal_borrowing.returnDate, status: tbl_journal_borrowing.status,
                    approvedBy: tbl_journal_borrowing.approvedBy, createdAt: tbl_journal_borrowing.createdAt
                }).from(tbl_journal_borrowing)
                    .leftJoin(tbl_journal, eq(tbl_journal_borrowing.journalId, tbl_journal.id))
                    .leftJoin(tbl_journal_copy, eq(tbl_journal_borrowing.journalCopyId, tbl_journal_copy.id))
                    .leftJoin(tbl_user, eq(tbl_journal_borrowing.userId, tbl_user.id))
                    .where(and(...conds)).orderBy(desc(tbl_journal_borrowing.createdAt));

                transactions.push(...rows.map(t => ({ ...t, type: borrowType(t.status), recordKind: 'borrowing' })));
            }

            // Journal reservations
            if (!transType || transType === 'reserve') {
                const sc = reservationStatusCond(tbl_journal_reservation.status, tab);
                const conds: any[] = [];
                if (sc) conds.push(sc);
                if (search) conds.push(or(
                    sql`${tbl_journal.title} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                    sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                ));
                if (fromDate) conds.push(sql`${tbl_journal_reservation.createdAt} >= ${fromDate}`);

                const [{ count: c }] = await db.select({ count: count() }).from(tbl_journal_reservation)
                    .leftJoin(tbl_journal, eq(tbl_journal_reservation.journalId, tbl_journal.id))
                    .leftJoin(tbl_user, eq(tbl_journal_reservation.userId, tbl_user.id))
                    .where(and(...conds));
                totalCount += Number(c) || 0;

                const rows = await db.select({
                    id: tbl_journal_reservation.id, itemType: sql<string>`'journal'`,
                    itemId: tbl_journal.id, itemTitle: tbl_journal.title, callNumber: sql<string | null>`null`,
                    userId: tbl_user.id, userName: tbl_user.name,
                    borrowDate: tbl_journal_reservation.requestedBorrowDate, dueDate: tbl_journal_reservation.requestedDueDate,
                    returnDate: sql<string | null>`null`, status: tbl_journal_reservation.status,
                    approvedBy: tbl_journal_reservation.reviewedBy, createdAt: tbl_journal_reservation.createdAt
                }).from(tbl_journal_reservation)
                    .leftJoin(tbl_journal, eq(tbl_journal_reservation.journalId, tbl_journal.id))
                    .leftJoin(tbl_user, eq(tbl_journal_reservation.userId, tbl_user.id))
                    .where(and(...conds)).orderBy(desc(tbl_journal_reservation.createdAt));

                transactions.push(...rows.map(t => ({ ...t, type: 'reserve', recordKind: 'reservation' })));
            }
        }

        // ── Sort, paginate, enrich ───────────────────────────────────────────────
        transactions.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
        transactions = transactions.slice(offset, offset + limit);

        // Enrich borrowings with computed fine / daysOverdue
        const enriched = await Promise.all(transactions.map(async (t) => {
            if (t.recordKind === 'borrowing' && !t.returnDate && t.dueDate) {
                const fine        = await calculateFineAmount(t.dueDate);
                const daysOverdue = await calculateDaysOverdue(t.dueDate);
                return { ...t, fine, daysOverdue };
            }
            return { ...t, fine: 0, daysOverdue: 0 };
        }));
        transactions = enriched;

        const fineSettings = await loadFineSettings();

        // Enrich with student/faculty ID numbers
        const userIds = Array.from(new Set(transactions.map((t: any) => t.userId).filter((id: any) => id != null))) as number[];
        if (userIds.length > 0) {
            const userRows = await db.select({
                id: tbl_user.id, enrollmentNo: tbl_student.enrollmentNo, facultyNumber: tbl_faculty.facultyNumber
            }).from(tbl_user)
                .leftJoin(tbl_student, eq(tbl_user.id, tbl_student.userId))
                .leftJoin(tbl_faculty, eq(tbl_user.id, tbl_faculty.userId))
                .where(inArray(tbl_user.id, userIds));

            const idMap: Record<number, string | null> = {};
            userRows.forEach(u => { idMap[u.id] = u.enrollmentNo || u.facultyNumber || null; });
            transactions = transactions.map((t: any) => ({ ...t, userIdentifier: idMap[t.userId] || null }));
        }

        return json({ success: true, page, limit, total: totalCount, itemType, transactionType: transType, fineSettings, transactions });

    } catch (err: any) {
        console.error('GET /api/transactions error:', err);
        return json({ success: false, message: err.message || 'Failed to fetch transactions' }, { status: err.status || 500 });
    }
};

// ════════════════════════════════════════════════════════════════════════════
// POST - Create a new borrowing transaction
// ════════════════════════════════════════════════════════════════════════════
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const { itemType = 'book', userId, itemId, copyId, borrowDate, dueDate } = body;
        if (!userId || !itemId || !copyId || !borrowDate || !dueDate) {
            throw error(400, { message: 'All fields are required' });
        }

        let borrowing;

        if (itemType === 'book') {
            await db.update(tbl_book_copy).set({ status: 'borrowed' }).where(eq(tbl_book_copy.id, copyId));
            await db.update(tbl_book).set({ availableCopies: sql`GREATEST(${tbl_book.availableCopies} - 1, 0)` }).where(eq(tbl_book.id, itemId));
            const [r] = await db.insert(tbl_book_borrowing).values({ userId, bookId: itemId, bookCopyId: copyId, borrowDate, dueDate, status: 'borrowed', approvedBy: user.id }).returning();
            borrowing = r;
        } else if (itemType === 'magazine') {
            await db.update(tbl_magazine_copy).set({ status: 'borrowed' }).where(eq(tbl_magazine_copy.id, copyId));
            try { await db.update(tbl_magazine).set({ availableCopies: sql`GREATEST(${tbl_magazine.availableCopies} - 1, 0)` }).where(eq(tbl_magazine.id, itemId)); } catch {}
            const [r] = await db.insert(tbl_magazine_borrowing).values({ userId, magazineId: itemId, magazineCopyId: copyId, borrowDate, dueDate, status: 'borrowed', approvedBy: user.id }).returning();
            borrowing = r;
        } else if (itemType === 'research' || itemType === 'thesis') {
            await db.update(tbl_thesis_copy).set({ status: 'borrowed' }).where(eq(tbl_thesis_copy.id, copyId));
            const [r] = await db.insert(tbl_thesis_borrowing).values({ userId, thesisId: itemId, thesisCopyId: copyId, borrowDate, dueDate, status: 'borrowed', approvedBy: user.id }).returning();
            borrowing = r;
        } else if (itemType === 'multimedia' || itemType === 'journal') {
            await db.update(tbl_journal_copy).set({ status: 'borrowed' }).where(eq(tbl_journal_copy.id, copyId));
            try { await db.update(tbl_journal).set({ availableCopies: sql`GREATEST(${tbl_journal.availableCopies} - 1, 0)` }).where(eq(tbl_journal.id, itemId)); } catch {}
            const [r] = await db.insert(tbl_journal_borrowing).values({ userId, journalId: itemId, journalCopyId: copyId, borrowDate, dueDate, status: 'borrowed', approvedBy: user.id }).returning();
            borrowing = r;
        }

        return json({ success: true, message: 'Borrowing transaction created successfully', data: borrowing });
    } catch (err: any) {
        console.error('POST /api/transactions error:', err);
        return json({ success: false, message: err.message || 'Failed to create transaction' }, { status: err.status || 500 });
    }
};