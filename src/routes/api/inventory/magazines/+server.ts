// src/routes/api/magazines/+server.ts - Magazine management API

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, ilike, and, or, inArray, count } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_magazine,
    tbl_magazine_copy,
    tbl_category,
    tbl_super_admin,
    tbl_admin,
    tbl_staff
} from '$lib/server/db/schema/schema.js';
import { publish as publishMagazineEvent } from '$lib/server/events/magazinesEvents.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { convertToProxyUrl } from '$lib/server/utils/backblazeUpload.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

function generateQRCode(): string {
    return 'QR-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin' | 'staff' | 'user';
    username: string;
    email: string;
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

        if (await isSessionRevoked(token)) return null;

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        if (!userId) return null;

        const [superAdmin] = await db
            .select({ id: tbl_super_admin.id, username: tbl_super_admin.username, email: tbl_super_admin.email, isActive: tbl_super_admin.isActive })
            .from(tbl_super_admin)
            .where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true)))
            .limit(1);
        if (superAdmin) return { id: userId, userType: 'super_admin', username: superAdmin.username, email: superAdmin.email };

        const [admin] = await db
            .select({ id: tbl_admin.id, username: tbl_admin.username, email: tbl_admin.email, isActive: tbl_admin.isActive })
            .from(tbl_admin)
            .where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true)))
            .limit(1);
        if (admin) return { id: userId, userType: 'admin', username: admin.username, email: admin.email };

        const [staff] = await db
            .select({ id: tbl_staff.id, username: tbl_staff.username, email: tbl_staff.email, isActive: tbl_staff.isActive })
            .from(tbl_staff)
            .where(and(eq(tbl_staff.id, userId), eq(tbl_staff.isActive, true)))
            .limit(1);
        if (staff) return { id: userId, userType: 'staff', username: staff.username, email: staff.email };

        return null;
    } catch (err: any) {
        console.error('Authentication error:', err);
        return null;
    }
}

