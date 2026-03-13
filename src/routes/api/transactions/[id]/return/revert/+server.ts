// src/routes/api/transactions/[id]/return/revert/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import {
  tbl_book_borrowing,
  tbl_magazine_borrowing,
  tbl_thesis_borrowing,
  tbl_journal_borrowing,
  tbl_return,
  tbl_fine,
  tbl_book_copy,
  tbl_magazine_copy,
  tbl_thesis_copy,
  tbl_journal_copy,
  tbl_book,
  tbl_magazine,
  tbl_thesis,
  tbl_journal,
  tbl_staff,
  tbl_admin,
  tbl_super_admin
} from '$lib/server/db/schema/schema.js';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * How long staff have to revert a return.
 * MUST match FULFILLMENT_DELAY_MS in the transactions GET handler so the
 * promotion and the revert window are perfectly in sync.
 */
const REVERSAL_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
  const cookies = request.headers.get('Cookie');
  if (cookies) {
    const m = cookies.match(/token=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    // ── Authentication ────────────────────────────────────────────────────────
    const token = cookies.get('token') || extractToken(request);
    if (!token) throw error(401, { message: 'Not authenticated' });
    if (await isSessionRevoked(token)) throw error(401, { message: 'Session revoked' });

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      throw error(401, { message: 'Invalid token' });
    }

    const actorId = decoded.userId || decoded.id;
    if (!actorId) throw error(401, { message: 'Invalid token payload' });

    // Resolve actor type
    let actor: any = null;
    let actorType: 'staff' | 'admin' | 'super_admin' | null = null;

    const [staffRec] = await db.select().from(tbl_staff).where(eq(tbl_staff.id, actorId)).limit(1);
    if (staffRec) { actor = staffRec; actorType = 'staff'; }
    else {
      const [adminRec] = await db.select().from(tbl_admin).where(eq(tbl_admin.id, actorId)).limit(1);
      if (adminRec) { actor = adminRec; actorType = 'admin'; }
      else {
        const [superRec] = await db.select().from(tbl_super_admin).where(eq(tbl_super_admin.id, actorId)).limit(1);
        if (superRec) { actor = superRec; actorType = 'super_admin'; }
      }
    }
    if (!actor) throw error(401, { message: 'Actor not found or inactive' });

    const borrowingId = parseInt(params.id);
    if (isNaN(borrowingId)) throw error(400, { message: 'Invalid borrowing ID' });

    // ── Password verification ─────────────────────────────────────────────────
    const { password } = await request.json();
    if (actorType === 'staff') {
      if (!password?.trim()) throw error(400, { message: 'Password required' });
      const ok = await bcrypt.compare(password, actor.password);
      if (!ok) throw error(401, { message: 'Invalid password' });
    } else if (password?.trim()) {
      // Admin/super_admin: password optional but validated if supplied
      const ok = await bcrypt.compare(password, actor.password);
      if (!ok) throw error(401, { message: 'Invalid password' });
    }

    // ── Locate the borrowing record ───────────────────────────────────────────
    const [bBook]    = await db.select().from(tbl_book_borrowing)   .where(eq(tbl_book_borrowing.id,    borrowingId)).limit(1);
    const [bMag]     = await db.select().from(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.id, borrowingId)).limit(1);
    const [bThesis]  = await db.select().from(tbl_thesis_borrowing)  .where(eq(tbl_thesis_borrowing.id,  borrowingId)).limit(1);
    const [bJournal] = await db.select().from(tbl_journal_borrowing) .where(eq(tbl_journal_borrowing.id, borrowingId)).limit(1);

    let b: any = null;
    let itemType = '';
    let copyId: number | null = null;

    if (bBook)    { b = bBook;    itemType = 'book';    copyId = b.bookCopyId; }
    else if (bMag)    { b = bMag;     itemType = 'magazine'; copyId = b.magazineCopyId; }
    else if (bThesis) { b = bThesis;  itemType = 'thesis';   copyId = b.thesisCopyId; }
    else if (bJournal){ b = bJournal; itemType = 'journal';  copyId = b.journalCopyId; }
    else throw error(404, { message: 'Borrowing record not found' });

    // ── Status check ──────────────────────────────────────────────────────────
    // Only 'returned' items can be reverted — 'fulfilled' means the 1-hour
    // window has already closed and the record was promoted by promoteExpiredReturns().
    if (b.status === 'fulfilled') {
      throw error(400, {
        message: 'This return can no longer be reverted. The 1-hour grace period has expired.'
      });
    }
    if (b.status !== 'returned') {
      throw error(400, { message: 'Only recently returned items may be reverted.' });
    }

    // ── Enforce the 1-hour revert window ─────────────────────────────────────
    const returnTime = new Date(b.returnDate).getTime();
    const elapsed = Date.now() - returnTime;
    if (elapsed > REVERSAL_WINDOW_MS) {
      throw error(400, {
        message: `Return can no longer be reverted. The 1-hour grace period expired ${Math.round((elapsed - REVERSAL_WINDOW_MS) / 60000)} minute(s) ago.`
      });
    }

    // ── Delete return and fine records ────────────────────────────────────────
    await db.delete(tbl_return).where(eq(tbl_return.borrowingId, borrowingId));
    await db.delete(tbl_fine).where(eq(tbl_fine.borrowingId, borrowingId));

    // ── Restore borrowing and copy state ──────────────────────────────────────
    if (itemType === 'book') {
      await db.update(tbl_book_borrowing)
        .set({ status: 'borrowed', returnDate: null as any })
        .where(eq(tbl_book_borrowing.id, borrowingId));
      if (copyId) {
        await db.update(tbl_book_copy).set({ status: 'borrowed' }).where(eq(tbl_book_copy.id, copyId));
        const parentId = b.bookId ?? null;
        if (parentId) {
          await db.update(tbl_book)
            .set({ availableCopies: sql`GREATEST(COALESCE(${tbl_book.availableCopies}, 0) - 1, 0)` })
            .where(eq(tbl_book.id, parentId));
        }
      }
    } else if (itemType === 'magazine') {
      await db.update(tbl_magazine_borrowing)
        .set({ status: 'borrowed', returnDate: null as any })
        .where(eq(tbl_magazine_borrowing.id, borrowingId));
      if (copyId) {
        await db.update(tbl_magazine_copy).set({ status: 'borrowed' }).where(eq(tbl_magazine_copy.id, copyId));
        const parentId = b.magazineId ?? null;
        if (parentId) {
          await db.update(tbl_magazine)
            .set({ availableCopies: sql`GREATEST(COALESCE(${tbl_magazine.availableCopies}, 0) - 1, 0)` })
            .where(eq(tbl_magazine.id, parentId));
        }
      }
    } else if (itemType === 'thesis') {
      await db.update(tbl_thesis_borrowing)
        .set({ status: 'borrowed', returnDate: null as any })
        .where(eq(tbl_thesis_borrowing.id, borrowingId));
      if (copyId) {
        await db.update(tbl_thesis_copy).set({ status: 'borrowed' }).where(eq(tbl_thesis_copy.id, copyId));
      }
    } else if (itemType === 'journal') {
      await db.update(tbl_journal_borrowing)
        .set({ status: 'borrowed', returnDate: null as any })
        .where(eq(tbl_journal_borrowing.id, borrowingId));
      if (copyId) {
        await db.update(tbl_journal_copy).set({ status: 'borrowed' }).where(eq(tbl_journal_copy.id, copyId));
        const parentId = b.journalId ?? null;
        if (parentId) {
          await db.update(tbl_journal)
            .set({ availableCopies: sql`GREATEST(COALESCE(${tbl_journal.availableCopies}, 0) - 1, 0)` })
            .where(eq(tbl_journal.id, parentId));
        }
      }
    }

    return json({ success: true, message: 'Return successfully reverted; borrowing restored.' });
  } catch (err: any) {
    console.error('revert-return error:', err);
    return json(
      { success: false, message: err.message || 'Failed to revert return' },
      { status: err.status || 500 }
    );
  }
};