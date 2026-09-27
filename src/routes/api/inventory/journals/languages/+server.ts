// src/routes/api/journals/languages/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_journal, tbl_staff, tbl_admin, tbl_super_admin } from '$lib/server/db/schema/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

async function authenticateUser(request: Request): Promise<boolean> {
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
    if (!token) return false;
    
    if (await isSessionRevoked(token)) return false;
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;
    if (!userId) return false;
    
    // Check if user is admin/staff
    const [staff] = await db.select({ id: tbl_staff.id }).from(tbl_staff).where(eq(tbl_staff.id, userId)).limit(1);
    if (staff) return true;
    
    const [admin] = await db.select({ id: tbl_admin.id }).from(tbl_admin).where(eq(tbl_admin.id, userId)).limit(1);
    if (admin) return true;
    
    const [superAdmin] = await db.select({ id: tbl_super_admin.id }).from(tbl_super_admin).where(eq(tbl_super_admin.id, userId)).limit(1);
    if (superAdmin) return true;
    
    return false;
  } catch (err) {
    console.error('Authentication error:', err);
    return false;
  }
}

export const GET: RequestHandler = async ({ request }) => {
  try {
    const isAuthorized = await authenticateUser(request);
    if (!isAuthorized) {
      throw error(401, { message: 'Unauthorized' });
    }

    // Fetch distinct languages from journals table, excluding null values
    const languagesResult = await db
      .select({ language: tbl_journal.language })
      .from(tbl_journal)
      .where(isNotNull(tbl_journal.language));

    // Extract unique language values
    const languageList = languagesResult
      .map(row => row.language)
      .filter((lang): lang is string => lang != null && lang.trim().length > 0);

    // Remove duplicates and sort
    const uniqueLanguages = [...new Set(languageList)].sort();

    return json({
      success: true,
      data: { languages: uniqueLanguages }
    });
  } catch (err: any) {
    console.error('Error fetching languages:', err);
    if (err?.status) {
      throw err;
    }
    throw error(500, { message: 'Internal server error: ' + (err?.message || 'Unknown error') });
  }
};
