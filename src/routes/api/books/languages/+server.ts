// src/routes/api/books/languages/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { book, staffAccount } from '$lib/server/db/schema/schema.js';
import { eq, not, isNotNull } from 'drizzle-orm';

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
        id: staffAccount.id,
        username: staffAccount.username,
        email: staffAccount.email,
        role: staffAccount.role,
        isActive: staffAccount.isActive
      })
      .from(staffAccount)
      .where(eq(staffAccount.id, userId))
      .limit(1);

    if (!user || !user.isActive) return null;

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

    // Fetch distinct languages from books table, excluding null values
    const languagesResult = await db
      .select({ language: book.language })
      .from(book)
      .where(isNotNull(book.language));

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

    throw error(500, { message: 'Internal server error' });
  }
};