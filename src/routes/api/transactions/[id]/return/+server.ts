import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_book_borrowing, tbl_return, tbl_book, tbl_staff } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const FINE_PER_DAY = 10; // 10 pesos per day overdue

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

// Calculate fine based on overdue days
function calculateFine(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  
  // Calculate difference in milliseconds
  const diffMs = now.getTime() - due.getTime();
  
  if (diffMs <= 0) {
    return 0; // Not overdue
  }
  
  // Convert to days (rounded up)
  const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  // Calculate fine (10 pesos per day)
  return overdueDays * FINE_PER_DAY;
}

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    // Get token from cookies or Authorization header
    const token = cookies.get('token') || extractToken(request);
    
    if (!token) {
      throw error(401, { message: 'Not authenticated. Please log in.' });
    }

    // Check if session has been revoked
    if (await isSessionRevoked(token)) {
      throw error(401, { message: 'Your session has been revoked. Please log in again.' });
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
      .from(tbl_staff)
      .where(eq(tbl_staff.id, staffId))
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

    const { password } = await request.json();

    // Verify staff credentials
    if (!password || !password.trim()) {
      throw error(400, { message: "Password is required." });
    }
    
    const valid = await bcrypt.compare(password, staff.password);
    if (!valid) {
      throw error(401, { message: "Invalid staff password." });
    }

    // Get borrowing record
    const borrowing = await db
      .select()
      .from(tbl_book_borrowing)
      .where(eq(tbl_book_borrowing.id, borrowingId))
      .limit(1);

    if (!borrowing.length) {
      throw error(404, { message: 'Borrowing record not found' });
    }

    const b = borrowing[0];

    // Check if already returned
    if (b.status === 'returned') {
      throw error(400, { message: 'Book has already been returned.' });
    }

    // Allow return for 'borrowed' status
    if (b.status !== 'borrowed') {
      throw error(400, { message: 'Invalid borrowing status. Only borrowed books can be returned.' });
    }

    // Calculate fine server-side
    const calculatedFine = calculateFine(b.dueDate.toString());
    
    const returnDate = new Date();

    // Insert into tbl_return with fine information
    await db.insert(tbl_return).values({
      userId: b.userId,
      itemType: 'book',
      borrowingId: b.id,
      copyId: b.bookCopyId,
      returnDate: returnDate,
      condition: 'good',
      remarks: `Returned by ${staff.username}${calculatedFine > 0 ? `. Fine: ₱${calculatedFine.toFixed(2)}` : ''}`,
      processedBy: staff.id
    });

    // Update borrowing status and mark as returned
    await db
      .update(tbl_book_borrowing)
      .set({ 
        status: 'returned', 
        returnDate: returnDate.toISOString().split('T')[0]
      })
      .where(eq(tbl_book_borrowing.id, borrowingId));

    return json({ 
      success: true, 
      message: calculatedFine > 0 
        ? `Book returned successfully. Fine of ₱${calculatedFine.toFixed(2)} recorded.` 
        : 'Book returned successfully.',
      data: {
        borrowingId: b.id,
        returnDate: returnDate.toISOString(),
        staffUsername: staff.username,
        fine: calculatedFine,
        isOverdue: calculatedFine > 0
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