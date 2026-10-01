import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { verifyToken } from '$lib/server/db/auth.js';
import { tbl_category } from '$lib/server/db/schema/schema.js';

async function requireInventoryUser(token: string | undefined) {
  const user = token ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) {
    throw error(401, 'Unauthorized');
  }
  return user;
}

export const GET: RequestHandler = async ({ cookies }) => {
  await requireInventoryUser(cookies.get('token'));

  const categories = await db
    .select({ id: tbl_category.id, name: tbl_category.name, description: tbl_category.description })
    .from(tbl_category)
    .where(eq(tbl_category.itemType, 'thesis'))
    .orderBy(tbl_category.name);

  return json({ success: true, data: { categories } });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  await requireInventoryUser(cookies.get('token'));

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!name) throw error(400, 'Category name is required.');
  if (name.length > 100) throw error(400, 'Category name must be at most 100 characters.');

  const existingCategories = await db.select({ name: tbl_category.name }).from(tbl_category);
  if (existingCategories.some((category) => category.name?.toLowerCase() === name.toLowerCase())) {
    throw error(409, 'A category with this name already exists.');
  }

  const [category] = await db.insert(tbl_category).values({
    name,
    description: description || null,
    itemType: 'thesis'
  }).returning({
    id: tbl_category.id,
    name: tbl_category.name,
    description: tbl_category.description
  });

  return json({ success: true, data: { category }, message: 'Research category added successfully.' }, { status: 201 });
};
