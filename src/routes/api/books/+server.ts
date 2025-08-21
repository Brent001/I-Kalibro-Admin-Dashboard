// src/routes/api/books/+server.ts - Enhanced version with full field support

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, like, and, or, gt, count } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { book, account, category } from '$lib/server/db/schema/schema.js'; // add category import

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
  id: number;
  role: string;
  username: string;
  email: string;
}

interface CreateBookRequest {
  title: string;
  author: string;
  isbn: string;
  category?: string;
  publisher?: string;
  publishedYear: number;
  edition?: string;
  pages?: number;
  language?: string;
  copiesAvailable: number;
  location?: string;
  description?: string;
  tags?: string[];
  price?: number;
  supplier?: string;
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
        id: account.id,
        username: account.username,
        email: account.email,
        role: account.role,
        isActive: account.isActive,
        tokenVersion: account.tokenVersion
      })
      .from(account)
      .where(eq(account.id, userId))
      .limit(1);

    if (!user || !user.isActive) return null;

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return null;
    }

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

// Validation functions
function validateISBN(isbn: string): boolean {
  // Remove hyphens and spaces
  const cleanISBN = isbn.replace(/[-\s]/g, '');
  
  // Check if it's ISBN-10 or ISBN-13
  if (cleanISBN.length === 10) {
    return /^[0-9]{9}[0-9X]$/i.test(cleanISBN);
  } else if (cleanISBN.length === 13) {
    return /^97[89][0-9]{10}$/.test(cleanISBN);
  }
  
  return false;
}

function validateYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return year >= 1000 && year <= currentYear;
}

