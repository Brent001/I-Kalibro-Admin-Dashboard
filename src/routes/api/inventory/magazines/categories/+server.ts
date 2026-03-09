// src/routes/api/inventory/magazines/categories/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_staff, tbl_admin, tbl_super_admin, tbl_category, tbl_book, tbl_journal, tbl_magazine, tbl_thesis } from '$lib/server/db/schema/schema.js';
import { eq, not, count, and } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
  id: number;
  role: string;
  username: string;
  email: string;
}

// Function to normalize category names for comparison
function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

// Function to check if a category name already exists (case-insensitive)
async function checkDuplicateName(name: string, itemType: string, excludeId?: number): Promise<boolean> {
  const normalizedName = normalizeCategoryName(name);

  if (excludeId) {
    const existing = await db
      .select({ id: tbl_category.id, name: tbl_category.name })
      .from(tbl_category)
      .where(and(eq(tbl_category.itemType, itemType), not(eq(tbl_category.id, excludeId))));

    return existing.some((cat: { id: number; name: string | null }) => normalizeCategoryName(cat.name ?? '') === normalizedName);
  } else {
    const existing = await db
      .select({ id: tbl_category.id, name: tbl_category.name })
      .from(tbl_category)
      .where(eq(tbl_category.itemType, itemType));

    return existing.some((cat: { id: number; name: string | null }) => normalizeCategoryName(cat.name ?? '') === normalizedName);
  }
}

async function getUsageCountForCategory(itemType: string, id: number) {
  switch ((itemType || '').toLowerCase()) {
    case 'journal': {
      const res = await db.select({ count: count() }).from(tbl_journal).where(eq(tbl_journal.categoryId, id));
      return Number(res[0]?.count || 0);
    }
    case 'magazine': {
      const res = await db.select({ count: count() }).from(tbl_magazine).where(eq(tbl_magazine.categoryId, id));
      return Number(res[0]?.count || 0);
    }
    case 'thesis': {
      const res = await db.select({ count: count() }).from(tbl_thesis).where(eq(tbl_thesis.categoryId, id));
      return Number(res[0]?.count || 0);
    }
    case 'book':
    default: {
      const res = await db.select({ count: count() }).from(tbl_book).where(eq(tbl_book.categoryId, id));
      return Number(res[0]?.count || 0);
    }
  }
}

async function authenticateUser(request: Request): Promise<AuthenticatedUser | null> {
  try {
    let token: string | null = null;

    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map(c => c.split('='))
        );
        token = cookies.token;
      }
    }

    if (!token) return null;

    // Check if session has been revoked
    if (await isSessionRevoked(token)) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;

    if (!userId) return null;

    // Check all admin roles
    try {
      const [superAdmin] = await db
        .select({
          id: tbl_super_admin.id,
          username: tbl_super_admin.username,
          email: tbl_super_admin.email,
          isActive: tbl_super_admin.isActive
        })
        .from(tbl_super_admin)
        .where(eq(tbl_super_admin.id, userId))
        .limit(1);
      if (superAdmin && superAdmin.isActive) {
        return {
          id: superAdmin.id,
          role: 'super_admin',
          username: superAdmin.username || '',
          email: superAdmin.email || ''
        };
      }
    } catch (e) {
      console.warn('Error checking super_admin:', e);
    }

    try {
      const [admin] = await db
        .select({
          id: tbl_admin.id,
          username: tbl_admin.username,
          email: tbl_admin.email,
          isActive: tbl_admin.isActive
        })
        .from(tbl_admin)
        .where(eq(tbl_admin.id, userId))
        .limit(1);
      if (admin && admin.isActive) {
        return {
          id: admin.id,
          role: 'admin',
          username: admin.username || '',
          email: admin.email || ''
        };
      }
    } catch (e) {
      console.warn('Error checking admin:', e);
    }

    try {
      const [staff] = await db
        .select({
          id: tbl_staff.id,
          username: tbl_staff.username,
          email: tbl_staff.email,
          isActive: tbl_staff.isActive
        })
        .from(tbl_staff)
        .where(eq(tbl_staff.id, userId))
        .limit(1);
      if (staff && staff.isActive) {
        return {
          id: staff.id,
          role: 'staff',
          username: staff.username || '',
          email: staff.email || ''
        };
      }
    } catch (e) {
      console.warn('Error checking staff:', e);
    }

    return null;
  } catch (err) {
    console.error('Authentication error:', err);
    return null;
  }
}

