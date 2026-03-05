import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import {
  tbl_book_borrowing,
  tbl_magazine_borrowing,
  tbl_thesis_borrowing,
  tbl_journal_borrowing,
  tbl_book_reservation,
  tbl_magazine_reservation,
  tbl_thesis_reservation,
  tbl_journal_reservation,
  tbl_book_copy,
  tbl_magazine_copy,
  tbl_thesis_copy,
  tbl_journal_copy,
  tbl_book,
  tbl_magazine,
  tbl_thesis,
  tbl_journal,
  
  tbl_super_admin,
  tbl_admin,
  tbl_staff,
  tbl_security_log
} from '$lib/server/db/schema/schema.js';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';

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

  const approverId = decoded.userId || decoded.id;
  // Token may carry role under `role` or `userType` depending on issuer.
  const approverRole = decoded.role || decoded.userType || 'staff';
  if (!approverId) {
    throw error(401, { message: 'Invalid token payload.' });
  }

  // Lookup approver record depending on role (staff, admin, super_admin)
  let approver: any = null;
  if (approverRole === 'super_admin') {
    const rows = await db.select().from(tbl_super_admin).where(eq(tbl_super_admin.id, approverId)).limit(1);
    if (!rows.length || !rows[0].isActive) throw error(401, { message: 'Super admin account not found or inactive.' });
    approver = rows[0];
  } else if (approverRole === 'admin') {
    const rows = await db.select().from(tbl_admin).where(eq(tbl_admin.id, approverId)).limit(1);
    if (!rows.length || !rows[0].isActive) throw error(401, { message: 'Admin account not found or inactive.' });
    approver = rows[0];
  } else {
    const rows = await db.select().from(tbl_staff).where(eq(tbl_staff.id, approverId)).limit(1);
    if (!rows.length || !rows[0].isActive) throw error(401, { message: 'Staff account not found or inactive.' });
    approver = rows[0];
  }

  // Parse request body
  let customDueDate: string | undefined;
  let method: string | undefined;
  let password: string | undefined;
  try {
    const body = await request.json();
    customDueDate = body.dueDate;
    method = body.method;
    password = body.password;
  } catch {
    throw error(400, { message: 'Invalid request body.' });
  }

  // Verify approval method:
  // - method === 'password' => require password, compare against approver.password
  // - method === 'admin' => allowed only for admin/super_admin roles (no password)
  if (method === 'password') {
    if (!password || !password.trim()) throw error(400, { message: 'Password verification required.' });
    const valid = await bcrypt.compare(password, approver.password);
    if (!valid) throw error(401, { message: 'Invalid password.' });
  } else if (method === 'admin') {
    if (!(approverRole === 'admin' || approverRole === 'super_admin')) {
      throw error(403, { message: 'Admin method not permitted for this account.' });
    }
    // allowed: admin/super_admin can approve using token
  } else {
    throw error(400, { message: 'Invalid approval method.' });
  }

  // ID can be a reservation request id. Try to find a matching request across item types.
  const reqId = Number(params.id);
  if (!reqId) throw error(400, { message: 'Invalid request ID' });

  // Try book request
  const [bookReq] = await db.select().from(tbl_book_reservation).where(eq(tbl_book_reservation.id, reqId)).limit(1);
  const [magReq] = await db.select().from(tbl_magazine_reservation).where(eq(tbl_magazine_reservation.id, reqId)).limit(1);
  const [thesisReq] = await db.select().from(tbl_thesis_reservation).where(eq(tbl_thesis_reservation.id, reqId)).limit(1);
  const [journalReq] = await db.select().from(tbl_journal_reservation).where(eq(tbl_journal_reservation.id, reqId)).limit(1);

  const today = new Date();
  let dueDate: Date;
  if (customDueDate) {
    dueDate = new Date(customDueDate);
  } else {
    dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 14); // Default 14 days
    dueDate.setHours(8, 0, 0, 0);
  }

  // Helper to allocate first available copy
  async function allocateCopy(copyTable: any) {
    const available = await db.select().from(copyTable).where(eq(copyTable.status, 'available')).limit(1);
    if (!available.length) return null;
    const c = available[0];
    await db.update(copyTable).set({ status: 'borrowed' }).where(eq(copyTable.id, c.id));
    return c.id;
  }

  if (bookReq && (bookReq.status === 'active' || bookReq.status === 'borrow_request')) {
    const copyId = await allocateCopy(tbl_book_copy);
    if (!copyId) throw error(400, { message: 'No available book copies to allocate' });

    // save timestamp (include time component)
    const borrowDateStr = bookReq.requestedBorrowDate || today.toISOString();
    const dueDateStr = dueDate.toISOString();

    const [inserted] = await db.insert(tbl_book_borrowing).values({
      userId: bookReq.userId,
      bookId: bookReq.bookId,
      bookCopyId: copyId,
      borrowDate: new Date(borrowDateStr),
      dueDate: new Date(dueDateStr),
      status: 'borrowed',
      // approvedBy references tbl_staff; when approver is not a staff member
      // (admin / super_admin) leave approvedBy null and record an audit log instead.
      approvedBy: approverRole === 'staff' ? approverId : null
    }).returning();

    await db.update(tbl_book_reservation).set({ status: 'fulfilled', reviewedBy: approverRole === 'staff' ? approverId : null }).where(eq(tbl_book_reservation.id, reqId));

    // Decrement available copies on the parent book
    try {
      await db.update(tbl_book).set({ availableCopies: sql`GREATEST(${tbl_book.availableCopies} - 1, 0)` }).where(eq(tbl_book.id, bookReq.bookId));
    } catch (e) {
      console.debug('Failed to decrement book.availableCopies:', e);
    }

    // If approver is admin/super_admin, insert a security log for auditing
    if (approverRole === 'admin' || approverRole === 'super_admin') {
      await db.insert(tbl_security_log).values({
        userId: approverId,
        userType: approverRole,
        eventType: 'transaction_approved',
        ipAddress: null,
        userAgent: null,
        timestamp: new Date()
      });
    }

    return json({ success: true, data: inserted });
  }

  if (magReq && (magReq.status === 'active' || magReq.status === 'borrow_request')) {
    const copyId = await allocateCopy(tbl_magazine_copy);
    if (!copyId) throw error(400, { message: 'No available magazine copies to allocate' });

    const borrowDateStr = magReq.requestedBorrowDate || today.toISOString();
    const dueDateStr = dueDate.toISOString();

    const [inserted] = await db.insert(tbl_magazine_borrowing).values({
      userId: magReq.userId,
      magazineId: magReq.magazineId,
      magazineCopyId: copyId,
      borrowDate: new Date(borrowDateStr),
      dueDate: new Date(dueDateStr),
      status: 'borrowed',
      approvedBy: approverRole === 'staff' ? approverId : null
    }).returning();

    await db.update(tbl_magazine_reservation).set({ status: 'fulfilled', reviewedBy: approverRole === 'staff' ? approverId : null }).where(eq(tbl_magazine_reservation.id, reqId));

    // Decrement available copies on the parent magazine
    try {
      await db.update(tbl_magazine).set({ availableCopies: sql`GREATEST(${tbl_magazine.availableCopies} - 1, 0)` }).where(eq(tbl_magazine.id, magReq.magazineId));
    } catch (e) {
      console.debug('Failed to decrement magazine.availableCopies:', e);
    }

    if (approverRole === 'admin' || approverRole === 'super_admin') {
      await db.insert(tbl_security_log).values({
        userId: approverId,
        userType: approverRole,
        eventType: 'transaction_approved',
        ipAddress: null,
        userAgent: null,
        timestamp: new Date()
      });
    }

    return json({ success: true, data: inserted });
  }

  if (thesisReq && (thesisReq.status === 'active' || thesisReq.status === 'borrow_request')) {
    const copyId = await allocateCopy(tbl_thesis_copy);
    if (!copyId) throw error(400, { message: 'No available thesis copies to allocate' });

    const borrowDateStr = thesisReq.requestedBorrowDate || today.toISOString();
    const dueDateStr = dueDate.toISOString();

    const [inserted] = await db.insert(tbl_thesis_borrowing).values({
      userId: thesisReq.userId,
      thesisId: thesisReq.thesisId,
      thesisCopyId: copyId,
      borrowDate: new Date(borrowDateStr),
      dueDate: new Date(dueDateStr),
      status: 'borrowed',
      approvedBy: approverRole === 'staff' ? approverId : null
    }).returning();

    await db.update(tbl_thesis_reservation).set({ status: 'fulfilled', reviewedBy: approverRole === 'staff' ? approverId : null }).where(eq(tbl_thesis_reservation.id, reqId));

    // Decrement available copies on the parent thesis
    try {
      await db.update(tbl_thesis).set({ availableCopies: sql`GREATEST(${tbl_thesis.availableCopies} - 1, 0)` }).where(eq(tbl_thesis.id, thesisReq.thesisId));
    } catch (e) {
      console.debug('Failed to decrement thesis.availableCopies:', e);
    }

    if (approverRole === 'admin' || approverRole === 'super_admin') {
      await db.insert(tbl_security_log).values({
        userId: approverId,
        userType: approverRole,
        eventType: 'transaction_approved',
        ipAddress: null,
        userAgent: null,
        timestamp: new Date()
      });
    }

    return json({ success: true, data: inserted });
  }

  // Handle journal reservations the same way
  if (journalReq && (journalReq.status === 'active' || journalReq.status === 'borrow_request')) {
    const copyId = await allocateCopy(tbl_journal_copy);
    if (!copyId) throw error(400, { message: 'No available journal copies to allocate' });

    const borrowDateStr = journalReq.requestedBorrowDate || today.toISOString();
    const dueDateStr = dueDate.toISOString();

    const [inserted] = await db.insert(tbl_journal_borrowing).values({
      userId: journalReq.userId,
      journalId: journalReq.journalId,
      journalCopyId: copyId,
      borrowDate: new Date(borrowDateStr),
      dueDate: new Date(dueDateStr),
      status: 'borrowed',
      approvedBy: approverRole === 'staff' ? approverId : null
    }).returning();

    await db.update(tbl_journal_reservation).set({ status: 'fulfilled', reviewedBy: approverRole === 'staff' ? approverId : null }).where(eq(tbl_journal_reservation.id, reqId));

    // Decrement available copies on the parent journal
    try {
      await db.update(tbl_journal).set({ availableCopies: sql`GREATEST(${tbl_journal.availableCopies} - 1, 0)` }).where(eq(tbl_journal.id, journalReq.journalId));
    } catch (e) {
      console.debug('Failed to decrement journal.availableCopies:', e);
    }

    if (approverRole === 'admin' || approverRole === 'super_admin') {
      await db.insert(tbl_security_log).values({
        userId: approverId,
        userType: approverRole,
        eventType: 'transaction_approved',
        ipAddress: null,
        userAgent: null,
        timestamp: new Date()
      });
    }

    return json({ success: true, data: inserted });
  }

  // If not a reservation, try to find a pending borrowing (legacy flow)
  // check each borrowing table in turn so journals/magazines are covered
  let pending: any = null;
  let pendingType: 'book' | 'magazine' | 'thesis' | 'journal' | null = null;

  const [pBook] = await db.select().from(tbl_book_borrowing).where(eq(tbl_book_borrowing.id, reqId)).limit(1);
  if (pBook && pBook.status === 'pending') {
    pending = pBook;
    pendingType = 'book';
  }

  if (!pending) {
    const [pMag] = await db.select().from(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.id, reqId)).limit(1);
    if (pMag && pMag.status === 'pending') {
      pending = pMag;
      pendingType = 'magazine';
    }
  }

  if (!pending) {
    const [pThesis] = await db.select().from(tbl_thesis_borrowing).where(eq(tbl_thesis_borrowing.id, reqId)).limit(1);
    if (pThesis && pThesis.status === 'pending') {
      pending = pThesis;
      pendingType = 'thesis';
    }
  }

  if (!pending) {
    const [pJournal] = await db.select().from(tbl_journal_borrowing).where(eq(tbl_journal_borrowing.id, reqId)).limit(1);
    if (pJournal && pJournal.status === 'pending') {
      pending = pJournal;
      pendingType = 'journal';
    }
  }

  if (pending) {
    const dueDateStr = dueDate.toISOString();
    await db.update(
      pendingType === 'book' ? tbl_book_borrowing :
      pendingType === 'magazine' ? tbl_magazine_borrowing :
      pendingType === 'thesis' ? tbl_thesis_borrowing :
      tbl_journal_borrowing
    ).set({ dueDate: new Date(dueDateStr), status: 'borrowed', approvedBy: approverRole === 'staff' ? approverId : null }).where(eq(
      pendingType === 'book' ? tbl_book_borrowing.id :
      pendingType === 'magazine' ? tbl_magazine_borrowing.id :
      pendingType === 'thesis' ? tbl_thesis_borrowing.id :
      tbl_journal_borrowing.id,
      reqId
    ));

    // update parent available copies for book/magazine/journal
    try {
      if (pendingType === 'book' && pending.bookId) {
        await db.update(tbl_book).set({ availableCopies: sql`GREATEST(${tbl_book.availableCopies} - 1, 0)` }).where(eq(tbl_book.id, pending.bookId));
      } else if (pendingType === 'magazine' && pending.magazineId) {
        await db.update(tbl_magazine).set({ availableCopies: sql`GREATEST(${tbl_magazine.availableCopies} - 1, 0)` }).where(eq(tbl_magazine.id, pending.magazineId));
      } else if (pendingType === 'journal' && pending.journalId) {
        await db.update(tbl_journal).set({ availableCopies: sql`GREATEST(${tbl_journal.availableCopies} - 1, 0)` }).where(eq(tbl_journal.id, pending.journalId));
      }
    } catch (e) {
      console.debug('Failed to decrement availableCopies for pending borrowing:', e);
    }

    if (approverRole === 'admin' || approverRole === 'super_admin') {
      await db.insert(tbl_security_log).values({
        userId: approverId,
        userType: approverRole,
        eventType: 'transaction_approved',
        ipAddress: null,
        userAgent: null,
        timestamp: new Date()
      });
    }

    return json({ success: true });
  }

  throw error(404, { message: 'Reservation or pending borrowing not found' });
};
