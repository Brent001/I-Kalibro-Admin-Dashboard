import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { verifyToken } from '$lib/server/db/auth.js';
import { tbl_thesis, tbl_thesis_copy } from '$lib/server/db/schema/schema.js';

async function requireInventoryUser(token: string | undefined) {
  const user = token ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) throw error(401, 'Unauthorized');
  return user;
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  await requireInventoryUser(cookies.get('token'));
  const itemId = Number(url.searchParams.get('itemId'));
  if (!Number.isInteger(itemId) || itemId < 1) throw error(400, 'A valid itemId is required.');
  const copies = await db.select().from(tbl_thesis_copy).where(and(eq(tbl_thesis_copy.thesisId, itemId), eq(tbl_thesis_copy.isActive, true)));
  return json({ success: true, itemId, copies });
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  await requireInventoryUser(cookies.get('token'));
  const body = await request.json();
  const itemId = Number(body.itemId);
  const copyNumber = Number(body.copyNumber);
  const qrCode = String(body.qrCode || '').trim();
  const callNumber = String(body.callNumber || '').trim();
  if (!Number.isInteger(itemId) || itemId < 1 || !Number.isInteger(copyNumber) || copyNumber < 1 || !qrCode || !callNumber) {
    throw error(400, 'itemId, copyNumber, qrCode, and callNumber are required.');
  }
  const [thesis] = await db.select({ id: tbl_thesis.id }).from(tbl_thesis).where(and(eq(tbl_thesis.id, itemId), eq(tbl_thesis.isActive, true))).limit(1);
  if (!thesis) throw error(404, 'Research record not found.');
  const [copy] = await db.insert(tbl_thesis_copy).values({ thesisId: itemId, copyNumber, qrCode, callNumber, status: body.status || 'available', isActive: true }).returning();
  return json({ success: true, message: 'Research copy created successfully.', data: copy }, { status: 201 });
};

export const PUT: RequestHandler = async ({ cookies, request }) => {
  await requireInventoryUser(cookies.get('token'));
  const body = await request.json();
  const copyId = Number(body.copyId);
  if (!Number.isInteger(copyId) || copyId < 1) throw error(400, 'A valid copyId is required.');
  const updates: Record<string, unknown> = {};
  if (body.copyNumber !== undefined) {
    const copyNumber = Number(body.copyNumber);
    if (!Number.isInteger(copyNumber) || copyNumber < 1) throw error(400, 'copyNumber must be a positive integer.');
    updates.copyNumber = copyNumber;
  }
  if (body.callNumber !== undefined) updates.callNumber = String(body.callNumber).trim();
  if (body.qrCode !== undefined) updates.qrCode = String(body.qrCode).trim();
  if (body.status !== undefined) updates.status = String(body.status);
  if (!Object.keys(updates).length) throw error(400, 'At least one copy field must be provided.');
  updates.updatedAt = new Date();
  const [copy] = await db.update(tbl_thesis_copy).set(updates).where(eq(tbl_thesis_copy.id, copyId)).returning();
  if (!copy) throw error(404, 'Research copy not found.');
  return json({ success: true, message: 'Research copy updated successfully.', data: copy });
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
  await requireInventoryUser(cookies.get('token'));
  const body = await request.json();
  const copyId = Number(body.copyId);
  if (!Number.isInteger(copyId) || copyId < 1) throw error(400, 'A valid copyId is required.');
  const [copy] = await db.update(tbl_thesis_copy).set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(tbl_thesis_copy.id, copyId), eq(tbl_thesis_copy.isActive, true))).returning({ id: tbl_thesis_copy.id });
  if (!copy) throw error(404, 'Research copy not found.');
  return json({ success: true, message: 'Research copy deactivated successfully.' });
};
