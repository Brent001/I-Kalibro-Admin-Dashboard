// src/routes/api/transactions/return/+server.ts - Handle item returns

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_book_borrowing,
    tbl_magazine_borrowing,
    tbl_thesis_borrowing,
    tbl_journal_borrowing,
    tbl_book_copy,
    tbl_magazine_copy,
    tbl_thesis_copy,
    tbl_journal_copy,
    tbl_return,
    tbl_fine,
    tbl_staff,
    tbl_admin,
    tbl_super_admin
} from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { calculateFineAmount, calculateDaysOverdue } from '$lib/server/utils/fineCalculation.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
// We'll calculate fines using the shared fineCalculation utilities which respect exemptions.

async function authenticateUser(request: Request): Promise<{ id: number; userType: string } | null> {
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

        if (!token || await isSessionRevoked(token)) return null;

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId;

        if (!userId) return null;

        // Check staff
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

        return null;
    } catch (err) {
        console.error('Auth error:', err);
        return null;
    }
}

// POST - Process item return
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const {
            itemType = 'book',
            borrowingId,
            copyId,
            qrCodeScanned,
            condition = 'good',
            conditionNotes = '',
            remarks = ''
        } = body;

        if (!borrowingId) {
            throw error(400, { message: 'borrowingId is required' });
        }

        // If copyId or userId weren't provided, attempt to derive them from borrowing record
        let derivedCopyId: number | null = copyId ?? null;
        let derivedUserId: number | null = null;
        let existingBorrowing: any = null;

        // helper to fetch borrowing by type
        if (!derivedCopyId || derivedUserId === null) {
            try {
                if (itemType === 'book') {
                    const [b] = await db.select().from(tbl_book_borrowing).where(eq(tbl_book_borrowing.id, borrowingId)).limit(1);
                    if (b) {
                        existingBorrowing = b;
                        derivedCopyId = derivedCopyId ?? b.bookCopyId ?? null;
                        derivedUserId = b.userId ?? null;
                    }
                } else if (itemType === 'magazine') {
                    const [b] = await db.select().from(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.id, borrowingId)).limit(1);
                    if (b) {
                        existingBorrowing = b;
                        derivedCopyId = derivedCopyId ?? b.magazineCopyId ?? null;
                        derivedUserId = b.userId ?? null;
                    }
                } else if (itemType === 'thesis') {
                    const [b] = await db.select().from(tbl_thesis_borrowing).where(eq(tbl_thesis_borrowing.id, borrowingId)).limit(1);
                    if (b) {
                        existingBorrowing = b;
                        derivedCopyId = derivedCopyId ?? b.thesisCopyId ?? null;
                        derivedUserId = b.userId ?? null;
                    }
                } else if (itemType === 'journal' || itemType === 'multimedia') {
                    const [b] = await db.select().from(tbl_journal_borrowing).where(eq(tbl_journal_borrowing.id, borrowingId)).limit(1);
                    if (b) {
                        existingBorrowing = b;
                        derivedCopyId = derivedCopyId ?? b.journalCopyId ?? null;
                        derivedUserId = b.userId ?? null;
                    }
                }
            } catch (e) {
                console.debug('Failed to derive copyId/userId from borrowing record:', e);
            }
        }

        if (!derivedCopyId) {
            // still missing copy id — continue but warn; some schemas may allow null
            console.warn('copyId could not be derived for borrowingId', borrowingId);
        }

        // attempt to fetch call number for returned copy
        let returnedCallNumber: string | null = null;
        if (derivedCopyId) {
            try {
                if (itemType === 'book') {
                    const [cp] = await db.select({ callNumber: tbl_book_copy.callNumber })
                        .from(tbl_book_copy)
                        .where(eq(tbl_book_copy.id, derivedCopyId))
                        .limit(1);
                    returnedCallNumber = cp?.callNumber || null;
                } else if (itemType === 'magazine') {
                    const [cp] = await db.select({ callNumber: tbl_magazine_copy.callNumber })
                        .from(tbl_magazine_copy)
                        .where(eq(tbl_magazine_copy.id, derivedCopyId))
                        .limit(1);
                    returnedCallNumber = cp?.callNumber || null;
                } else if (itemType === 'thesis') {
                    const [cp] = await db.select({ callNumber: tbl_thesis_copy.callNumber })
                        .from(tbl_thesis_copy)
                        .where(eq(tbl_thesis_copy.id, derivedCopyId))
                        .limit(1);
                    returnedCallNumber = cp?.callNumber || null;
                } else if (itemType === 'journal' || itemType === 'multimedia') {
                    const [cp] = await db.select({ callNumber: tbl_journal_copy.callNumber })
                        .from(tbl_journal_copy)
                        .where(eq(tbl_journal_copy.id, derivedCopyId))
                        .limit(1);
                    returnedCallNumber = cp?.callNumber || null;
                }
            } catch (e) {
                console.debug('Failed to fetch call number for return endpoint:', e);
            }
        }

        // Validate borrowing status (if we were able to derive it)
        if (existingBorrowing) {
            if (existingBorrowing.status === 'returned') throw error(400, { message: 'Item has already been returned.' });
            if (existingBorrowing.status !== 'borrowed' && existingBorrowing.status !== 'overdue') throw error(400, { message: 'Invalid borrowing status. Only borrowed or overdue items can be returned.' });
        }

        let updatedBorrowing;
                // compute fine and days overdue (respecting configured exemptions)
                let calculatedFinePesos = 0;
                let daysOverdue = 0;
                if (existingBorrowing && existingBorrowing.dueDate) {
                    const c = await calculateFineAmount(new Date(existingBorrowing.dueDate));
                    calculatedFinePesos = Number((Number(c) / 100).toFixed(2));
                    daysOverdue = await calculateDaysOverdue(new Date(existingBorrowing.dueDate));
                }

        const returnRecord = await db
            .insert(tbl_return)
            .values({
                userId: derivedUserId ?? 0,
                itemType,
                borrowingId,
                copyId: derivedCopyId ?? 0,
                qrCodeScanned,
                returnDate: new Date(),
                condition,
                conditionNotes,
                remarks,
                processedBy: user.id
            })
            .returning();

        // Persist fine record if applicable
                let fineRecord: any = null;
                if (calculatedFinePesos > 0) {
                    try {
                        const [r] = await db.insert(tbl_fine).values({
                            userId: derivedUserId ?? 0,
                            itemType,
                            borrowingId,
                            fineAmount: String(calculatedFinePesos.toFixed(2)),
                            daysOverdue: daysOverdue
                        }).returning();
                        fineRecord = r;
                    } catch (e) {
                        console.debug('Failed to persist fine record:', e);
                    }
                }

        if (itemType === 'book') {
            // Update borrowing status
            // Fetch borrowing to determine parent book id
            const [existingBorrowing] = await db
                .select()
                .from(tbl_book_borrowing)
                .where(eq(tbl_book_borrowing.id, borrowingId))
                .limit(1);

            const [borrowing] = await db
                .update(tbl_book_borrowing)
                .set({
                    returnDate: new Date() as any,
                    status: 'returned'
                })
                .where(eq(tbl_book_borrowing.id, borrowingId))
                .returning();
            updatedBorrowing = borrowing;

            // Update copy status
            await db
                .update(tbl_book_copy)
                .set({ status: 'available', condition })
                .where(eq(tbl_book_copy.id, copyId));

            // If we have the parent book id, increment availableCopies (safe increment)
            const parentBookId = existingBorrowing?.bookId || null;
            if (parentBookId) {
                await db
                    .update(tbl_book)
                    .set({ availableCopies: sql`COALESCE(${tbl_book.availableCopies}, 0) + 1` })
                    .where(eq(tbl_book.id, parentBookId));
            }
        } else if (itemType === 'magazine') {
            const [borrowing] = await db
                .update(tbl_magazine_borrowing)
                .set({
                    returnDate: new Date() as any,
                    status: 'returned'
                })
                .where(eq(tbl_magazine_borrowing.id, borrowingId))
                .returning();
            updatedBorrowing = borrowing;

            await db
                .update(tbl_magazine_copy)
                .set({ status: 'available', condition })
                .where(eq(tbl_magazine_copy.id, copyId));
        } else if (itemType === 'thesis') {
            const [borrowing] = await db
                .update(tbl_thesis_borrowing)
                .set({
                    returnDate: new Date() as any,
                    status: 'returned'
                })
                .where(eq(tbl_thesis_borrowing.id, borrowingId))
                .returning();
            updatedBorrowing = borrowing;

            await db
                .update(tbl_thesis_copy)
                .set({ status: 'available', condition })
                .where(eq(tbl_thesis_copy.id, copyId));
        } else if (itemType === 'multimedia' || itemType === 'journal') {
            // Treat 'journal' under multimedia branch mapping to journal tables
            const [borrowing] = await db
                .update(tbl_journal_borrowing)
                .set({
                    returnDate: new Date() as any,
                    status: 'returned'
                })
                .where(eq(tbl_journal_borrowing.id, borrowingId))
                .returning();
            updatedBorrowing = borrowing;

            await db
                .update(tbl_journal_copy)
                .set({ status: 'available', condition })
                .where(eq(tbl_journal_copy.id, copyId));
        }

                return json({
                    success: true,
                    message: 'Item returned successfully',
                    data: {
                        borrowing: updatedBorrowing,
                        returnRecord: returnRecord[0],
                        fine: calculatedFinePesos,
                        daysOverdue: daysOverdue,
                        callNumber: returnedCallNumber
                    }
                });
    } catch (err: any) {
        console.error('POST /api/transactions/return error:', err);
        return json(
            { success: false, message: err.message || 'Failed to process return' },
            { status: err.status || 500 }
        );
    }
};