export const GET: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    const url = new URL(request.url);
    const itemType = (url.searchParams.get('itemType') || 'magazine').toString();

    const categoriesResult = await db
      .select({
        id: tbl_category.id,
        name: tbl_category.name,
        description: tbl_category.description,
        itemType: tbl_category.itemType
      })
      .from(tbl_category)
      .where(eq(tbl_category.itemType, itemType))
      .orderBy(tbl_category.name);

    return json({
      success: true,
      data: { categories: categoriesResult }
    });

  } catch (err: any) {
    console.error('Error fetching categories:', err);
    if (err?.status) throw err;
    throw error(500, { message: 'Internal server error: ' + (err?.message || 'Unknown error') });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    const body = await request.json();
    const name = (body.name || '').trim();
    const description = (body.description || '').trim();
    const itemType = (body.itemType || 'magazine').toString();

    if (!name) {
      throw error(400, { message: 'Category name is required.' });
    }
    if (name.length > 50) {
      throw error(400, { message: 'Category name must be at most 50 characters.' });
    }
    if (description && description.length > 500) {
      throw error(400, { message: 'Description must be at most 500 characters.' });
    }

    const isDuplicate = await checkDuplicateName(name, itemType);
    if (isDuplicate) {
      throw error(409, { message: 'A category with this name already exists.' });
    }

    const [result] = await db
      .insert(tbl_category)
      .values({
        name,
        description: description || null,
        itemType: itemType
      })
      .returning();

    return json({ success: true, data: result }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating category:', err);
    if (err?.status) throw err;
    throw error(500, { message: 'Internal server error: ' + (err?.message || 'Unknown error') });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    const body = await request.json();
    const { id } = body;
    const name = (body.name || '').trim();
    const description = (body.description || '').trim();
    const itemType = (body.itemType || 'magazine').toString();

    if (!id) {
      throw error(400, { message: 'Category ID is required.' });
    }

    const updateName = name;
    const updateDescription = description;

    if (!updateName) {
      throw error(400, { message: 'Category name is required.' });
    }
    if (updateName.length > 50) {
      throw error(400, { message: 'Category name must be at most 50 characters.' });
    }
    if (updateDescription && updateDescription.length > 500) {
      throw error(400, { message: 'Description must be at most 500 characters.' });
    }

    const isDuplicate = await checkDuplicateName(updateName, itemType, id);
    if (isDuplicate) {
      throw error(409, { message: 'A category with this name already exists.' });
    }

    const [result] = await db
      .update(tbl_category)
      .set({
        name: updateName,
        description: updateDescription || null,
        itemType: itemType
      })
      .where(eq(tbl_category.id, id))
      .returning();

    if (!result) {
      throw error(404, { message: 'Category not found.' });
    }

    return json({ success: true, data: result });
  } catch (err: any) {
    console.error('Error updating category:', err);
    if (err?.status) throw err;
    throw error(500, { message: 'Internal server error: ' + (err?.message || 'Unknown error') });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      throw error(401, { message: 'Unauthorized' });
    }

    const body = await request.json();
    const id = Number(body.id);
    const itemType = (body.itemType || 'magazine').toString();

    if (!id) {
      throw error(400, { message: 'Category ID is required.' });
    }

    const usageCount = await getUsageCountForCategory(itemType, id);
    if (usageCount > 0) {
      throw error(409, { message: `Cannot delete category. It is used by ${usageCount} ${itemType}(s).` });
    }

    const [result] = await db
      .delete(tbl_category)
      .where(eq(tbl_category.id, id))
      .returning();

    if (!result) {
      throw error(404, { message: 'Category not found.' });
    }

    return json({ success: true, message: 'Category deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting category:', err);

    if (err?.status) {
      throw err;
    }

    throw error(500, { message: 'Internal server error: ' + (err?.message || 'Unknown error') });
  }
};