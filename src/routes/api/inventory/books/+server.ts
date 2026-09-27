// src/routes/api/books/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, ilike, and, or, inArray, count, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '$lib/server/db/index.js';
import {
    tbl_book,
    tbl_book_copy,
    tbl_category,
    tbl_super_admin,
    tbl_admin,
    tbl_staff
} from '$lib/server/db/schema/schema.js';
import { publish as publishBookEvent } from '$lib/server/events/booksEvents.js';
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

// GET - Fetch books with filtering
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

        const whereConditions: SQL<unknown>[] = [eq(tbl_book.isActive, true)];

        if (search) {
            whereConditions.push(
                or(
                    ilike(tbl_book.title, `%${search}%`),
                    ilike(tbl_book.author, `%${search}%`),
                    ilike(tbl_book.isbn, `%${search}%`)
                )!
            );
        }

        if (categoryId) {
            whereConditions.push(eq(tbl_book.categoryId, categoryId));
        }

        if (categoryName && categoryName !== 'all') {
            const matchingCategories = await db
                .select({ id: tbl_category.id })
                .from(tbl_category)
                .where(ilike(tbl_category.name, categoryName));
            const categoryIds = matchingCategories.map(c => c.id);
            if (categoryIds.length > 0) {
                whereConditions.push(inArray(tbl_book.categoryId, categoryIds));
            } else {
                return json({
                    success: true,
                    data: {
                        books: [],
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
            whereConditions.push(ilike(tbl_book.language, language));
        }

        // Get total count
        const countResult = await db
            .select({ count: count() })
            .from(tbl_book)
            .where(and(...whereConditions));
        const totalCount = Number(countResult[0]?.count || 0);

        // Get paginated results
        const results = await db
            .select()
            .from(tbl_book)
            .where(and(...whereConditions))
            .orderBy(tbl_book.title)
            .limit(limit)
            .offset(offset);

        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = offset + limit < totalCount;

        // ── FIX: compute real-time available/total copy counts from tbl_book_copy ──
        // This replaces the stale denormalized columns on tbl_book.
        const bookIds = results.map(b => b.id);

        let copyCountMap: Record<number, { available: number; total: number }> = {};

        if (bookIds.length > 0) {
            const copyCounts = await db
                .select({
                    bookId: tbl_book_copy.bookId,
                    total:     count(),
                    available: sql<number>`COUNT(*) FILTER (WHERE ${tbl_book_copy.status} = 'available' AND ${tbl_book_copy.isActive} = true)`
                })
                .from(tbl_book_copy)
                .where(and(
                    inArray(tbl_book_copy.bookId, bookIds),
                    eq(tbl_book_copy.isActive, true)
                ))
                .groupBy(tbl_book_copy.bookId);

            for (const row of copyCounts) {
                copyCountMap[row.bookId] = {
                    available: Number(row.available),
                    total: Number(row.total)
                };
            }
        }

        const booksWithLiveCounts = results.map(book => ({
            ...book,
            coverImage: convertToProxyUrl(book.coverImage),
            // Override stale denormalized columns with live counts
            availableCopies: copyCountMap[book.id]?.available ?? 0,
            totalCopies:     copyCountMap[book.id]?.total     ?? book.totalCopies
        }));

        return json({
            success: true,
            data: {
                books: booksWithLiveCounts,
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
        console.error('GET /api/books error:', err);
        return json({
            success: false,
            message: err.message || 'Failed to fetch books'
        }, { status: err.status || 500 });
    }
};

// POST - Create a new book
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { itemType = 'book', ...itemData } = body;

        if (itemType !== 'book') {
            return json({ success: false, message: 'This endpoint only accepts books' }, { status: 400 });
        }

        const incomingBookId = itemData.bookId ? String(itemData.bookId).trim() : '';
        const incomingIsbn   = itemData.isbn   ? String(itemData.isbn).trim()   : '';

        if (incomingBookId) {
            const [existingById] = await db
                .select({ id: tbl_book.id })
                .from(tbl_book)
                .where(eq(tbl_book.bookId, incomingBookId))
                .limit(1);
            if (existingById) {
                return json({ success: false, message: 'Book ID already exists' }, { status: 409 });
            }
        }

        if (incomingIsbn) {
            const [existingByIsbn] = await db
                .select({ id: tbl_book.id })
                .from(tbl_book)
                .where(eq(tbl_book.isbn, incomingIsbn))
                .limit(1);
            if (existingByIsbn) {
                return json({ success: false, message: 'ISBN already exists' }, { status: 409 });
            }
        }

        const newBookId      = incomingBookId || `BK-${Date.now()}`;
        const baseCallNumber = itemData.location || `${newBookId}`;
        const totalCopies    = itemData.totalCopies || 1;

        const [book] = await db
            .insert(tbl_book)
            .values({
                bookId:        newBookId,
                title:         itemData.title,
                author:        itemData.author,
                isbn:          incomingIsbn || null,
                publisher:     itemData.publisher,
                publishedYear: itemData.publishedYear,
                edition:       itemData.edition,
                language:      itemData.language || 'English',
                pages:         itemData.pages,
                categoryId:    itemData.categoryId,
                location:      itemData.location,
                totalCopies:   totalCopies,
                availableCopies: totalCopies,
                description:   itemData.description,
                coverImage:    itemData.coverImage,
                isActive:      true
            })
            .returning();

        if (totalCopies >= 1) {
            const copiesData = [];
            for (let copyNum = 1; copyNum <= totalCopies; copyNum++) {
                copiesData.push({
                    bookId:     book.id,
                    copyNumber: copyNum,
                    callNumber: generateCallNumberVariation(baseCallNumber, copyNum),
                    qrCode:     generateQRCode(),
                    status:     'available',
                    isActive:   true
                });
            }
            if (copiesData.length > 0) {
                await db.insert(tbl_book_copy).values(copiesData);
            }
        }

        try {
            publishBookEvent('book-created', { id: book.id, bookId: newBookId, totalCopies });
        } catch (e) {
            console.debug('Failed to publish book-created event:', e);
        }

        return json({ success: true, message: 'Book created successfully', data: book });
    } catch (err: any) {
        console.error('POST /api/books error:', err);
        return json({ success: false, message: err.message || 'Failed to create book' }, { status: err.status || 500 });
    }
};

// PUT - Update a book
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { id, itemType = 'book', ...updateData } = body;

        if (!id)              throw error(400, { message: 'ID is required' });
        if (itemType !== 'book') return json({ success: false, message: 'This endpoint only updates books' }, { status: 400 });

        const [book] = await db
            .update(tbl_book)
            .set(updateData)
            .where(eq(tbl_book.id, id))
            .returning();

        return json({ success: true, message: 'Book updated successfully', data: book });
    } catch (err: any) {
        console.error('PUT /api/books error:', err);
        return json({ success: false, message: err.message || 'Failed to update item' }, { status: err.status || 500 });
    }
};

// DELETE - Soft-delete a book
export const DELETE: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { id, itemType = 'book' } = body;

        if (!id)              throw error(400, { message: 'ID is required' });
        if (itemType !== 'book') return json({ success: false, message: 'This endpoint only deletes books' }, { status: 400 });

        await db.update(tbl_book).set({ isActive: false }).where(eq(tbl_book.id, id));

        return json({ success: true, message: 'Book deleted successfully' });
    } catch (err: any) {
        console.error('DELETE /api/books error:', err);
        return json({ success: false, message: err.message || 'Failed to delete item' }, { status: err.status || 500 });
    }
};