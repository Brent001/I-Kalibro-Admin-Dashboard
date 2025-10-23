import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { bookBorrowing, bookReturn, book, staffAccount, qrCodeToken } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Extract token from request
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookies = request.headers.get('Cookie');
  if (cookies) {
    const tokenMatch = cookies.match(/token=([^;]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
  }

  return null;
}

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    // Get token from cookies or Authorization header
    const token = cookies.get('token') || extractToken(request);
    
    if (!token) {
      throw error(401, { message: 'Not authenticated. Please log in.' });
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw error(401, { message: 'Invalid or expired token. Please log in again.' });
    }

    const staffId = decoded.userId || decoded.id;
    if (!staffId) {
      throw error(401, { message: 'Invalid token payload.' });
    }

    // Get staff account from database
    const staffDb = await db
      .select()
      .from(staffAccount)
      .where(eq(staffAccount.id, staffId))
      .limit(1);

    if (!staffDb.length || !staffDb[0].isActive) {
      throw error(401, { message: 'Staff account not found or inactive.' });
    }

    const staff = staffDb[0];

    // Parse request body
    const borrowingId = parseInt(params.id);
    if (isNaN(borrowingId)) {
      throw error(400, { message: 'Invalid borrowing ID' });
    }

    const { method, password, qrData } = await request.json();

    // Verify staff credentials based on method
    if (method === "password") {
      if (!password || !password.trim()) {
        throw error(400, { message: "Password is required." });
      }
      
      const valid = await bcrypt.compare(password, staff.password);
      if (!valid) {
        throw error(401, { message: "Invalid staff password." });
      }
    } else if (method === "qrcode") {
      if (!qrData) {
        throw error(400, { message: "QR code data required." });
      }
      
      const qr = await db
        .select()
        .from(qrCodeToken)
        .where(eq(qrCodeToken.token, qrData))
        .limit(1);
      
      if (!qr.length || qr[0].type !== "book_qr") {
        throw error(401, { message: "Invalid or unauthorized QR code." });
      }
    } else {
      throw error(400, { message: "Invalid verification method." });
    }

    // Get borrowing record
    const borrowing = await db
      .select()
      .from(bookBorrowing)
      .where(eq(bookBorrowing.id, borrowingId))
      .limit(1);

    if (!borrowing.length) {
      throw error(404, { message: 'Borrowing record not found' });
    }

    const b = borrowing[0];

    // Check if already returned
    if (b.status === 'returned') {
      throw error(400, { message: 'Book has already been returned.' });
    }

    // Insert into bookReturn
    await db.insert(bookReturn).values({
      borrowingId: b.id,
      userId: b.userId,
      bookId: b.bookId,
      returnDate: new Date().toISOString().split('T')[0], // Date only
      finePaid: b.fine ?? 0,
      remarks: `Returned via ${method === "password" ? "staff password" : "book QR"} by ${staff.username}`
    });

    // Update status in bookBorrowing
    await db
      .update(bookBorrowing)
      .set({ 
        status: 'returned', 
        returnDate: new Date().toISOString().split('T')[0] // Date only
      })
      .where(eq(bookBorrowing.id, borrowingId));

    // Increment book availability
    const bookRecord = await db
      .select()
      .from(book)
      .where(eq(book.id, b.bookId))
      .limit(1);

    if (bookRecord.length) {
      await db
        .update(book)
        .set({ copiesAvailable: (bookRecord[0].copiesAvailable ?? 0) + 1 })
        .where(eq(book.id, b.bookId));
    }

    return json({ 
      success: true, 
      message: 'Book returned successfully.',
      data: {
        borrowingId: b.id,
        returnDate: new Date().toISOString(),
        staffUsername: staff.username
      }
    });
  } catch (err: any) {
    console.error('Return error:', err);
    
    // Handle specific error types
    if (err.status) {
      throw err;
    }
    
    throw error(500, { message: err.message || 'Failed to process return.' });
  }
};