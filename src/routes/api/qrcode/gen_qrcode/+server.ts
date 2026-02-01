import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_qr_token } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

// Nanoid alphabet for unique, library-only tokens
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 12);

const ALLOWED_TYPES = ['library_visit', 'book_qr'];

// GET: Optionally filter by type
export const GET: RequestHandler = async ({ url }) => {
  try {
    const type = url.searchParams.get('type');
    let codes;
    if (type && ALLOWED_TYPES.includes(type)) {
      codes = await db.select().from(tbl_qr_token).where(eq(tbl_qr_token.tokenType, type));
    } else {
      codes = await db.select().from(tbl_qr_token);
    }
    return json({
      success: true,
      qrCodes: codes
    });
  } catch (err) {
    console.error('Error fetching QR codes:', err);
    throw error(500, { message: 'Internal server error' });
  }
};

// POST: Generate and save a new unique QR code token with type
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { type } = await request.json();
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return json({ success: false, message: "Valid QR code type is required ('library_visit' or 'book_qr')." }, { status: 400 });
    }
    // Generate a unique token (not based on date)
    let token: string;
    let exists = true;
    // Ensure uniqueness
    do {
      if (type === 'book_qr') {
        token = `BOOKQR-${nanoid()}`;
      } else {
        token = `LIBVISIT-${nanoid()}`;
      }
      const found = await db.select().from(tbl_qr_token).where(eq(tbl_qr_token.token, token)).limit(1);
      exists = found.length > 0;
    } while (exists);

    const [inserted] = await db.insert(tbl_qr_token).values({ token, tokenType: type, isUsed: false }).returning();

    return json({
      success: true,
      token: inserted.token,
      tokenType: inserted.tokenType
    }, { status: 201 });
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw error(500, { message: 'Internal server error' });
  }
};

// DELETE: Remove a QR code by id
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    if (!id) {
      return json({ success: false, message: "QR code id is required." }, { status: 400 });
    }
    const deleted = await db.delete(tbl_qr_token).where(eq(tbl_qr_token.id, id)).returning();
    if (deleted.length === 0) {
      return json({ success: false, message: "QR code not found." }, { status: 404 });
    }
    return json({ success: true });
  } catch (err) {
    console.error('Error deleting QR code:', err);
    throw error(500, { message: 'Internal server error' });
  }
};