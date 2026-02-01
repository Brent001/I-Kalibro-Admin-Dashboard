// src/routes/api/books/+server.ts - Fixed TypeScript errors

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, ilike, and, or, gt, lt, inArray, isNull, count, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_book,
    tbl_book_copy,
    tbl_magazine,
    tbl_magazine_copy,
    tbl_research_document,
    tbl_research_copy,
    tbl_multimedia,
    tbl_multimedia_copy,
    tbl_category,
    tbl_super_admin,
    tbl_admin,
    tbl_staff
} from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin' | 'staff' | 'user';
    username: string;
    email: string;
}

// Authenticate user across all role types
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

        if (await isSessionRevoked(token)) {
            return null;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;

        if (!userId) return null;

        // Try to find user in staff tables (admin operations)
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

// GET - Fetch books/items with filtering
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
        const itemType = searchParams.get('itemType') || 'book'; // 'book', 'magazine', 'research', 'multimedia'
        const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!, 10) : undefined;
        const categoryName = searchParams.get('category') || '';
        const language = searchParams.get('lang') || searchParams.get('language') || '';
        const offset = (page - 1) * limit;

        let results: any[] = [];
        let totalCount = 0;

        // Fetch items based on type
        if (itemType === 'book') {
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
                    // No matching category, return empty results
                    return json({
                        success: true,
                        data: {
                            books: [],
                            pagination: {
                                currentPage: page,
                                totalPages: 0,
                                totalCount: 0,
                                limit: limit,
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
            totalCount = Number(countResult[0]?.count || 0);

            // Get paginated results
            results = await db
                .select()
                .from(tbl_book)
                .where(and(...whereConditions))
                .orderBy(tbl_book.title)
                .limit(limit)
                .offset(offset);
        } else if (itemType === 'magazine') {
            const whereConditions: SQL<unknown>[] = [eq(tbl_magazine.isActive, true)];
            if (search) {
                whereConditions.push(
                    or(
                        ilike(tbl_magazine.title, `%${search}%`),
                        ilike(tbl_magazine.publisher, `%${search}%`)
                    )!
                );
            }
            if (categoryId) {
                whereConditions.push(eq(tbl_magazine.categoryId, categoryId));
            }
            if (categoryName && categoryName !== 'all') {
                const matchingCategories = await db
                    .select({ id: tbl_category.id })
                    .from(tbl_category)
                    .where(ilike(tbl_category.name, categoryName));
                const categoryIds = matchingCategories.map(c => c.id);
                if (categoryIds.length > 0) {
                    whereConditions.push(inArray(tbl_magazine.categoryId, categoryIds));
                } else {
                    return json({
                        success: true,
                        data: {
                            books: [],
                            pagination: {
                                currentPage: page,
                                totalPages: 0,
                                totalCount: 0,
                                limit: limit,
                                hasNextPage: false,
                                hasPrevPage: false
                            }
                        }
                    });
                }
            }
            if (language) {
                whereConditions.push(ilike(tbl_magazine.language, language));
            }

            const countResult = await db
                .select({ count: count() })
                .from(tbl_magazine)
                .where(and(...whereConditions));
            totalCount = Number(countResult[0]?.count || 0);

            results = await db
                .select()
                .from(tbl_magazine)
                .where(and(...whereConditions))
                .orderBy(tbl_magazine.title)
                .limit(limit)
                .offset(offset);
        } else if (itemType === 'research') {
            const whereConditions: SQL<unknown>[] = [eq(tbl_research_document.isActive, true)];
            if (search) {
                whereConditions.push(
                    or(
                        ilike(tbl_research_document.title, `%${search}%`),
                        ilike(tbl_research_document.author, `%${search}%`)
                    )!
                );
            }
            if (categoryId) {
                whereConditions.push(eq(tbl_research_document.categoryId, categoryId));
            }
            if (categoryName && categoryName !== 'all') {
                const matchingCategories = await db
                    .select({ id: tbl_category.id })
                    .from(tbl_category)
                    .where(ilike(tbl_category.name, categoryName));
                const categoryIds = matchingCategories.map(c => c.id);
                if (categoryIds.length > 0) {
                    whereConditions.push(inArray(tbl_research_document.categoryId, categoryIds));
                } else {
                    return json({
                        success: true,
                        data: {
                            books: [],
                            pagination: {
                                currentPage: page,
                                totalPages: 0,
                                totalCount: 0,
                                limit: limit,
                                hasNextPage: false,
                                hasPrevPage: false
                            }
                        }
                    });
                }
            }

            const countResult = await db
                .select({ count: count() })
                .from(tbl_research_document)
                .where(and(...whereConditions));
            totalCount = Number(countResult[0]?.count || 0);

            results = await db
                .select()
                .from(tbl_research_document)
                .where(and(...whereConditions))
                .orderBy(tbl_research_document.title)
                .limit(limit)
                .offset(offset);
        } else if (itemType === 'multimedia') {
            const whereConditions: SQL<unknown>[] = [eq(tbl_multimedia.isActive, true)];
            if (search) {
                whereConditions.push(
                    or(
                        ilike(tbl_multimedia.title, `%${search}%`),
                        ilike(tbl_multimedia.creator, `%${search}%`)
                    )!
                );
            }
            if (categoryId) {
                whereConditions.push(eq(tbl_multimedia.categoryId, categoryId));
            }
            if (categoryName && categoryName !== 'all') {
                const matchingCategories = await db
                    .select({ id: tbl_category.id })
                    .from(tbl_category)
                    .where(ilike(tbl_category.name, categoryName));
                const categoryIds = matchingCategories.map(c => c.id);
                if (categoryIds.length > 0) {
                    whereConditions.push(inArray(tbl_multimedia.categoryId, categoryIds));
                } else {
                    return json({
                        success: true,
                        data: {
                            books: [],
                            pagination: {
                                currentPage: page,
                                totalPages: 0,
                                totalCount: 0,
                                limit: limit,
                                hasNextPage: false,
                                hasPrevPage: false
                            }
                        }
                    });
                }
            }

            const countResult = await db
                .select({ count: count() })
                .from(tbl_multimedia)
                .where(and(...whereConditions));
            totalCount = Number(countResult[0]?.count || 0);

            results = await db
                .select()
                .from(tbl_multimedia)
                .where(and(...whereConditions))
                .orderBy(tbl_multimedia.title)
                .limit(limit)
                .offset(offset);
        } else {
            // Unknown item type
            return json({
                success: false,
                message: 'Unknown item type'
            }, { status: 400 });
        }

        const hasMore = offset + limit < totalCount;
        const totalPages = Math.ceil(totalCount / limit);

        return json({
            success: true,
            data: {
                books: results,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalCount: totalCount,
                    limit: limit,
                    hasNextPage: hasMore,
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (err: any) {
        console.error('GET /api/books error:', err);
        return json({
            success: false,
            message: err.message || 'Failed to fetch items'
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

        let result;

        if (itemType === 'book') {
            // Normalize incoming identifiers
            const incomingBookId = itemData.bookId ? String(itemData.bookId).trim() : '';
            const incomingIsbn = itemData.isbn ? String(itemData.isbn).trim() : '';

            // Check uniqueness before attempting insert to return a friendly error
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

            const newBookId = incomingBookId || `BK-${Date.now()}`;

            const [book] = await db
                .insert(tbl_book)
                .values({
                    bookId: newBookId,
                    title: itemData.title,
                    author: itemData.author,
                    isbn: incomingIsbn || null,
                    publisher: itemData.publisher,
                    publishedYear: itemData.publishedYear,
                    edition: itemData.edition,
                    language: itemData.language || 'English',
                    pages: itemData.pages,
                    categoryId: itemData.categoryId,
                    location: itemData.location,
                    totalCopies: itemData.totalCopies || 0,
                    availableCopies: itemData.totalCopies || 0,
                    description: itemData.description,
                    coverImage: itemData.coverImage,
                    isActive: true
                })
                .returning();
            result = book;
        } else if (itemType === 'magazine') {
            const [magazine] = await db
                .insert(tbl_magazine)
                .values({
                    magazineId: itemData.magazineId || `MG-${Date.now()}`,
                    title: itemData.title,
                    publisher: itemData.publisher,
                    issn: itemData.issn,
                    issueNumber: itemData.issueNumber,
                    volume: itemData.volume,
                    publishedDate: itemData.publishedDate,
                    language: itemData.language || 'English',
                    categoryId: itemData.categoryId,
                    location: itemData.location,
                    totalCopies: itemData.totalCopies || 0,
                    availableCopies: itemData.totalCopies || 0,
                    description: itemData.description,
                    coverImage: itemData.coverImage,
                    isActive: true
                })
                .returning();
            result = magazine;
        } else if (itemType === 'research') {
            const [research] = await db
                .insert(tbl_research_document)
                .values({
                    researchId: itemData.researchId || `RS-${Date.now()}`,
                    title: itemData.title,
                    author: itemData.author,
                    advisor: itemData.advisor,
                    department: itemData.department,
                    degreeProgram: itemData.degreeProgram,
                    publicationYear: itemData.publicationYear,
                    abstract: itemData.abstract,
                    keywords: itemData.keywords,
                    categoryId: itemData.categoryId,
                    location: itemData.location,
                    totalCopies: itemData.totalCopies || 0,
                    availableCopies: itemData.totalCopies || 0,
                    pdfFile: itemData.pdfFile,
                    isActive: true
                })
                .returning();
            result = research;
        } else if (itemType === 'multimedia') {
            const [multimedia] = await db
                .insert(tbl_multimedia)
                .values({
                    multimediaId: itemData.multimediaId || `MM-${Date.now()}`,
                    title: itemData.title,
                    type: itemData.type,
                    creator: itemData.creator,
                    publisher: itemData.publisher,
                    releaseYear: itemData.releaseYear,
                    duration: itemData.duration,
                    categoryId: itemData.categoryId,
                    location: itemData.location,
                    totalCopies: itemData.totalCopies || 0,
                    availableCopies: itemData.totalCopies || 0,
                    description: itemData.description,
                    isActive: true
                })
                .returning();
            result = multimedia;
        }

        return json({
            success: true,
            message: 'Item created successfully',
            data: result
        });
    } catch (err: any) {
        console.error('POST /api/books error:', err);
        return json({
            success: false,
            message: err.message || 'Failed to create item'
        }, { status: err.status || 500 });
    }
};

// PUT - Update an item
export const PUT: RequestHandler = async ({ request, url }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { id, itemType = 'book', ...updateData } = body;

        if (!id) {
            throw error(400, { message: 'ID is required' });
        }

        let result;

        if (itemType === 'book') {
            const [book] = await db
                .update(tbl_book)
                .set(updateData)
                .where(eq(tbl_book.id, id))
                .returning();
            result = book;
        } else if (itemType === 'magazine') {
            const [magazine] = await db
                .update(tbl_magazine)
                .set(updateData)
                .where(eq(tbl_magazine.id, id))
                .returning();
            result = magazine;
        } else if (itemType === 'research') {
            const [research] = await db
                .update(tbl_research_document)
                .set(updateData)
                .where(eq(tbl_research_document.id, id))
                .returning();
            result = research;
        } else if (itemType === 'multimedia') {
            const [multimedia] = await db
                .update(tbl_multimedia)
                .set(updateData)
                .where(eq(tbl_multimedia.id, id))
                .returning();
            result = multimedia;
        }

        return json({
            success: true,
            message: 'Item updated successfully',
            data: result
        });
    } catch (err: any) {
        console.error('PUT /api/books error:', err);
        return json({
            success: false,
            message: err.message || 'Failed to update item'
        }, { status: err.status || 500 });
    }
};

// DELETE - Delete an item
export const DELETE: RequestHandler = async ({ request, url }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin access required' });
        }

        const body = await request.json();
        const { id, itemType = 'book' } = body;

        if (!id) {
            throw error(400, { message: 'ID is required' });
        }

        // Soft delete by setting isActive to false
        if (itemType === 'book') {
            await db.update(tbl_book).set({ isActive: false }).where(eq(tbl_book.id, id));
        } else if (itemType === 'magazine') {
            await db.update(tbl_magazine).set({ isActive: false }).where(eq(tbl_magazine.id, id));
        } else if (itemType === 'research') {
            await db.update(tbl_research_document).set({ isActive: false }).where(eq(tbl_research_document.id, id));
        } else if (itemType === 'multimedia') {
            await db.update(tbl_multimedia).set({ isActive: false }).where(eq(tbl_multimedia.id, id));
        }

        return json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (err: any) {
        console.error('DELETE /api/books error:', err);
        return json({
            success: false,
            message: err.message || 'Failed to delete item'
        }, { status: err.status || 500 });
    }
};