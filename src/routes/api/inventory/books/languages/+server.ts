// src/routes/api/books/languages/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_book } from '$lib/server/db/schema/schema.js';
import { verifyToken } from '$lib/server/db/auth.js';

export const GET: RequestHandler = async ({ cookies }) => {
  const user = await verifyToken(cookies.get('token') || '');
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) {
    throw error(401, 'Unauthorized');
  }

  const results = await db
    .select({ language: tbl_book.language })
    .from(tbl_book)
    .where(isNotNull(tbl_book.language));

  const dbLanguages = [...new Set(
    results
      .map(({ language }) => language?.trim())
      .filter((language): language is string => Boolean(language))
  )].sort((a, b) => a.localeCompare(b));

  const defaults = ['English', 'Filipino', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Other'];
  const languages = [...new Set([...defaults, ...dbLanguages])].sort((a, b) => a.localeCompare(b));

  return json({
    success: true,
    data: { languages }
  });
};