// GET - fetch magazines with filters
export const GET: RequestHandler = async ({ request, url }) => {
    try {
        const user = await authenticateUser(request);
        if (!user) throw error(401, { message: 'Unauthorized' });

        const searchParams = url.searchParams;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100);
        const search = searchParams.get('q') || '';
        const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!, 10) : undefined;
        const categoryName = searchParams.get('category') || '';
        const language = searchParams.get('lang') || searchParams.get('language') || '';
        const offset = (page - 1) * limit;

        const whereConditions: any[] = [eq(tbl_magazine.isActive, true)];

        if (search) {
            whereConditions.push(
                or(
                    ilike(tbl_magazine.title, `%${search}%`),
                    ilike(tbl_magazine.publisher, `%${search}%`),
                    ilike(tbl_magazine.issn, `%${search}%`)
                )!
            );
        }

        if (categoryId) {
            whereConditions.push(eq(tbl_magazine.categoryId, categoryId));
        } else if (categoryName) {
            try {
                const [cat] = await db
                    .select({ id: tbl_category.id })
                    .from(tbl_category)
                    .where(ilike(tbl_category.name, categoryName))
                    .limit(1);
                if (cat) {
                    whereConditions.push(eq(tbl_magazine.categoryId, cat.id));
                }
            } catch (e) {
                console.debug('Category lookup failed, continuing without category filter:', e);
            }
        }

        if (language) {
            whereConditions.push(ilike(tbl_magazine.language, language));
        }

        const countResult = await db.select({ count: count() }).from(tbl_magazine).where(and(...whereConditions));
        const totalCount = Number(countResult[0]?.count || 0);

        const results = await db
            .select()
            .from(tbl_magazine)
            .where(and(...whereConditions))
            .orderBy(tbl_magazine.title)
            .limit(limit)
            .offset(offset);

        const hasMore = offset + limit < totalCount;
        const totalPages = Math.ceil(totalCount / limit);

        const magazinesWithProxy = results.map((item: any) => ({
            ...item,
            coverImage: convertToProxyUrl(item.coverImage)
        }));

        return json({
            success: true,
            data: {
                magazines: magazinesWithProxy,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNextPage: hasMore,
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (err: any) {
        console.error('GET /api/magazines error:', err);
        return json({ success: false, message: err.message || 'Failed to fetch magazines' }, { status: err.status || 500 });
    }
};

// POST - create magazine
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { itemType = 'magazine', ...itemData } = body;

        if (itemType !== 'magazine') {
            return json({ success: false, message: 'This endpoint only accepts magazines' }, { status: 400 });
        }

        const incomingMagazineId = itemData.magazineId ? String(itemData.magazineId).trim() : '';
        const incomingIssn = itemData.issn ? String(itemData.issn).trim() : '';

        if (incomingMagazineId) {
            const [existingById] = await db.select({ id: tbl_magazine.id }).from(tbl_magazine).where(eq(tbl_magazine.magazineId, incomingMagazineId)).limit(1);
            if (existingById) return json({ success: false, message: 'Magazine ID already exists' }, { status: 409 });
        }

        if (incomingIssn) {
            const [existingByIssn] = await db.select({ id: tbl_magazine.id }).from(tbl_magazine).where(eq(tbl_magazine.issn, incomingIssn)).limit(1);
            if (existingByIssn) return json({ success: false, message: 'ISSN already exists' }, { status: 409 });
        }

        const newMagazineId = incomingMagazineId || `MG-${Date.now()}`;
        const totalCopies = itemData.totalCopies || 1;

        const [magazine] = await db.insert(tbl_magazine).values({
            magazineId: newMagazineId,
            title: itemData.title,
            publisher: itemData.publisher,
            issn: incomingIssn || null,
            issueNumber: itemData.issueNumber,
            volume: itemData.volume,
            publishedDate: itemData.publishedDate || null,
            language: itemData.language || 'English',
            categoryId: itemData.categoryId,
            location: itemData.location,
            totalCopies: totalCopies,
            availableCopies: totalCopies,
            description: itemData.description,
            coverImage: itemData.coverImage,
            isActive: true
        }).returning();

        // create copies
        if (totalCopies >= 1) {
            const copiesData: any[] = [];
            for (let copyNum = 1; copyNum <= totalCopies; copyNum++) {
                const callNumber = `${newMagazineId}-C${copyNum}`;
                const qrCode = generateQRCode();
                copiesData.push({
                    magazineId: magazine.id,
                    copyNumber: copyNum,
                    callNumber,
                    qrCode,
                    status: 'available',
                    isActive: true
                });
            }
            if (copiesData.length > 0) await db.insert(tbl_magazine_copy).values(copiesData);
        }

        try {
            publishMagazineEvent('magazine-created', { id: magazine.id, magazineId: newMagazineId, totalCopies });
        } catch (e) {
            console.debug('Failed to publish magazine-created event:', e);
        }

        return json({ success: true, message: 'Magazine created successfully', data: magazine });
    } catch (err: any) {
        console.error('POST /api/magazines error:', err);
        return json({ success: false, message: err.message || 'Failed to create magazine' }, { status: err.status || 500 });
    }
};

// PUT - update magazine
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { id, itemType = 'magazine', ...updateData } = body;
        if (!id) throw error(400, { message: 'ID is required' });
        if (itemType !== 'magazine') return json({ success: false, message: 'This endpoint only updates magazines' }, { status: 400 });

        const [magazine] = await db.update(tbl_magazine).set(updateData).where(eq(tbl_magazine.id, id)).returning();
        return json({ success: true, message: 'Magazine updated successfully', data: magazine });
    } catch (err: any) {
        console.error('PUT /api/magazines error:', err);
        return json({ success: false, message: err.message || 'Failed to update magazine' }, { status: err.status || 500 });
    }
};

// DELETE - soft delete magazine
export const DELETE: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { id, itemType = 'magazine' } = body;
        if (!id) throw error(400, { message: 'ID is required' });
        if (itemType !== 'magazine') return json({ success: false, message: 'This endpoint only deletes magazines' }, { status: 400 });

        await db.update(tbl_magazine).set({ isActive: false }).where(eq(tbl_magazine.id, id));
        return json({ success: true, message: 'Magazine deleted successfully' });
    } catch (err: any) {
        console.error('DELETE /api/magazines error:', err);
        return json({ success: false, message: err.message || 'Failed to delete magazine' }, { status: err.status || 500 });
    }
};
