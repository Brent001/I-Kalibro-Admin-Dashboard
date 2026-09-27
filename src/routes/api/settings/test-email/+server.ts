import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { eq } from 'drizzle-orm';
import { verifyToken } from '$lib/server/db/auth.js';
import { db } from '$lib/server/db/index.js';
import { tbl_library_settings } from '$lib/server/db/schema/schema.js';
import { sendLibraryEmail } from '$lib/server/utils/email.js';

export const POST: RequestHandler = async ({ cookies }) => {
  const token = cookies.get('token');
  if (!token || !(await verifyToken(token))) throw error(401, 'Unauthorized');

  const [row] = await db.select().from(tbl_library_settings)
    .where(eq(tbl_library_settings.settingKey, 'systemSettings')).limit(1);
  if (!row) throw error(400, 'Save the library email address first.');

  let settings: { email?: string };
  try {
    settings = JSON.parse(row.settingValue);
  } catch {
    throw error(500, 'Saved settings are invalid.');
  }

  const recipient = settings.email?.trim();
  if (!recipient) throw error(400, 'Configure a library email address first.');

  await sendLibraryEmail(
    recipient,
    'i-Kalibro email configuration test',
    '<p>This test confirms that i-Kalibro can send email through Resend.</p>'
  );

  return json({ success: true, message: 'Test email sent.' });
};