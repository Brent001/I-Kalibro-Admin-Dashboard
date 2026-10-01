import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { randomBytes } from 'crypto';
import { and, count, eq, ilike, or } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { verifyToken } from '$lib/server/db/auth.js';
import { tbl_category, tbl_thesis, tbl_thesis_copy } from '$lib/server/db/schema/schema.js';
import { publish as publishResearchEvent } from '$lib/server/events/researchEvents.js';
import { normalizeResearchAuthors } from '$lib/utils/researchAuthors.js';

function createId(prefix: string) {
  return `${prefix}-${randomBytes(6).toString('hex').toUpperCase()}`;
}

export const GET: RequestHandler = async ({ request, cookies, url }) => {
  const token = cookies.get('token');
  const user = token ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) {
    throw error(401, 'Unauthorized');
  }

  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 10)));
  const search = url.searchParams.get('q')?.trim() || '';
  const category = url.searchParams.get('category')?.trim() || '';
  const conditions: any[] = [eq(tbl_thesis.isActive, true)];

  if (search) {
    conditions.push(or(
      ilike(tbl_thesis.title, `%${search}%`),
      ilike(tbl_thesis.author, `%${search}%`),
      ilike(tbl_thesis.thesisId, `%${search}%`)
    ));
  }
  if (category && category !== 'all') conditions.push(ilike(tbl_category.name, category));

  const where = and(...conditions);
  const [countResult, research] = await Promise.all([
    db.select({ count: count() }).from(tbl_thesis).leftJoin(tbl_category, eq(tbl_thesis.categoryId, tbl_category.id)).where(where),
    db.select({
      id: tbl_thesis.id,
      thesisId: tbl_thesis.thesisId,
      title: tbl_thesis.title,
      author: tbl_thesis.author,
      advisor: tbl_thesis.advisor,
      department: tbl_thesis.department,
      publicationYear: tbl_thesis.publicationYear,
      abstract: tbl_thesis.abstract,
      categoryId: tbl_thesis.categoryId,
      category: tbl_category.name,
      location: tbl_thesis.location,
      totalCopies: tbl_thesis.totalCopies,
      availableCopies: tbl_thesis.availableCopies
    })
      .from(tbl_thesis)
      .leftJoin(tbl_category, eq(tbl_thesis.categoryId, tbl_category.id))
      .where(where)
      .orderBy(tbl_thesis.title)
      .limit(limit)
      .offset((page - 1) * limit)
  ]);
  const totalCount = Number(countResult[0]?.count || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return json({
    success: true,
    data: {
      research,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
};

export const PUT: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('token');
  const user = token ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) {
    throw error(401, 'Unauthorized');
  }

  const body = await request.json();
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) throw error(400, 'A valid research ID is required.');

  const title = String(body.title || '').trim();
  const author = normalizeResearchAuthors(body.author);
  const publicationYear = Number(body.publicationYear);
  const categoryId = Number(body.categoryId);
  if (!title || !author) throw error(400, 'Title and author are required.');
  if (author.length > 200) throw error(400, 'Authors must be 200 characters or fewer.');
  if (!Number.isInteger(publicationYear) || publicationYear < 1000 || publicationYear > new Date().getFullYear()) {
    throw error(400, 'Publication year is invalid.');
  }
  if (!Number.isInteger(categoryId) || categoryId < 1) throw error(400, 'Category is required.');

  const [updated] = await db.update(tbl_thesis).set({
    thesisId: String(body.thesisId || '').trim() || undefined,
    title,
    author,
    advisor: String(body.advisor || '').trim() || null,
    department: String(body.department || '').trim() || null,
    publicationYear,
    abstract: String(body.abstract || '').trim() || null,
    categoryId,
    location: String(body.location || '').trim() || null,
    updatedAt: new Date()
  }).where(and(eq(tbl_thesis.id, id), eq(tbl_thesis.isActive, true))).returning();

  if (!updated) throw error(404, 'Research record not found.');
  publishResearchEvent('research-updated', { id: updated.id, thesisId: updated.thesisId });
  return json({ success: true, data: updated, message: 'Research record updated successfully.' });
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('token');
  const user = token ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) {
    throw error(401, 'Unauthorized');
  }

  const body = await request.json();
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) throw error(400, 'A valid research ID is required.');
  const [updated] = await db.update(tbl_thesis)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(tbl_thesis.id, id), eq(tbl_thesis.isActive, true)))
    .returning({ id: tbl_thesis.id });
  if (!updated) throw error(404, 'Research record not found.');
  publishResearchEvent('research-deactivated', updated);
  return json({ success: true, message: 'Research record deactivated successfully.' });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('token');
  const user = token ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) {
    throw error(401, 'Unauthorized');
  }

  const body = await request.json();
  const title = String(body.title || '').trim();
  const author = normalizeResearchAuthors(body.author);
  const publicationYear = Number(body.publicationYear);
  const categoryId = Number(body.categoryId);
  const totalCopies = Number(body.totalCopies);

  if (!title || !author) throw error(400, 'Title and author are required.');
  if (author.length > 200) throw error(400, 'Authors must be 200 characters or fewer.');
  if (!Number.isInteger(publicationYear) || publicationYear < 1000 || publicationYear > new Date().getFullYear()) {
    throw error(400, 'Publication year is invalid.');
  }
  if (!Number.isInteger(categoryId) || categoryId < 1) throw error(400, 'Category is required.');
  if (!Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 999) throw error(400, 'Copies must be between 1 and 999.');

  const thesisId = String(body.thesisId || '').trim() || createId('RES');
  const baseCallNumber = String(body.location || thesisId).trim();
  if (thesisId.length > 30) throw error(400, 'Thesis ID must be at most 30 characters.');

  const [category] = await db.select({ id: tbl_category.id }).from(tbl_category)
    .where(and(eq(tbl_category.id, categoryId), eq(tbl_category.itemType, 'thesis')))
    .limit(1);
  if (!category) throw error(400, 'Choose a valid thesis category.');

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
      pdfFile: String(body.pdfFile || '').trim() || null,
      totalCopies,
      availableCopies: totalCopies,
      isActive: true
    }).onConflictDoNothing({ target: tbl_thesis.thesisId }).returning();

    if (!created) throw error(409, 'Thesis ID already exists.');

    await tx.insert(tbl_thesis_copy).values(Array.from({ length: totalCopies }, (_, index) => ({
      thesisId: created.id,
      copyNumber: index + 1,
      callNumber: `${baseCallNumber}-C${index + 1}`,
      qrCode: createId('QR'),
      status: 'available',
      isActive: true
    })));

    return [created] as const;
  });

  publishResearchEvent('research-created', { id: research.id, thesisId: research.thesisId, totalCopies });
  return json({ success: true, data: research, message: 'Research added successfully.' }, { status: 201 });
};
