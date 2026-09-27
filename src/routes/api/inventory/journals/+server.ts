// src/routes/api/journals/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, ilike, and, or, inArray, count, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '$lib/server/db/index.js';
import {
    tbl_journal,
    tbl_journal_copy,
    tbl_category,
    tbl_super_admin,
    tbl_admin,
    tbl_staff
} from '$lib/server/db/schema/schema.js';
import { publish as publishJournalEvent } from '../../../../lib/server/events/journalsEvents.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { convertToProxyUrl } from '$lib/server/utils/backblazeUpload.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Generate a unique QR code identifier
 */
function generateQRCode(): string {
    return 'QR-' + randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Generate call number variation for a specific copy
 */
function generateCallNumberVariation(baseCallNumber: string, copyNumber: number): string {
    return `${baseCallNumber}-C${copyNumber}`;
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

// GET - Fetch journals with filtering
export const GET: RequestHandler = async ({ request, url }) => {
    try {
        const user = await authenticateUser(request);
        if (!user) {
            throw error(401, { message: 'Unauthorized' });
        }

        const searchParams = url.searchParams;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100);
        const search = searchParams.get('q') || '';
        const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!, 10) : undefined;
        const categoryName = searchParams.get('category') || '';
        const language = searchParams.get('lang') || searchParams.get('language') || '';
        const offset = (page - 1) * limit;

        const whereConditions: SQL<unknown>[] = [eq(tbl_journal.isActive, true)];

        if (search) {
            whereConditions.push(
                or(
                    ilike(tbl_journal.title, `%${search}%`),
                    ilike(tbl_journal.publisher, `%${search}%`),
                    ilike(tbl_journal.issn, `%${search}%`)
                )!
            );
        }

        if (categoryId) {
            whereConditions.push(eq(tbl_journal.categoryId, categoryId));
        }

        if (categoryName && categoryName !== 'all') {
            const matchingCategories = await db
                .select({ id: tbl_category.id })
                .from(tbl_category)
                .where(ilike(tbl_category.name, categoryName));
            const categoryIds = matchingCategories.map(c => c.id);
            if (categoryIds.length > 0) {
                whereConditions.push(inArray(tbl_journal.categoryId, categoryIds));
            } else {
                return json({
                    success: true,
                    data: {
                        journals: [],
                        pagination: {
                            currentPage: page,
                            totalPages: 0,
                            totalCount: 0,
                            limit,
                            hasNextPage: false,
                            hasPrevPage: false
                        }
                    }
                });
            }
        }

        if (language) {
            whereConditions.push(ilike(tbl_journal.language, language));
        }

        // Get total count
        const countResult = await db
            .select({ count: count() })
            .from(tbl_journal)
            .where(and(...whereConditions));
        const totalCount = Number(countResult[0]?.count || 0);

        // Get paginated results
        const results = await db
            .select()
            .from(tbl_journal)
            .where(and(...whereConditions))
            .orderBy(tbl_journal.title)
            .limit(limit)
            .offset(offset);

        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = offset + limit < totalCount;

        // live counts from copies
        const journalIds = results.map(j => j.id);

        let copyCountMap: Record<number, { available: number; total: number }> = {};

        if (journalIds.length > 0) {
            const copyCounts = await db
                .select({
                    journalId: tbl_journal_copy.journalId,
                    total:     count(),
                    available: sql<number>`COUNT(*) FILTER (WHERE ${tbl_journal_copy.status} = 'available' AND ${tbl_journal_copy.isActive} = true)`
                })
                .from(tbl_journal_copy)
                .where(and(
                    inArray(tbl_journal_copy.journalId, journalIds),
                    eq(tbl_journal_copy.isActive, true)
                ))
                .groupBy(tbl_journal_copy.journalId);

            for (const row of copyCounts) {
                copyCountMap[row.journalId] = {
                    available: Number(row.available),
                    total: Number(row.total)
                };
            }
        }

        const journalsWithLiveCounts = results.map(journal => ({
            ...journal,
            coverImage: convertToProxyUrl(journal.coverImage),
            availableCopies: copyCountMap[journal.id]?.available ?? 0,
            totalCopies:     copyCountMap[journal.id]?.total     ?? journal.totalCopies
        }));

        return json({
            success: true,
            data: {
                journals: journalsWithLiveCounts,
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
        console.error('GET /api/journals error:', err);
        return json({
            success: false,
            message: err.message || 'Failed to fetch journals'
        }, { status: err.status || 500 });
    }
};

// POST - Create a new journal
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { itemType = 'journal', ...itemData } = body;

        if (itemType !== 'journal') {
            return json({ success: false, message: 'This endpoint only accepts journals' }, { status: 400 });
        }

        const incomingJournalId = itemData.journalId ? String(itemData.journalId).trim() : '';
        const incomingIssn      = itemData.issn      ? String(itemData.issn).trim()      : '';

        if (incomingJournalId) {
            const [existingById] = await db
                .select({ id: tbl_journal.id })
                .from(tbl_journal)
                .where(eq(tbl_journal.journalId, incomingJournalId))
                .limit(1);
            if (existingById) {
                return json({ success: false, message: 'Journal ID already exists' }, { status: 409 });
            }
        }

        if (incomingIssn) {
            const [existingByIssn] = await db
                .select({ id: tbl_journal.id })
                .from(tbl_journal)
                .where(eq(tbl_journal.issn, incomingIssn))
                .limit(1);
            if (existingByIssn) {
                return json({ success: false, message: 'ISSN already exists' }, { status: 409 });
            }
        }

        const newJournalId = incomingJournalId || `JR-${Date.now()}`;
        const baseCallNumber = itemData.location || `${newJournalId}`;
        const totalCopies    = itemData.totalCopies || 1;

        const [journal] = await db
            .insert(tbl_journal)
            .values({
                journalId:      newJournalId,
                title:          itemData.title,
                publisher:      itemData.publisher,
                issn:           incomingIssn || null,
                issueNumber:    itemData.issueNumber,
                volume:         itemData.volume,
                publishedDate:  itemData.publishedDate,
                language:       itemData.language || 'English',
                categoryId:     itemData.categoryId,
                location:       itemData.location,
                totalCopies:    totalCopies,
                availableCopies: totalCopies,
                description:    itemData.description,
                coverImage:     itemData.coverImage,
                isActive:       true
            })
            .returning();

        if (totalCopies >= 1) {
            const copiesData = [];
            for (let copyNum = 1; copyNum <= totalCopies; copyNum++) {
                copiesData.push({
                    journalId:  journal.id,
                    copyNumber: copyNum,
                    callNumber: generateCallNumberVariation(baseCallNumber, copyNum),
                    qrCode:     generateQRCode(),
                    status:     'available',
                    isActive:   true
                });
            }
            if (copiesData.length > 0) {
                await db.insert(tbl_journal_copy).values(copiesData);
            }
        }

        try {
            publishJournalEvent('journal-created', { id: journal.id, journalId: newJournalId, totalCopies });
        } catch (e) {
            console.debug('Failed to publish journal-created event:', e);
        }

        return json({ success: true, message: 'Journal created successfully', data: journal });
    } catch (err: any) {
        console.error('POST /api/journals error:', err);
        return json({ success: false, message: err.message || 'Failed to create journal' }, { status: err.status || 500 });
    }
};

// PUT - Update a journal
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { id, itemType = 'journal', ...updateData } = body;

        if (!id)              throw error(400, { message: 'ID is required' });
        if (itemType !== 'journal') return json({ success: false, message: 'This endpoint only updates journals' }, { status: 400 });

        const [journal] = await db
            .update(tbl_journal)
            .set(updateData)
            .where(eq(tbl_journal.id, id))
            .returning();

        return json({ success: true, message: 'Journal updated successfully', data: journal });
    } catch (err: any) {
        console.error('PUT /api/journals error:', err);
        return json({ success: false, message: err.message || 'Failed to update item' }, { status: err.status || 500 });
    }
};

// DELETE - Soft-delete a journal
export const DELETE: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { id, itemType = 'journal' } = body;

        if (!id)              throw error(400, { message: 'ID is required' });
        if (itemType !== 'journal') return json({ success: false, message: 'This endpoint only deletes journals' }, { status: 400 });

        await db.update(tbl_journal).set({ isActive: false }).where(eq(tbl_journal.id, id));

        return json({ success: true, message: 'Journal deleted successfully' });
    } catch (err: any) {
        console.error('DELETE /api/journals error:', err);
        return json({ success: false, message: err.message || 'Failed to delete item' }, { status: err.status || 500 });
    }
};
