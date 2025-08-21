// src/routes/api/categories/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { account, category } from '$lib/server/db/schema/schema.js'; // <-- import category
import { eq, and } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
  id: number;
  role: string;
  username: string;
  email: string;
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

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;

    if (!userId) return null;

    const [user] = await db
      .select({
        id: account.id,
        username: account.username,
        email: account.email,
        role: account.role,
        isActive: account.isActive,
        tokenVersion: account.tokenVersion
      })
      .from(account)
      .where(eq(account.id, userId))
      .limit(1);

    if (!user || !user.isActive) return null;

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return null;
    }

    return {
      id: user.id,
      role: user.role || '',
      username: user.username || '',
      email: user.email || ''
    };
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

    // Fetch categories from the database
    const categoriesResult = await db
      .select({
        id: category.id,
        name: category.name,
        description: category.description
      })
      .from(category);

    return json({
      success: true,
      data: { categories: categoriesResult }
    });

  } catch (err) {
    console.error('Error fetching categories:', err);

    if (err.status) {
      throw err;
    }

    throw error(500, { message: 'Internal server error' });
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

    // Validate according to schema
    if (!name) {
      throw error(400, { message: 'Category name is required.' });
    }
    if (name.length > 50) {
      throw error(400, { message: 'Category name must be at most 50 characters.' });
    }
    if (description.length > 255) {
      throw error(400, { message: 'Description must be at most 255 characters.' });
    }

    // Check for duplicate category name
    const existing = await db
      .select()
      .from(category)
      .where(eq(category.name, name))
      .limit(1);

    if (existing.length > 0) {
      throw error(409, { message: 'Category name already exists.' });
    }

    // Insert new category
    const [inserted] = await db
      .insert(category)
      .values({
        name,
        description
      })
      .returning({
        id: category.id,
        name: category.name,
        description: category.description
      });

    return json({
      success: true,
      data: { category: inserted },
      message: 'Category added successfully.'
    });

  } catch (err) {
    console.error('Error adding category:', err);

    if (err.status) {
      throw err;
    }

    throw error(500, { message: 'Internal server error' });
  }
};