// src/routes/api/books/languages/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_book, tbl_staff, tbl_admin, tbl_super_admin } from '$lib/server/db/schema/schema.js';
import { eq, not, isNotNull } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

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

    // Fetch distinct languages from books table, excluding null values
    const languagesResult = await db
      .select({ language: tbl_book.language })
      .from(tbl_book)
      .where(isNotNull(tbl_book.language));

    // Extract unique language values
    const languages = [...new Set(
      languagesResult
        .map(row => row.language)
        .filter(lang => lang && lang.trim() !== '')
    )].sort();

    // If no languages found in database, provide some common defaults
    const defaultLanguages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi'];
    const finalLanguages = languages.length > 0 ? languages : defaultLanguages;

    return json({
      success: true,
      data: { languages: finalLanguages }
    });

  } catch (err: any) {
    console.error('Error fetching languages:', err);

    if (err?.status) {
      throw err;
    }

    throw error(500, { message: 'Internal server error: ' + (err?.message || 'Unknown error') });
  }
};