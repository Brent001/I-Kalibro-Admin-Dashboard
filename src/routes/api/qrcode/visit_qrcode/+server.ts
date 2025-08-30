import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { qrCodeToken } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

// Nanoid alphabet for unique, library-only tokens
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 12);

// GET: Return all QR code tokens
export const GET: RequestHandler = async () => {
  try {
    const codes = await db.select().from(qrCodeToken);
    return json({
      success: true,
      qrCodes: codes
    });
  } catch (err) {
    console.error('Error fetching QR codes:', err);
    throw error(500, { message: 'Internal server error' });
  }
};

// POST: Generate and save a new unique QR code token
export const POST: RequestHandler = async () => {
  try {
    // Generate a unique token (not based on date)
    let token: string;
    let exists = true;
    // Ensure uniqueness
    do {
      token = `LIBVISIT-${nanoid()}`;
      const found = await db.select().from(qrCodeToken).where(eq(qrCodeToken.token, token)).limit(1);
      exists = found.length > 0;
    } while (exists);

    const [inserted] = await db.insert(qrCodeToken).values({ token }).returning();

    return json({
      success: true,
      token: inserted.token
    }, { status: 201 });
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw error(500, { message: 'Internal server error' });
  }
};