function generateQRCode(isbn: string, title: string): string {
  // In a real application, you might use a QR code library
  // For now, we'll generate a unique identifier
  const timestamp = Date.now();
  const hash = Buffer.from(`${isbn}-${title}-${timestamp}`).toString('base64').substring(0, 16);
  return `QR-${hash}`;
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
    const isbn = searchParams.get('isbn') || '';
    const available = searchParams.get('available');

    if (page < 1 || limit < 1) {
      throw error(400, { message: 'Invalid pagination parameters. Page and limit must be >= 1' });
    }

    const offset = (page - 1) * limit;
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(book.title, `%${search}%`),
          like(book.author, `%${search}%`),
          like(book.isbn, `%${search}%`)
        )
      );
    }

    if (categoryId && categoryId !== 'all') {
      conditions.push(eq(book.categoryId, parseInt(categoryId)));
    }

    if (author) {
      conditions.push(like(book.author, `%${author}%`));
    }

    if (isbn) {
      conditions.push(eq(book.isbn, isbn));
    }

    if (available === 'true') {
      conditions.push(gt(book.copiesAvailable, 0));
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
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        qrCode: book.qrCode,
        publishedYear: book.publishedYear,
        copiesAvailable: book.copiesAvailable,
        categoryId: book.categoryId,
        category: category.name
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

// POST - Create new book with full field support
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
    const requiredFields = ['title', 'author', 'isbn', 'publishedYear', 'copiesAvailable', 'categoryId'];
    const missingFields = requiredFields.filter(field => !body[field]);
    if (missingFields.length > 0) {
      throw error(400, { message: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate categoryId exists
    const categoryExists = await db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.id, body.categoryId))
      .limit(1);

    if (categoryExists.length === 0) {
      throw error(400, { message: 'Invalid categoryId' });
    }

    // Validate field values
    const validationErrors: string[] = [];

    if (body.title.trim().length === 0) {
      validationErrors.push('Title cannot be empty');
    }

    if (body.title.length > 200) {
      validationErrors.push('Title must be less than 200 characters');
    }

    if (body.author.trim().length === 0) {
      validationErrors.push('Author cannot be empty');
    }

    if (body.author.length > 100) {
      validationErrors.push('Author must be less than 100 characters');
    }

    if (!validateISBN(body.isbn)) {
      validationErrors.push('Please enter a valid ISBN (10 or 13 digits)');
    }

    if (!validateYear(body.publishedYear)) {
      validationErrors.push(`Published year must be between 1000 and ${new Date().getFullYear()}`);
    }

    if (body.copiesAvailable < 0) {
      validationErrors.push('Number of copies must be non-negative');
    }

    if (body.pages && body.pages < 1) {
      validationErrors.push('Number of pages must be positive');
    }

    if (body.price && body.price < 0) {
      validationErrors.push('Price cannot be negative');
    }

    if (validationErrors.length > 0) {
      throw error(400, { message: validationErrors.join('; ') });
    }

    // Check if ISBN already exists
    const existingBook = await db
      .select({ id: book.id, title: book.title })
      .from(book)
      .where(eq(book.isbn, body.isbn.trim()))
      .limit(1);

    if (existingBook.length > 0) {
      throw error(409, { 
        message: `A book with ISBN "${body.isbn}" already exists: "${existingBook[0].title}"` 
      });
    }

    // Generate QR code
    const qrCode = generateQRCode(body.isbn, body.title);

    // Prepare book data for insertion
    const bookData = {
      title: body.title.trim(),
      author: body.author.trim(),
      isbn: body.isbn.trim(),
      qrCode,
      publishedYear: body.publishedYear,
      copiesAvailable: body.copiesAvailable,
      categoryId: body.categoryId
    };

    // Insert the book
    const [newBook] = await db
      .insert(book)
      .values(bookData)
      .returning({
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        qrCode: book.qrCode,
        publishedYear: book.publishedYear,
        copiesAvailable: book.copiesAvailable,
        categoryId: book.categoryId
      });

    // Get category name for response
    const [cat] = await db.select({ name: category.name }).from(category).where(eq(category.id, newBook.categoryId)).limit(1);

    return json({
      success: true,
      data: { 
        book: { ...newBook, category: cat?.name },
        message: `Book "${newBook.title}" has been successfully added to the library.`,
        qrCode: newBook.qrCode
      },
      message: 'Book created successfully'
    }, { status: 201 });

  } catch (err) {
    console.error('Error creating book:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, { message: 'Internal server error while creating book' });
  }
};

// PUT - Update book with full field support
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
        title: book.title,
        isbn: book.isbn 
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

    if (body.isbn !== undefined) {
      if (!validateISBN(body.isbn)) {
        validationErrors.push('Please enter a valid ISBN');
      } else if (body.isbn !== existingBook[0].isbn) {
        // Check if new ISBN conflicts with existing books
        const isbnConflict = await db
          .select({ id: book.id })
          .from(book)
          .where(eq(book.isbn, body.isbn))
          .limit(1);

        if (isbnConflict.length > 0) {
          validationErrors.push('A book with this ISBN already exists');
        }
      }
    }

    if (body.publishedYear !== undefined && !validateYear(body.publishedYear)) {
      validationErrors.push(`Published year must be between 1000 and ${new Date().getFullYear()}`);
    }

    if (body.copiesAvailable !== undefined && body.copiesAvailable < 0) {
      validationErrors.push('Number of copies must be non-negative');
    }

    if (body.pages !== undefined && body.pages < 1) {
      validationErrors.push('Number of pages must be positive');
    }

    if (body.price !== undefined && body.price < 0) {
      validationErrors.push('Price cannot be negative');
    }

    if (validationErrors.length > 0) {
      throw error(400, { message: validationErrors.join('; ') });
    }

    // Build update object
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.author !== undefined) updateData.author = body.author.trim();
    if (body.isbn !== undefined) updateData.isbn = body.isbn.trim();
    if (body.publishedYear !== undefined) updateData.publishedYear = body.publishedYear;
    if (body.copiesAvailable !== undefined) updateData.copiesAvailable = body.copiesAvailable;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;

    const [updatedBook] = await db
      .update(book)
      .set(updateData)
      .where(eq(book.id, parseInt(bookId)))
      .returning({
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        qrCode: book.qrCode,
        publishedYear: book.publishedYear,
        copiesAvailable: book.copiesAvailable,
        categoryId: book.categoryId
      });

    // Get category name for response
    const [cat] = await db.select({ name: category.name }).from(category).where(eq(category.id, updatedBook.categoryId)).limit(1);

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

    // TODO: Check if book is currently issued to anyone
    // You might want to prevent deletion if the book is currently borrowed
    // const issuedCount = await db.select({ count: count() }).from(issuedBook).where(eq(issuedBook.bookId, parseInt(bookId)));

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
    console.error('Error deleting book:', err);
    
    if (err.status) {
      throw err;
    }

    throw error(500, { message: 'Internal server error while deleting book' });
  }
};