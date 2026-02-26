import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import {
  tbl_book_borrowing,
  tbl_magazine_borrowing,
  tbl_thesis_borrowing,
  
  tbl_return,
  tbl_book,
  tbl_magazine,
  tbl_thesis,
  tbl_fine,
  
  tbl_book_copy,
  tbl_magazine_copy,
  tbl_thesis_copy,
  
  tbl_staff,
  tbl_admin,
  tbl_super_admin
} from '$lib/server/db/schema/schema.js';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { calculateFineAmount, calculateDaysOverdue } from '$lib/server/utils/fineCalculation.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const FINE_PER_HOUR = 5; // 5 pesos per hour overdue

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

// We'll use the shared fine calculation utilities which respect exemption settings.

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

    // Verify JWT token and resolve actor (staff/admin/super_admin)
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw error(401, { message: 'Invalid or expired token. Please log in again.' });
    }

    const actorId = decoded.userId || decoded.id;
    if (!actorId) {
      throw error(401, { message: 'Invalid token payload.' });
    }

    // Resolve actor across staff, admin, super_admin
    let actor: any = null;
    let actorType: 'staff' | 'admin' | 'super_admin' | null = null;

    const [staffRec] = await db.select().from(tbl_staff).where(eq(tbl_staff.id, actorId)).limit(1);
    if (staffRec) {
      actor = staffRec;
      actorType = 'staff';
    } else {
      const [adminRec] = await db.select().from(tbl_admin).where(eq(tbl_admin.id, actorId)).limit(1);
      if (adminRec) {
        actor = adminRec;
        actorType = 'admin';
      } else {
        const [superRec] = await db.select().from(tbl_super_admin).where(eq(tbl_super_admin.id, actorId)).limit(1);
        if (superRec) {
          actor = superRec;
          actorType = 'super_admin';
        }
      }
    }

    if (!actor) {
      throw error(401, { message: 'Actor account not found or inactive.' });
    }

    // Parse request body
    const borrowingId = parseInt(params.id);
    if (isNaN(borrowingId)) {
      throw error(400, { message: 'Invalid borrowing ID' });
    }

    const { password } = await request.json();

    // Verify actor credentials: staff must provide password; admin/super_admin may use token-only
    if (actorType === 'staff') {
      if (!password || !password.trim()) {
        throw error(400, { message: 'Password is required.' });
      }
      const valid = await bcrypt.compare(password, actor.password);
      if (!valid) throw error(401, { message: 'Invalid staff password.' });
    } else {
      // admin or super_admin: allow token-based auth; if password provided, verify it against their password
      if (password && password.trim()) {
        const valid = await bcrypt.compare(password, actor.password);
        if (!valid) throw error(401, { message: 'Invalid password.' });
      }
    }

    // Try to find borrowing across item types
    const [bBook] = await db.select().from(tbl_book_borrowing).where(eq(tbl_book_borrowing.id, borrowingId)).limit(1);
    const [bMag] = await db.select().from(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.id, borrowingId)).limit(1);
    const [bThesis] = await db.select().from(tbl_thesis_borrowing).where(eq(tbl_thesis_borrowing.id, borrowingId)).limit(1);
    const [bJournal] = [null];

    let b: any = null;
    let itemType = '';
    let copyId: number | null = null;
    // will hold call number fetched from copy table
    let returnedCallNumber: string | null = null;

    if (bBook) {
      b = bBook;
      itemType = 'book';
      copyId = b.bookCopyId;
    } else if (bMag) {
      b = bMag;
      itemType = 'magazine';
      copyId = b.magazineCopyId;
    } else if (bThesis) {
      b = bThesis;
      itemType = 'thesis';
      copyId = b.thesisCopyId;
    } else {
      throw error(404, { message: 'Borrowing record not found' });
    }

    if (!b) throw error(404, { message: 'Borrowing record not found' });

    if (b.status === 'returned') throw error(400, { message: 'Item has already been returned.' });
    // Accept both 'borrowed' and 'overdue' as valid statuses for return
    if (b.status !== 'borrowed' && b.status !== 'overdue') throw error(400, { message: 'Invalid borrowing status. Only borrowed or overdue items can be returned.' });

    // calculate fine (in pesos) and days overdue using shared utils
    const fineCent = await calculateFineAmount(new Date(b.dueDate));
    const calculatedFine = Number((Number(fineCent) / 100).toFixed(2));
    const daysOverdue = await calculateDaysOverdue(new Date(b.dueDate));
    const returnDate = new Date();
    const hoursOverdue = calculatedFine > 0 ? Math.ceil(calculatedFine / FINE_PER_HOUR) : 0;

    const returnInsert = await db.insert(tbl_return).values({
      userId: b.userId,
      itemType: itemType,
      borrowingId: b.id,
      copyId: (copyId ?? 0) as number,
      returnDate: returnDate,
      remarks: `Returned by ${actor.username ?? actor.name}${calculatedFine > 0 ? `. Fine: ₱${calculatedFine.toFixed(2)} (hours: ${hoursOverdue})` : ''}`,
      processedBy: actorType === 'staff' ? actor.id : null
    });

    // Persist fine record if applicable
    let fineRecord: any = null;
    if (calculatedFine > 0) {
      try {
        const [r] = await db.insert(tbl_fine).values({
          userId: b.userId,
          itemType: itemType,
          borrowingId: b.id,
          fineAmount: String(calculatedFine.toFixed(2)),
          daysOverdue: daysOverdue
        }).returning();
        fineRecord = r;
      } catch (e) {
        console.debug('Failed to persist fine record:', e);
      }
    }
    // Update borrowing and copy status depending on itemType
    if (itemType === 'book') {
      await db.update(tbl_book_borrowing).set({ status: 'returned', returnDate }).where(eq(tbl_book_borrowing.id, borrowingId));
      if (copyId) {
        // fetch call number before updating status (not mutated by update)
        const [copyRec] = await db.select({ callNumber: tbl_book_copy.callNumber })
          .from(tbl_book_copy)
          .where(eq(tbl_book_copy.id, copyId))
          .limit(1);
        returnedCallNumber = copyRec?.callNumber || null;

        await db.update(tbl_book_copy).set({ status: 'available' }).where(eq(tbl_book_copy.id, copyId));
      }

      // Increment availableCopies on parent book
      try {
        const parentBookId = b.bookId || null;
        if (parentBookId) {
          await db.update(tbl_book).set({ availableCopies: sql`COALESCE(${tbl_book.availableCopies}, 0) + 1` }).where(eq(tbl_book.id, parentBookId));
        }
      } catch (e) {
        console.debug('Failed to increment book.availableCopies on return:', e);
      }
    } else if (itemType === 'magazine') {
      await db.update(tbl_magazine_borrowing).set({ status: 'returned', returnDate }).where(eq(tbl_magazine_borrowing.id, borrowingId));
      if (copyId) {
        const [copyRec] = await db.select({ callNumber: tbl_magazine_copy.callNumber })
          .from(tbl_magazine_copy)
          .where(eq(tbl_magazine_copy.id, copyId))
          .limit(1);
        returnedCallNumber = copyRec?.callNumber || null;

        await db.update(tbl_magazine_copy).set({ status: 'available' }).where(eq(tbl_magazine_copy.id, copyId));
      }
    } else if (itemType === 'thesis') {
      await db.update(tbl_thesis_borrowing).set({ status: 'returned', returnDate }).where(eq(tbl_thesis_borrowing.id, borrowingId));
      if (copyId) {
        await db.update(tbl_thesis_copy).set({ status: 'available' }).where(eq(tbl_thesis_copy.id, copyId));
        // fetch call number
        const [copyRec] = await db.select({ callNumber: tbl_thesis_copy.callNumber }).from(tbl_thesis_copy).where(eq(tbl_thesis_copy.id, copyId)).limit(1);
        returnedCallNumber = copyRec?.callNumber || null;
      }
    }

    return json({
      success: true,
      message: calculatedFine > 0 ? `Item returned successfully. Fine of ₱${calculatedFine.toFixed(2)} recorded.` : 'Item returned successfully.',
      data: {
        borrowingId: b.id,
        returnDate: returnDate.toISOString(),
        staffUsername: actor.username ?? actor.name,
        fine: calculatedFine,
        daysOverdue: daysOverdue,
        hoursOverdue,
        isOverdue: calculatedFine > 0,
        itemType,
        callNumber: returnedCallNumber
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