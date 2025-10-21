// src/routes/api/books/+server.ts - Updated for originPlace field

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, like, and, or, gt, count, not } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { book, staffAccount, category, bookBorrowing } from '$lib/server/db/schema/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
  id: number;
  role: string;
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

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;

    if (!userId) return null;

    const [user] = await db
      .select({
        id: staffAccount.id,
        username: staffAccount.username,
        email: staffAccount.email,
        role: staffAccount.role,
        isActive: staffAccount.isActive
      })
      .from(staffAccount)
      .where(eq(staffAccount.id, userId))
      .limit(1);

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      role: user.role || '',
      username: user.username || '',
      email: user.email || ''
    };
  } catch (err) {
    console.error('Authentication error:', err);
    return null;
  }
}

function validateYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return year >= 1000 && year <= currentYear;
}

// GET - Fetch books with enhanced filtering
export const GET: RequestHandler = async ({ request, url }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    const searchParams = url.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const author = searchParams.get('author') || '';
    const available = searchParams.get('available');
    const bookId = searchParams.get('bookId') || '';

    if (page < 1 || limit < 1) {
      throw error(400, { message: 'Invalid pagination parameters. Page and limit must be >= 1' });
    }

    const offset = (page - 1) * limit;
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(book.title, `%${search}%`),
          like(book.author, `%${search}%`)
        )
      );
    }

    if (categoryId && categoryId !== 'all') {
      conditions.push(eq(book.categoryId, parseInt(categoryId)));
    }

    if (author) {
      conditions.push(like(book.author, `%${author}%`));
    }

    if (available === 'true') {
      conditions.push(gt(book.copiesAvailable, 0));
    }

    if (bookId) {
      conditions.push(like(book.bookId, `%${bookId}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalCountResult = await db
      .select({ count: count() })
      .from(book)
      .where(whereClause);

    const totalCount = totalCountResult[0]?.count || 0;

    // Join with category table to get category name
    const books = await db
      .select({
        id: book.id,
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        publishedYear: book.publishedYear,
        copiesAvailable: book.copiesAvailable,
        categoryId: book.categoryId,
        category: category.name,
        language: book.language,
        originPlace: book.originPlace,
        publisher: book.publisher,
        location: book.location,
        description: book.description
      })
      .from(book)
      .leftJoin(category, eq(book.categoryId, category.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(book.title);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return json({
      success: true,
      data: {
        books,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (err) {
    console.error('Error fetching books:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, { message: 'Internal server error' });
  }
};

// POST - Create new book with originPlace support
export const POST: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    if (user.role !== 'admin' && user.role !== 'staff') {
      throw error(403, { message: 'Insufficient permissions to add books' });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['bookId', 'title', 'author', 'publishedYear', 'copiesAvailable', 'categoryId'];
    const missingFields = requiredFields.filter(field => !body[field]);
    if (missingFields.length > 0) {
      throw error(400, { message: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate bookId format
    if (!/^[A-Z0-9\-]+$/i.test(body.bookId.trim())) {
      throw error(400, { message: 'Book ID must be alphanumeric and may include dashes.' });
    }

    // Validate year
    if (!validateYear(body.publishedYear)) {
      throw error(400, { message: `Published year must be between 1000 and ${new Date().getFullYear()}` });
    }

    // Check if bookId already exists
    const existingBookId = await db
      .select({ id: book.id })
      .from(book)
      .where(eq(book.bookId, body.bookId.trim()))
      .limit(1);
    
    if (existingBookId.length > 0) {
      throw error(409, { message: `A book with Book ID "${body.bookId}" already exists.` });
    }

    // Verify category exists
    const [categoryExists] = await db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.id, body.categoryId))
      .limit(1);

    if (!categoryExists) {
      throw error(400, { message: 'Invalid category ID' });
    }

    // Prepare book data for insertion (only fields in schema)
    const bookData = {
      bookId: body.bookId.trim(),
      title: body.title.trim(),
      author: body.author.trim(),
      language: body.language ? body.language.trim() : null,
      originPlace: body.originPlace ? body.originPlace.trim() : null,
      publishedYear: body.publishedYear,
      copiesAvailable: body.copiesAvailable,
      categoryId: body.categoryId,
      publisher: body.publisher ? body.publisher.trim() : null,
      location: body.location ? body.location.trim() : null,
      description: body.description ? body.description.trim() : null
    };

    // Insert the book
    const [newBook] = await db
      .insert(book)
      .values(bookData)
      .returning({
        id: book.id,
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        language: book.language,
        originPlace: book.originPlace,
        publishedYear: book.publishedYear,
        copiesAvailable: book.copiesAvailable,
        categoryId: book.categoryId,
        publisher: book.publisher,
        location: book.location,
        description: book.description
      });

    // Get category name for response
    const [cat] = await db
      .select({ name: category.name })
      .from(category)
      .where(eq(category.id, Number(newBook.categoryId)))
      .limit(1);

    return json({
      success: true,
      data: { 
        book: { ...newBook, category: cat?.name },
        message: `Book "${newBook.title}" has been successfully added to the library.`
      },
      message: 'Book created successfully'
    }, { status: 201 });

  } catch (err) {
    console.error('Error creating book:', err instanceof Error ? err.message : err);
    if ((err as any).status) {
      throw err;
    }
    throw error(500, { message: 'Internal server error while creating book' });
  }
};

// PUT - Update book with originPlace support
export const PUT: RequestHandler = async ({ request, url }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    if (user.role !== 'admin' && user.role !== 'staff') {
      throw error(403, { message: 'Insufficient permissions to update books' });
    }

    const bookId = url.searchParams.get('id');
    if (!bookId || isNaN(parseInt(bookId))) {
      throw error(400, { message: 'Valid book ID is required' });
    }

    const body = await request.json();

    // Validate bookId if present
    if (body.bookId !== undefined) {
      if (!/^[A-Z0-9\-]+$/i.test(body.bookId.trim())) {
        throw error(400, { message: 'Book ID must be alphanumeric and may include dashes.' });
      }
      // Check uniqueness
      const conflict = await db
        .select({ id: book.id })
        .from(book)
        .where(and(
          eq(book.bookId, body.bookId.trim()),
          not(eq(book.id, parseInt(bookId)))
        ))
        .limit(1);
      
      if (conflict.length > 0) {
        throw error(409, { message: `A book with Book ID "${body.bookId}" already exists.` });
      }
    }

    // Validate categoryId if present
    if (body.categoryId !== undefined) {
      const categoryExists = await db
        .select({ id: category.id })
        .from(category)
        .where(eq(category.id, body.categoryId))
        .limit(1);

      if (categoryExists.length === 0) {
        throw error(400, { message: 'Invalid categoryId' });
      }
    }

    // Check if book exists
    const existingBook = await db
      .select({ 
        id: book.id, 
        title: book.title
      })
      .from(book)
      .where(eq(book.id, parseInt(bookId)))
      .limit(1);

    if (existingBook.length === 0) {
      throw error(404, { message: 'Book not found' });
    }

    // Validate updates
    const validationErrors: string[] = [];

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        validationErrors.push('Title cannot be empty');
      } else if (body.title.length > 200) {
        validationErrors.push('Title must be less than 200 characters');
      }
    }

    if (body.author !== undefined) {
      if (typeof body.author !== 'string' || body.author.trim().length === 0) {
        validationErrors.push('Author cannot be empty');
      } else if (body.author.length > 100) {
        validationErrors.push('Author must be less than 100 characters');
      }
    }

    if (body.publishedYear !== undefined && !validateYear(body.publishedYear)) {
      validationErrors.push(`Published year must be between 1000 and ${new Date().getFullYear()}`);
    }

    if (body.copiesAvailable !== undefined && body.copiesAvailable < 0) {
      validationErrors.push('Number of copies must be non-negative');
    }

    if (validationErrors.length > 0) {
      throw error(400, { message: validationErrors.join('; ') });
    }

    // Build update object (only schema fields)
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.author !== undefined) updateData.author = body.author.trim();
    if (body.publishedYear !== undefined) updateData.publishedYear = body.publishedYear;
    if (body.copiesAvailable !== undefined) updateData.copiesAvailable = body.copiesAvailable;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.bookId !== undefined) updateData.bookId = body.bookId.trim();
    if (body.language !== undefined) updateData.language = body.language ? body.language.trim() : null;
    if (body.originPlace !== undefined) updateData.originPlace = body.originPlace ? body.originPlace.trim() : null;
    if (body.publisher !== undefined) updateData.publisher = body.publisher ? body.publisher.trim() : null;
    if (body.location !== undefined) updateData.location = body.location ? body.location.trim() : null;
    if (body.description !== undefined) updateData.description = body.description ? body.description.trim() : null;

    updateData.updatedAt = new Date();

    const [updatedBook] = await db
      .update(book)
      .set(updateData)
      .where(eq(book.id, parseInt(bookId)))
      .returning({
        id: book.id,
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        language: book.language,
        originPlace: book.originPlace,
        publishedYear: book.publishedYear,
        copiesAvailable: book.copiesAvailable,
        categoryId: book.categoryId,
        publisher: book.publisher,
        location: book.location,
        description: book.description
      });

    // Get category name for response
    const [cat] = await db
      .select({ name: category.name })
      .from(category)
      .where(eq(category.id, updatedBook.categoryId))
      .limit(1);

    return json({
      success: true,
      data: { 
        book: { ...updatedBook, category: cat?.name },
        message: `Book "${updatedBook.title}" has been successfully updated.`
      },
      message: 'Book updated successfully'
    });

  } catch (err) {
    console.error('Error updating book:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, { message: 'Internal server error while updating book' });
  }
};

// DELETE - Delete book
export const DELETE: RequestHandler = async ({ request, url }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    // Only admins can delete books
    if (user.role !== 'admin') {
      throw error(403, { message: 'Only administrators can delete books' });
    }

    const bookId = url.searchParams.get('id');
    if (!bookId || isNaN(parseInt(bookId))) {
      throw error(400, { message: 'Valid book ID is required' });
    }

    // Check if book exists
    const existingBook = await db
      .select({ id: book.id, title: book.title })
      .from(book)
      .where(eq(book.id, parseInt(bookId)))
      .limit(1);

    if (existingBook.length === 0) {
      throw error(404, { message: 'Book not found' });
    }

    // Prevent deletion if book is currently borrowed
    const issuedCount = await db
      .select({ count: count() })
      .from(bookBorrowing)
      .where(and(
        eq(bookBorrowing.bookId, parseInt(bookId)),
        eq(bookBorrowing.status, 'borrowed')
      ));
    
    if (issuedCount[0]?.count > 0) {
      throw error(400, { message: 'Cannot delete book: It is currently borrowed.' });
    }

    await db
      .delete(book)
      .where(eq(book.id, parseInt(bookId)));

    // Log the action
    console.log(`Book deleted by ${user.username} (ID: ${user.id}):`, {
      bookId: parseInt(bookId),
      title: existingBook[0].title,
      timestamp: new Date().toISOString()
    });

    return json({
      success: true,
      message: `Book "${existingBook[0].title}" has been successfully deleted from the library.`
    });

  } catch (err) {
    console.error('Error deleting book:', err instanceof Error ? err.message : err);
    if ((err as any).status) {
      throw err;
    }
    throw error(500, { message: 'Internal server error while deleting book' });
  }
};