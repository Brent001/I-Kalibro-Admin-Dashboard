// src/routes/api/transactions/+server.ts - Unified transaction management

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_book_borrowing,
    tbl_magazine_borrowing,
    tbl_research_borrowing,
    tbl_multimedia_borrowing,
    tbl_book,
    tbl_magazine,
    tbl_research_document,
    tbl_multimedia,
    tbl_user,
    tbl_staff,
    tbl_book_copy,
    tbl_magazine_copy,
    tbl_research_copy,
    tbl_multimedia_copy,
    tbl_super_admin,
    tbl_admin
} from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';

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

        if (!token || await isSessionRevoked(token)) return null;

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
        const user = await authenticateUser(request);
        if (!user) {
            throw error(401, { message: 'Unauthorized' });
        }

        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 100);
        const itemType = url.searchParams.get('itemType') || 'all'; // 'book', 'magazine', 'research', 'multimedia', 'all'
        const status = url.searchParams.get('status'); // 'borrowed', 'returned', 'overdue'
        const offset = (page - 1) * limit;

        let transactions = [];
        let totalCount = 0;

        // Fetch book borrowings
        if (itemType === 'book' || itemType === 'all') {
            const bookWhereConditions = [];
            if (status) bookWhereConditions.push(eq(tbl_book_borrowing.status, status));

            const [{ count: bookCount }] = await db
                .select({ count: count() })
                .from(tbl_book_borrowing)
                .where(and(...bookWhereConditions));
            totalCount += bookCount || 0;

            const bookTransactions = await db
                .select({
                    id: tbl_book_borrowing.id,
                    itemType: 'book',
                    itemId: tbl_book.id,
                    itemTitle: tbl_book.title,
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
                .leftJoin(tbl_user, eq(tbl_book_borrowing.userId, tbl_user.id))
                .where(and(...bookWhereConditions))
                .orderBy(desc(tbl_book_borrowing.createdAt))
                .limit(limit)
                .offset(offset);
            transactions.push(...bookTransactions);
        }

        // Similar for magazines, research, multimedia...
        if (itemType === 'magazine' || itemType === 'all') {
            const magWhereConditions = [];
            if (status) magWhereConditions.push(eq(tbl_magazine_borrowing.status, status));

            const magazines = await db
                .select({
                    id: tbl_magazine_borrowing.id,
                    itemType: 'magazine',
                    itemId: tbl_magazine.id,
                    itemTitle: tbl_magazine.title,
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
                .leftJoin(tbl_user, eq(tbl_magazine_borrowing.userId, tbl_user.id))
                .where(and(...magWhereConditions))
                .orderBy(desc(tbl_magazine_borrowing.createdAt))
                .limit(limit)
                .offset(offset);
            transactions.push(...magazines);
        }

        return json({
            success: true,
            page,
            limit,
            total: totalCount,
            itemType,
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

            const [result] = await db
                .insert(tbl_book_borrowing)
                .values({
                    userId,
                    bookId: itemId,
                    bookCopyId: copyId,
                    borrowDate: new Date(borrowDate),
                    dueDate: new Date(dueDate),
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

            const [result] = await db
                .insert(tbl_magazine_borrowing)
                .values({
                    userId,
                    magazineId: itemId,
                    magazineCopyId: copyId,
                    borrowDate: new Date(borrowDate),
                    dueDate: new Date(dueDate),
                    status: 'borrowed',
                    approvedBy: user.id
                })
                .returning();
            borrowing = result;
        } else if (itemType === 'research') {
            await db
                .update(tbl_research_copy)
                .set({ status: 'borrowed' })
                .where(eq(tbl_research_copy.id, copyId));

            const [result] = await db
                .insert(tbl_research_borrowing)
                .values({
                    userId,
                    researchId: itemId,
                    researchCopyId: copyId,
                    borrowDate: new Date(borrowDate),
                    dueDate: new Date(dueDate),
                    status: 'borrowed',
                    approvedBy: user.id
                })
                .returning();
            borrowing = result;
        } else if (itemType === 'multimedia') {
            await db
                .update(tbl_multimedia_copy)
                .set({ status: 'borrowed' })
                .where(eq(tbl_multimedia_copy.id, copyId));

            const [result] = await db
                .insert(tbl_multimedia_borrowing)
                .values({
                    userId,
                    multimediaId: itemId,
                    multimediaCopyId: copyId,
                    borrowDate: new Date(borrowDate),
                    dueDate: new Date(dueDate),
                    status: 'borrowed',
                    approvedBy: user.id
                })
                .returning();
            borrowing = result;
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
