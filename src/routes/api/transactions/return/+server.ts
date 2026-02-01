// src/routes/api/transactions/return/+server.ts - Handle item returns

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_book_borrowing,
    tbl_magazine_borrowing,
    tbl_research_borrowing,
    tbl_multimedia_borrowing,
    tbl_book_copy,
    tbl_magazine_copy,
    tbl_research_copy,
    tbl_multimedia_copy,
    tbl_return,
    tbl_staff,
    tbl_admin,
    tbl_super_admin
} from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

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

        if (!borrowingId || !copyId) {
            throw error(400, { message: 'borrowingId and copyId are required' });
        }

        let updatedBorrowing;
        const returnRecord = await db
            .insert(tbl_return)
            .values({
                userId: 0, // Will be set from borrowing record
                itemType,
                borrowingId,
                copyId,
                qrCodeScanned,
                returnDate: new Date(),
                condition,
                conditionNotes,
                remarks,
                processedBy: user.id
            })
            .returning();

        if (itemType === 'book') {
            // Update borrowing status
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
        } else if (itemType === 'research') {
            const [borrowing] = await db
                .update(tbl_research_borrowing)
                .set({
                    returnDate: new Date() as any,
                    status: 'returned'
                })
                .where(eq(tbl_research_borrowing.id, borrowingId))
                .returning();
            updatedBorrowing = borrowing;

            await db
                .update(tbl_research_copy)
                .set({ status: 'available', condition })
                .where(eq(tbl_research_copy.id, copyId));
        } else if (itemType === 'multimedia') {
            const [borrowing] = await db
                .update(tbl_multimedia_borrowing)
                .set({
                    returnDate: new Date() as any,
                    status: 'returned'
                })
                .where(eq(tbl_multimedia_borrowing.id, borrowingId))
                .returning();
            updatedBorrowing = borrowing;

            await db
                .update(tbl_multimedia_copy)
                .set({ status: 'available', condition })
                .where(eq(tbl_multimedia_copy.id, copyId));
        }

        return json({
            success: true,
            message: 'Item returned successfully',
            data: {
                borrowing: updatedBorrowing,
                returnRecord: returnRecord[0]
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
