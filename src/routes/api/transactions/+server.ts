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

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin' | 'staff' | 'user';
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
        const userId = decoded.userId;

        if (!userId) return null;

        // Check user type
        const [staff] = await db
            .select({ id: tbl_staff.id })
            .from(tbl_staff)
            .where(and(eq(tbl_staff.id, userId), eq(tbl_staff.isActive, true)))
            .limit(1);

        if (staff) return { id: userId, userType: 'staff' };

        const [admin] = await db
            .select({ id: tbl_admin.id })
            .from(tbl_admin)
            .where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true)))
            .limit(1);

        if (admin) return { id: userId, userType: 'admin' };

        const [superAdmin] = await db
            .select({ id: tbl_super_admin.id })
            .from(tbl_super_admin)
            .where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true)))
            .limit(1);

        if (superAdmin) return { id: userId, userType: 'super_admin' };

        // Check if library user (can view own transactions)
        const [user] = await db
            .select({ id: tbl_user.id })
            .from(tbl_user)
            .where(and(eq(tbl_user.id, userId), eq(tbl_user.isActive, true)))
            .limit(1);

        if (user) return { id: userId, userType: 'user' };

        return null;
    } catch (err) {
        console.error('Auth error:', err);
        return null;
    }
}

// GET - Fetch all transactions (books, magazines, research, multimedia)
export const GET: RequestHandler = async ({ request, url }) => {
    try {
        // note: automatic promotion of returned items to "fulfilled" has been removed.
        // this change keeps returns in the "returned" status until staff explicitly marks
        // them fulfilled, allowing reversion at any time. existing API consumers should
        // handle this appropriately (e.g. show revert button whenever status === 'returned').
        
        /*
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        await db.update(tbl_book_borrowing)
            .set({ status: 'fulfilled' })
            .where(and(eq(tbl_book_borrowing.status, 'returned'), lt(tbl_book_borrowing.returnDate, oneHourAgo)));
        await db.update(tbl_magazine_borrowing)
            .set({ status: 'fulfilled' })
            .where(and(eq(tbl_magazine_borrowing.status, 'returned'), lt(tbl_magazine_borrowing.returnDate, oneHourAgo)));
        await db.update(tbl_thesis_borrowing)
            .set({ status: 'fulfilled' })
            .where(and(eq(tbl_thesis_borrowing.status, 'returned'), lt(tbl_thesis_borrowing.returnDate, oneHourAgo)));
        await db.update(tbl_journal_borrowing)
            .set({ status: 'fulfilled' })
            .where(and(eq(tbl_journal_borrowing.status, 'returned'), lt(tbl_journal_borrowing.returnDate, oneHourAgo)));
        */

        const user = await authenticateUser(request);
        if (!user) {
            throw error(401, { message: 'Unauthorized' });
        }

        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 500);
        const itemType = url.searchParams.get('itemType') || 'all'; // 'book', 'magazine', 'research', 'multimedia', 'all'
        const transactionType = url.searchParams.get('type'); // 'borrow', 'return', 'reserve'
        const status = url.searchParams.get('status'); // 'borrowed', 'returned', 'overdue', 'pending', 'active', 'fulfilled', 'cancelled'
        const offset = (page - 1) * limit;

        const search = url.searchParams.get('search') || '';
        const tab = url.searchParams.get('tab') || 'all';
        const period = url.searchParams.get('period') || 'all';
        const customDays = url.searchParams.get('customDays') || '';

        let fromDate: Date | null = null;
        if (period !== 'all') {
            let days: number | null = null;
            if (period === 'custom' && customDays) {
                days = parseInt(customDays, 10);
            } else if (period.endsWith('d')) {
                days = parseInt(period.slice(0, -1), 10);
            }
            if (days && !isNaN(days)) {
                fromDate = new Date();
                fromDate.setDate(fromDate.getDate() - days);
            }
        }

        // Helper function to determine transaction type based on status
        const getTransactionTypeFromStatus = (transactionStatus: string | null, isRequest: boolean = false): string => {
            if (isRequest) return 'reserve'; // All request items are reservations
            if (!transactionStatus) return 'borrow';
            const s = transactionStatus.toLowerCase();
            if (s === 'returned') return 'return';
            return 'borrow'; // Default for borrowed, overdue, pending
        };

        let transactions = [];
        let totalCount = 0;

        // BOOK TRANSACTIONS
        if (itemType === 'book' || itemType === 'all') {
            // Fetch book borrowings (borrows + returns)
            if (!transactionType || transactionType === 'borrow' || transactionType === 'return') {
                const bookWhereConditions = [];
                if (search) {
                    bookWhereConditions.push(or(
                        sql`${tbl_book.title} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_book_copy.callNumber} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                    ));
                }
                if (fromDate) {
                    bookWhereConditions.push(sql`${tbl_book_borrowing.createdAt} >= ${fromDate}`);
                }
                if (tab === 'borrow') {
                    bookWhereConditions.push(inArray(tbl_book_borrowing.status, ['borrowed', 'overdue']));
                } else if (tab === 'return') {
                    bookWhereConditions.push(eq(tbl_book_borrowing.status, 'returned'));
                } else if (tab === 'fulfilled') {
                    bookWhereConditions.push(eq(tbl_book_borrowing.status, 'fulfilled'));
                } else if (tab === 'cancelled') {
                    bookWhereConditions.push(eq(tbl_book_borrowing.status, 'cancelled'));
                } else if (tab === 'overdue') {
                    bookWhereConditions.push(and(
                        inArray(tbl_book_borrowing.status, ['borrowed', 'overdue']),
                        lt(tbl_book_borrowing.dueDate, new Date()),
                        isNull(tbl_book_borrowing.returnDate)
                    ));
                }

                const [{ count: bookCount }] = await db
                    .select({ count: count() })
                    .from(tbl_book_borrowing)
                    .where(and(...bookWhereConditions));
                totalCount += bookCount || 0;

                const bookTransactions = await db
                    .select({
                        id: tbl_book_borrowing.id,
                        itemType: sql<string>`'book'`,
                        itemId: tbl_book.id,
                        itemTitle: tbl_book.title,
                        callNumber: tbl_book_copy.callNumber,
                        userId: tbl_user.id,
                        userName: tbl_user.name,
                        borrowDate: tbl_book_borrowing.borrowDate,
                        dueDate: tbl_book_borrowing.dueDate,
                        returnDate: tbl_book_borrowing.returnDate,
                        status: tbl_book_borrowing.status,
                        approvedBy: tbl_book_borrowing.approvedBy,
                        createdAt: tbl_book_borrowing.createdAt
                    })
                    .from(tbl_book_borrowing)
                    .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
                    .leftJoin(tbl_book_copy, eq(tbl_book_borrowing.bookCopyId, tbl_book_copy.id))
                    .leftJoin(tbl_user, eq(tbl_book_borrowing.userId, tbl_user.id))
                    .where(and(...bookWhereConditions))
                    .orderBy(desc(tbl_book_borrowing.createdAt));
                
                const mappedBookTransactions = bookTransactions.map(t => ({
                    ...t,
                    type: getTransactionTypeFromStatus(t.status || '', false)
                }));
                transactions.push(...mappedBookTransactions);
            }

            // Fetch book reservations (pending/active/fulfilled/cancelled)
            if (!transactionType || transactionType === 'reserve') {
                const bookReqWhereConditions = [];
                if (search) {
                    bookReqWhereConditions.push(or(
                        sql`${tbl_book.title} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                    ));
                }
                if (fromDate) {
                    bookReqWhereConditions.push(sql`${tbl_book_reservation.createdAt} >= ${fromDate}`);
                }
                if (tab !== 'all' && tab !== 'reserve') {
                    // skip if not reserve or all
                    bookReqWhereConditions.push(sql`false`); // to exclude
                }

                const [{ count: bookReqCount }] = await db
                    .select({ count: count() })
                    .from(tbl_book_reservation)
                    .where(and(...bookReqWhereConditions));
                totalCount += bookReqCount || 0;

                const bookRequests = await db
                    .select({
                        id: tbl_book_reservation.id,
                        itemType: sql<string>`'book'`,
                        itemId: tbl_book.id,
                        itemTitle: tbl_book.title,
                        userId: tbl_user.id,
                        userName: tbl_user.name,
                        borrowDate: tbl_book_reservation.requestedBorrowDate,
                        dueDate: tbl_book_reservation.requestedDueDate,
                        returnDate: sql<string | null>`null`,
                        status: tbl_book_reservation.status,
                        approvedBy: tbl_book_reservation.reviewedBy,
                        createdAt: tbl_book_reservation.createdAt
                    })
                    .from(tbl_book_reservation)
                    .leftJoin(tbl_book, eq(tbl_book_reservation.bookId, tbl_book.id))
                    .leftJoin(tbl_user, eq(tbl_book_reservation.userId, tbl_user.id))
                    .where(and(...bookReqWhereConditions))
                    .orderBy(desc(tbl_book_reservation.createdAt));
                
                const mappedBookRequests = bookRequests.map(t => ({
                    ...t,
                    type: 'reserve' as const
                }));
                transactions.push(...mappedBookRequests);
            }
        }

        // MAGAZINE TRANSACTIONS
        if (itemType === 'magazine' || itemType === 'all') {
            // Fetch magazine borrowings
            if (!transactionType || transactionType === 'borrow' || transactionType === 'return') {
                const magWhereConditions = [];
                if (search) {
                    magWhereConditions.push(or(
                        sql`${tbl_magazine.title} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_magazine_copy.callNumber} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                    ));
                }
                if (fromDate) {
                    magWhereConditions.push(sql`${tbl_magazine_borrowing.createdAt} >= ${fromDate}`);
                }
                if (tab === 'borrow') {
                    magWhereConditions.push(inArray(tbl_magazine_borrowing.status, ['borrowed', 'overdue']));
                } else if (tab === 'return') {
                    magWhereConditions.push(eq(tbl_magazine_borrowing.status, 'returned'));
                } else if (tab === 'fulfilled') {
                    magWhereConditions.push(eq(tbl_magazine_borrowing.status, 'fulfilled'));
                } else if (tab === 'cancelled') {
                    magWhereConditions.push(eq(tbl_magazine_borrowing.status, 'cancelled'));
                } else if (tab === 'overdue') {
                    magWhereConditions.push(and(
                        inArray(tbl_magazine_borrowing.status, ['borrowed', 'overdue']),
                        lt(tbl_magazine_borrowing.dueDate, new Date()),
                        isNull(tbl_magazine_borrowing.returnDate)
                    ));
                }

                const [{ count: magCount }] = await db
                    .select({ count: count() })
                    .from(tbl_magazine_borrowing)
                    .where(and(...magWhereConditions));
                totalCount += magCount || 0;

                const magazines = await db
                    .select({
                        id: tbl_magazine_borrowing.id,
                        itemType: sql<string>`'magazine'`,
                        itemId: tbl_magazine.id,
                        itemTitle: tbl_magazine.title,
                        callNumber: tbl_magazine_copy.callNumber,
                        userId: tbl_user.id,
                        userName: tbl_user.name,
                        borrowDate: tbl_magazine_borrowing.borrowDate,
                        dueDate: tbl_magazine_borrowing.dueDate,
                        returnDate: tbl_magazine_borrowing.returnDate,
                        status: tbl_magazine_borrowing.status,
                        approvedBy: tbl_magazine_borrowing.approvedBy,
                        createdAt: tbl_magazine_borrowing.createdAt
                    })
                    .from(tbl_magazine_borrowing)
                    .leftJoin(tbl_magazine, eq(tbl_magazine_borrowing.magazineId, tbl_magazine.id))
                    .leftJoin(tbl_magazine_copy, eq(tbl_magazine_borrowing.magazineCopyId, tbl_magazine_copy.id))
                    .leftJoin(tbl_user, eq(tbl_magazine_borrowing.userId, tbl_user.id))
                    .where(and(...magWhereConditions))
                    .orderBy(desc(tbl_magazine_borrowing.createdAt));
                
                const mappedMagazines = magazines.map(t => ({
                    ...t,
                    type: getTransactionTypeFromStatus(t.status || '', false)
                }));
                transactions.push(...mappedMagazines);
            }

            // Fetch magazine reservations
            if (!transactionType || transactionType === 'reserve') {
                const magReqWhereConditions = [];
                if (search) {
                    magReqWhereConditions.push(or(
                        sql`${tbl_magazine.title} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                    ));
                }
                if (fromDate) {
                    magReqWhereConditions.push(sql`${tbl_magazine_reservation.createdAt} >= ${fromDate}`);
                }
                if (tab !== 'all' && tab !== 'reserve') {
                    magReqWhereConditions.push(sql`false`);
                }

                const [{ count: magReqCount }] = await db
                    .select({ count: count() })
                    .from(tbl_magazine_reservation)
                    .where(and(...magReqWhereConditions));
                totalCount += magReqCount || 0;

                const magazineRequests = await db
                    .select({
                        id: tbl_magazine_reservation.id,
                        itemType: sql<string>`'magazine'`,
                        itemId: tbl_magazine.id,
                        itemTitle: tbl_magazine.title,
                        userId: tbl_user.id,
                        userName: tbl_user.name,
                        borrowDate: tbl_magazine_reservation.requestedBorrowDate,
                        dueDate: tbl_magazine_reservation.requestedDueDate,
                        returnDate: sql<string | null>`null`,
                        status: tbl_magazine_reservation.status,
                        approvedBy: tbl_magazine_reservation.reviewedBy,
                        createdAt: tbl_magazine_reservation.createdAt
                    })
                    .from(tbl_magazine_reservation)
                    .leftJoin(tbl_magazine, eq(tbl_magazine_reservation.magazineId, tbl_magazine.id))
                    .leftJoin(tbl_user, eq(tbl_magazine_reservation.userId, tbl_user.id))
                    .where(and(...magReqWhereConditions))
                    .orderBy(desc(tbl_magazine_reservation.createdAt));
                
                const mappedMagRequests = magazineRequests.map(t => ({
                    ...t,
                    type: 'reserve' as const
                }));
                transactions.push(...mappedMagRequests);
            }
        }

        // THESIS TRANSACTIONS
        if (itemType === 'thesis' || itemType === 'all') {
            // Fetch thesis borrowings
            if (!transactionType || transactionType === 'borrow' || transactionType === 'return') {
                const thesisWhere: any[] = [];
                if (search) {
                    thesisWhere.push(or(
                        sql`${tbl_thesis.title} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_thesis_copy.callNumber} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                    ));
                }
                if (fromDate) {
                    thesisWhere.push(sql`${tbl_thesis_borrowing.createdAt} >= ${fromDate}`);
                }
                if (tab === 'borrow') {
                    thesisWhere.push(inArray(tbl_thesis_borrowing.status, ['borrowed', 'overdue']));
                } else if (tab === 'return') {
                    thesisWhere.push(eq(tbl_thesis_borrowing.status, 'returned'));
                } else if (tab === 'fulfilled') {
                    thesisWhere.push(eq(tbl_thesis_borrowing.status, 'fulfilled'));
                } else if (tab === 'cancelled') {
                    thesisWhere.push(eq(tbl_thesis_borrowing.status, 'cancelled'));
                } else if (tab === 'overdue') {
                    thesisWhere.push(and(
                        inArray(tbl_thesis_borrowing.status, ['borrowed', 'overdue']),
                        lt(tbl_thesis_borrowing.dueDate, new Date()),
                        isNull(tbl_thesis_borrowing.returnDate)
                    ));
                }

                const [{ count: thesisCount }] = await db
                    .select({ count: count() })
                    .from(tbl_thesis_borrowing)
                    .where(and(...thesisWhere));
                totalCount += thesisCount || 0;

                const thesisTransactions = await db
                    .select({
                        id: tbl_thesis_borrowing.id,
                        itemType: sql<string>`'thesis'`,
                        itemId: tbl_thesis.id,
                        itemTitle: tbl_thesis.title,
                        callNumber: tbl_thesis_copy.callNumber,
                        userId: tbl_user.id,
                        userName: tbl_user.name,
                        borrowDate: tbl_thesis_borrowing.borrowDate,
                        dueDate: tbl_thesis_borrowing.dueDate,
                        returnDate: tbl_thesis_borrowing.returnDate,
                        status: tbl_thesis_borrowing.status,
                        approvedBy: tbl_thesis_borrowing.approvedBy,
                        createdAt: tbl_thesis_borrowing.createdAt
                    })
                    .from(tbl_thesis_borrowing)
                    .leftJoin(tbl_thesis, eq(tbl_thesis_borrowing.thesisId, tbl_thesis.id))
                    .leftJoin(tbl_thesis_copy, eq(tbl_thesis_borrowing.thesisCopyId, tbl_thesis_copy.id))
                    .leftJoin(tbl_user, eq(tbl_thesis_borrowing.userId, tbl_user.id))
                    .where(and(...thesisWhere))
                    .orderBy(desc(tbl_thesis_borrowing.createdAt));
                
                const mappedThesis = thesisTransactions.map(t => ({
                    ...t,
                    type: getTransactionTypeFromStatus(t.status || '', false)
                }));
                transactions.push(...mappedThesis);
            }

            // Fetch thesis reservations
            if (!transactionType || transactionType === 'reserve') {
                const thesisReqWhere: any[] = [];
                if (search) {
                    thesisReqWhere.push(or(
                        sql`${tbl_thesis.title} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                    ));
                }
                if (fromDate) {
                    thesisReqWhere.push(sql`${tbl_thesis_reservation.createdAt} >= ${fromDate}`);
                }
                if (tab !== 'all' && tab !== 'reserve') {
                    thesisReqWhere.push(sql`false`);
                }

                const [{ count: thesisReqCount }] = await db
                    .select({ count: count() })
                    .from(tbl_thesis_reservation)
                    .where(and(...thesisReqWhere));
                totalCount += thesisReqCount || 0;

                const thesisRequests = await db
                    .select({
                        id: tbl_thesis_reservation.id,
                        itemType: sql<string>`'thesis'`,
                        itemId: tbl_thesis.id,
                        itemTitle: tbl_thesis.title,
                        userId: tbl_user.id,
                        userName: tbl_user.name,
                        borrowDate: tbl_thesis_reservation.requestedBorrowDate,
                        dueDate: tbl_thesis_reservation.requestedDueDate,
                        returnDate: sql<string | null>`null`,
                        status: tbl_thesis_reservation.status,
                        approvedBy: tbl_thesis_reservation.reviewedBy,
                        createdAt: tbl_thesis_reservation.createdAt
                    })
                    .from(tbl_thesis_reservation)
                    .leftJoin(tbl_thesis, eq(tbl_thesis_reservation.thesisId, tbl_thesis.id))
                    .leftJoin(tbl_user, eq(tbl_thesis_reservation.userId, tbl_user.id))
                    .where(and(...thesisReqWhere))
                    .orderBy(desc(tbl_thesis_reservation.createdAt));
                
                const mappedThesisReqs = thesisRequests.map(t => ({
                    ...t,
                    type: 'reserve' as const
                }));
                transactions.push(...mappedThesisReqs);
            }
        }

        // JOURNAL TRANSACTIONS
        if (itemType === 'journal' || itemType === 'all') {
            // Fetch journal borrowings
            if (!transactionType || transactionType === 'borrow' || transactionType === 'return') {
                const journalWhere: any[] = [];
                if (search) {
                    journalWhere.push(or(
                        sql`${tbl_journal.title} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_journal_copy.callNumber} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                    ));
                }
                if (fromDate) {
                    journalWhere.push(sql`${tbl_journal_borrowing.createdAt} >= ${fromDate}`);
                }
                if (tab === 'borrow') {
                    journalWhere.push(inArray(tbl_journal_borrowing.status, ['borrowed', 'overdue']));
                } else if (tab === 'return') {
                    journalWhere.push(eq(tbl_journal_borrowing.status, 'returned'));
                } else if (tab === 'fulfilled') {
                    journalWhere.push(eq(tbl_journal_borrowing.status, 'fulfilled'));
                } else if (tab === 'cancelled') {
                    journalWhere.push(eq(tbl_journal_borrowing.status, 'cancelled'));
                } else if (tab === 'overdue') {
                    journalWhere.push(and(
                        inArray(tbl_journal_borrowing.status, ['borrowed', 'overdue']),
                        lt(tbl_journal_borrowing.dueDate, new Date()),
                        isNull(tbl_journal_borrowing.returnDate)
                    ));
                }

                const [{ count: journalCount }] = await db
                    .select({ count: count() })
                    .from(tbl_journal_borrowing)
                    .where(and(...journalWhere));
                totalCount += journalCount || 0;

                const journalTransactions = await db
                    .select({
                        id: tbl_journal_borrowing.id,
                        itemType: sql<string>`'journal'`,
                        itemId: tbl_journal.id,
                        itemTitle: tbl_journal.title,
                        callNumber: tbl_journal_copy.callNumber,
                        userId: tbl_user.id,
                        userName: tbl_user.name,
                        borrowDate: tbl_journal_borrowing.borrowDate,
                        dueDate: tbl_journal_borrowing.dueDate,
                        returnDate: tbl_journal_borrowing.returnDate,
                        status: tbl_journal_borrowing.status,
                        approvedBy: tbl_journal_borrowing.approvedBy,
                        createdAt: tbl_journal_borrowing.createdAt
                    })
                    .from(tbl_journal_borrowing)
                    .leftJoin(tbl_journal, eq(tbl_journal_borrowing.journalId, tbl_journal.id))
                    .leftJoin(tbl_journal_copy, eq(tbl_journal_borrowing.journalCopyId, tbl_journal_copy.id))
                    .leftJoin(tbl_user, eq(tbl_journal_borrowing.userId, tbl_user.id))
                    .where(and(...journalWhere))
                    .orderBy(desc(tbl_journal_borrowing.createdAt));
                
                const mappedJournal = journalTransactions.map(t => ({
                    ...t,
                    type: getTransactionTypeFromStatus(t.status || '', false)
                }));
                transactions.push(...mappedJournal);
            }

            // Fetch journal reservations
            if (!transactionType || transactionType === 'reserve') {
                const journalReqWhere: any[] = [];
                if (search) {
                    journalReqWhere.push(or(
                        sql`${tbl_journal.title} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.name} ILIKE ${'%' + search + '%'}`,
                        sql`${tbl_user.id}::text ILIKE ${'%' + search + '%'}`
                    ));
                }
                if (fromDate) {
                    journalReqWhere.push(sql`${tbl_journal_reservation.createdAt} >= ${fromDate}`);
                }
                if (tab !== 'all' && tab !== 'reserve') {
                    journalReqWhere.push(sql`false`);
                }

                const [{ count: journalReqCount }] = await db
                    .select({ count: count() })
                    .from(tbl_journal_reservation)
                    .where(and(...journalReqWhere));
                totalCount += journalReqCount || 0;

                const journalRequests = await db
                    .select({
                        id: tbl_journal_reservation.id,
                        itemType: sql<string>`'journal'`,
                        itemId: tbl_journal.id,
                        itemTitle: tbl_journal.title,
                        userId: tbl_user.id,
                        userName: tbl_user.name,
                        borrowDate: tbl_journal_reservation.requestedBorrowDate,
                        dueDate: tbl_journal_reservation.requestedDueDate,
                        returnDate: sql<string | null>`null`,
                        status: tbl_journal_reservation.status,
                        approvedBy: tbl_journal_reservation.reviewedBy,
                        createdAt: tbl_journal_reservation.createdAt
                    })
                    .from(tbl_journal_reservation)
                    .leftJoin(tbl_journal, eq(tbl_journal_reservation.journalId, tbl_journal.id))
                    .leftJoin(tbl_user, eq(tbl_journal_reservation.userId, tbl_user.id))
                    .where(and(...journalReqWhere))
                    .orderBy(desc(tbl_journal_reservation.createdAt));
                
                const mappedJournalReqs = journalRequests.map(t => ({
                    ...t,
                    type: 'reserve' as const
                }));
                transactions.push(...mappedJournalReqs);
            }
        }

        // Sort and paginate
        transactions.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
        transactions = transactions.slice(offset, offset + limit);

        // Enrich with fine and daysOverdue
        const enriched = await Promise.all(transactions.map(async (t) => {
            if (t.type === 'borrow' && !t.returnDate && t.dueDate) {
                const fine = await calculateFineAmount(t.dueDate);
                const daysOverdue = await calculateDaysOverdue(t.dueDate);
                return { ...t, fine, daysOverdue };
            }
            return { ...t, fine: 0, daysOverdue: 0 };
        }));
        transactions = enriched;

        // include fine settings so the frontend can calculate fines/days itself
        const fineSettings = await loadFineSettings();

        // look up student/faculty identifiers in a single query
        const userIds = Array.from(new Set(transactions.map((t: any) => t.userId).filter((id: any) => id != null)));
        if (userIds.length > 0) {
            const userRows: any[] = await db
                .select({
                    id: tbl_user.id,
                    enrollmentNo: tbl_student.enrollmentNo,
                    facultyNumber: tbl_faculty.facultyNumber
                })
                .from(tbl_user)
                .leftJoin(tbl_student, eq(tbl_user.id, tbl_student.userId))
                .leftJoin(tbl_faculty, eq(tbl_user.id, tbl_faculty.userId))
                .where(inArray(tbl_user.id, userIds));

            const idMap: Record<number, string | null> = {};
            userRows.forEach(u => {
                idMap[u.id] = u.enrollmentNo || u.facultyNumber || null;
            });
            transactions = transactions.map((t: any) => ({
                ...t,
                userIdentifier: idMap[t.userId] || null
            }));
        }

        return json({
            success: true,
            page,
            limit,
            total: totalCount,
            itemType,
            transactionType,
            fineSettings,
            transactions
        });
    } catch (err: any) {
        console.error('GET /api/transactions error:', err);
        return json(
            { success: false, message: err.message || 'Failed to fetch transactions' },
            { status: err.status || 500 }
        );
    }
};

// POST - Create a new borrowing transaction
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const {
            itemType = 'book',
            userId,
            itemId,
            copyId,
            borrowDate,
            dueDate
        } = body;

        if (!userId || !itemId || !copyId || !borrowDate || !dueDate) {
            throw error(400, { message: 'All fields are required' });
        }

        let borrowing;

        if (itemType === 'book') {
            // Update book copy status
            await db
                .update(tbl_book_copy)
                .set({ status: 'borrowed' })
                .where(eq(tbl_book_copy.id, copyId));

            // Decrement available copies on the parent book (never below 0)
            await db
                .update(tbl_book)
                .set({ availableCopies: sql`GREATEST(${tbl_book.availableCopies} - 1, 0)` })
                .where(eq(tbl_book.id, itemId));

            const [result] = await db
                .insert(tbl_book_borrowing)
                .values({
                    userId,
                    bookId: itemId,
                    bookCopyId: copyId,
                    borrowDate: borrowDate,
                    dueDate: dueDate,
                    status: 'borrowed',
                    approvedBy: user.id
                })
                .returning();
            borrowing = result;
        } else if (itemType === 'magazine') {
            await db
                .update(tbl_magazine_copy)
                .set({ status: 'borrowed' })
                .where(eq(tbl_magazine_copy.id, copyId));

            // decrement available copies on parent magazine
            try {
                await db
                    .update(tbl_magazine)
                    .set({ availableCopies: sql`GREATEST(${tbl_magazine.availableCopies} - 1, 0)` })
                    .where(eq(tbl_magazine.id, itemId));
            } catch (e) {
                console.debug('Failed to decrement magazine.availableCopies during borrow:', e);
            }

            const [result] = await db
                .insert(tbl_magazine_borrowing)
                .values({
                    userId,
                    magazineId: itemId,
                    magazineCopyId: copyId,
                    borrowDate: borrowDate,
                    dueDate: dueDate,
                    status: 'borrowed',
                    approvedBy: user.id
                })
                .returning();
            borrowing = result;
        } else if (itemType === 'research') {
            // Treat 'research' as 'thesis' items in current schema
            await db
                .update(tbl_thesis_copy)
                .set({ status: 'borrowed' })
                .where(eq(tbl_thesis_copy.id, copyId));

            const [thesisResult] = await db
                .insert(tbl_thesis_borrowing)
                .values({
                    userId,
                    thesisId: itemId,
                    thesisCopyId: copyId,
                    borrowDate: borrowDate,
                    dueDate: dueDate,
                    status: 'borrowed',
                    approvedBy: user.id
                })
                .returning();
            borrowing = thesisResult;
        } else if (itemType === 'multimedia' || itemType === 'journal') {
            // Treat 'journal' as the multimedia/journal category
            await db
                .update(tbl_journal_copy)
                .set({ status: 'borrowed' })
                .where(eq(tbl_journal_copy.id, copyId));

            // decrement available copies on parent journal
            try {
                await db
                    .update(tbl_journal)
                    .set({ availableCopies: sql`GREATEST(${tbl_journal.availableCopies} - 1, 0)` })
                    .where(eq(tbl_journal.id, itemId));
            } catch (e) {
                console.debug('Failed to decrement journal.availableCopies during borrow:', e);
            }

            const [journalResult] = await db
                .insert(tbl_journal_borrowing)
                .values({
                    userId,
                    journalId: itemId,
                    journalCopyId: copyId,
                    borrowDate: borrowDate,
                    dueDate: dueDate,
                    status: 'borrowed',
                    approvedBy: user.id
                })
                .returning();
            borrowing = journalResult;
        }

        return json({
            success: true,
            message: 'Borrowing transaction created successfully',
            data: borrowing
        });
    } catch (err: any) {
        console.error('POST /api/transactions error:', err);
        return json(
            { success: false, message: err.message || 'Failed to create transaction' },
            { status: err.status || 500 }
        );
    }
};
