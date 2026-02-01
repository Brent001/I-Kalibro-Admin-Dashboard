// src/routes/api/books/copies/+server.ts - Manage individual item copies

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_book_copy,
    tbl_magazine_copy,
    tbl_research_copy,
    tbl_multimedia_copy,
    tbl_super_admin,
    tbl_admin,
    tbl_staff
} from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Authenticate user
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

        // Check if staff/admin
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

// POST - Create a new copy for an item
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const { itemType, itemId, copyNumber, qrCode, barcode, condition = 'good', ...rest } = body;

        if (!itemType || !itemId || !copyNumber || !qrCode) {
            throw error(400, { message: 'itemType, itemId, copyNumber, and qrCode are required' });
        }

        let copy;

        if (itemType === 'book') {
            const [result] = await db
                .insert(tbl_book_copy)
                .values({
                    bookId: itemId,
                    copyNumber,
                    qrCode,
                    barcode,
                    condition,
                    status: 'available',
                    isActive: true
                })
                .returning();
            copy = result;
        } else if (itemType === 'magazine') {
            const [result] = await db
                .insert(tbl_magazine_copy)
                .values({
                    magazineId: itemId,
                    copyNumber,
                    qrCode,
                    barcode,
                    condition,
                    status: 'available',
                    isActive: true
                })
                .returning();
            copy = result;
        } else if (itemType === 'research') {
            const [result] = await db
                .insert(tbl_research_copy)
                .values({
                    researchId: itemId,
                    copyNumber,
                    qrCode,
                    barcode,
                    condition,
                    status: 'available',
                    isActive: true
                })
                .returning();
            copy = result;
        } else if (itemType === 'multimedia') {
            const [result] = await db
                .insert(tbl_multimedia_copy)
                .values({
                    multimediaId: itemId,
                    copyNumber,
                    qrCode,
                    barcode,
                    condition,
                    status: 'available',
                    isActive: true
                })
                .returning();
            copy = result;
        }

        return json({
            success: true,
            message: 'Copy created successfully',
            data: copy
        });
    } catch (err: any) {
        console.error('POST /api/books/copies error:', err);
        return json(
            { success: false, message: err.message || 'Failed to create copy' },
            { status: err.status || 500 }
        );
    }
};

// PUT - Update a copy
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const { itemType, copyId, ...updateData } = body;

        if (!itemType || !copyId) {
            throw error(400, { message: 'itemType and copyId are required' });
        }

        let copy;

        if (itemType === 'book') {
            const [result] = await db
                .update(tbl_book_copy)
                .set(updateData)
                .where(eq(tbl_book_copy.id, copyId))
                .returning();
            copy = result;
        } else if (itemType === 'magazine') {
            const [result] = await db
                .update(tbl_magazine_copy)
                .set(updateData)
                .where(eq(tbl_magazine_copy.id, copyId))
                .returning();
            copy = result;
        } else if (itemType === 'research') {
            const [result] = await db
                .update(tbl_research_copy)
                .set(updateData)
                .where(eq(tbl_research_copy.id, copyId))
                .returning();
            copy = result;
        } else if (itemType === 'multimedia') {
            const [result] = await db
                .update(tbl_multimedia_copy)
                .set(updateData)
                .where(eq(tbl_multimedia_copy.id, copyId))
                .returning();
            copy = result;
        }

        return json({
            success: true,
            message: 'Copy updated successfully',
            data: copy
        });
    } catch (err: any) {
        console.error('PUT /api/books/copies error:', err);
        return json(
            { success: false, message: err.message || 'Failed to update copy' },
            { status: err.status || 500 }
        );
    }
};

// GET - Fetch copies for an item
export const GET: RequestHandler = async ({ request, url }) => {
    try {
        const user = await authenticateUser(request);
        if (!user) {
            throw error(401, { message: 'Unauthorized' });
        }

        const itemType = url.searchParams.get('itemType') || 'book';
        const itemId = parseInt(url.searchParams.get('itemId') || '0', 10);

        if (!itemId) {
            throw error(400, { message: 'itemId is required' });
        }

        let copies: any[] = [];

        if (itemType === 'book') {
            copies = await db
                .select()
                .from(tbl_book_copy)
                .where(and(eq(tbl_book_copy.bookId, itemId), eq(tbl_book_copy.isActive, true)));
        } else if (itemType === 'magazine') {
            copies = await db
                .select()
                .from(tbl_magazine_copy)
                .where(and(eq(tbl_magazine_copy.magazineId, itemId), eq(tbl_magazine_copy.isActive, true)));
        } else if (itemType === 'research') {
            copies = await db
                .select()
                .from(tbl_research_copy)
                .where(and(eq(tbl_research_copy.researchId, itemId), eq(tbl_research_copy.isActive, true)));
        } else if (itemType === 'multimedia') {
            copies = await db
                .select()
                .from(tbl_multimedia_copy)
                .where(and(eq(tbl_multimedia_copy.multimediaId, itemId), eq(tbl_multimedia_copy.isActive, true)));
        }

        return json({
            success: true,
            itemType,
            itemId,
            copies
        });
    } catch (err: any) {
        console.error('GET /api/books/copies error:', err);
        return json(
            { success: false, message: err.message || 'Failed to fetch copies' },
            { status: err.status || 500 }
        );
    }
};
