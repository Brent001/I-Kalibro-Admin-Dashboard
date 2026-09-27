import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { randomBytes } from 'crypto';
import { db } from '$lib/server/db/index.js';
import { verifyToken } from '$lib/server/db/auth.js';
import { tbl_thesis, tbl_thesis_copy } from '$lib/server/db/schema/schema.js';

function createId(prefix: string) {
  return `${prefix}-${randomBytes(6).toString('hex').toUpperCase()}`;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('token');
  const user = token ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) {
    throw error(401, 'Unauthorized');
  }

  const body = await request.json();
  const title = String(body.title || '').trim();
  const author = String(body.author || '').trim();
  const publicationYear = Number(body.publicationYear);
  const categoryId = Number(body.categoryId);
  const totalCopies = Number(body.totalCopies);

  if (!title || !author) throw error(400, 'Title and author are required.');
  if (!Number.isInteger(publicationYear) || publicationYear < 1000 || publicationYear > new Date().getFullYear()) {
    throw error(400, 'Publication year is invalid.');
  }
  if (!Number.isInteger(categoryId) || categoryId < 1) throw error(400, 'Category is required.');
  if (!Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 999) throw error(400, 'Copies must be between 1 and 999.');

  const thesisId = String(body.thesisId || '').trim() || createId('RES');
  const [research] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(tbl_thesis).values({
      thesisId,
      title,
      author,
      advisor: String(body.advisor || '').trim() || null,
      department: String(body.department || '').trim() || null,
      publicationYear,
      abstract: String(body.abstract || '').trim() || null,
      categoryId,
      location: String(body.location || '').trim() || null,
      totalCopies,
      availableCopies: totalCopies,
      isActive: true
    }).returning();

    await tx.insert(tbl_thesis_copy).values(Array.from({ length: totalCopies }, (_, index) => ({
      thesisId: created.id,
      copyNumber: index + 1,
      callNumber: `${thesisId}-C${index + 1}`,
      qrCode: createId('QR'),
      status: 'available',
      isActive: true
    })));

    return [created] as const;
  });

  return json({ success: true, data: research, message: 'Research added successfully.' }, { status: 201 });
};
