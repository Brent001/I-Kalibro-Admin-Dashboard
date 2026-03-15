import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_user, tbl_library_settings } from '$lib/server/db/schema/schema.js';
import { eq, or } from 'drizzle-orm';

async function getTwoFactorAuthSetting(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ settingValue: tbl_library_settings.settingValue })
      .from(tbl_library_settings)
      .where(eq(tbl_library_settings.settingKey, 'twoFactorAuth'))
      .limit(1);

    return row?.settingValue?.toLowerCase() === 'true';
  } catch (error) {
    console.warn('[2fa-info] Failed to read twoFactorAuth setting', error);
    return false;
  }
}

function maskEmail(email: string): string {
  if (!email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `*${local.slice(-1)}@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

async function findUserEmailById(userId: number): Promise<string | null> {
  const [superAdmin] = await db.select({ email: tbl_super_admin.email }).from(tbl_super_admin).where(eq(tbl_super_admin.id, userId)).limit(1);
  if (superAdmin?.email) return superAdmin.email;

  const [admin] = await db.select({ email: tbl_admin.email }).from(tbl_admin).where(eq(tbl_admin.id, userId)).limit(1);
  if (admin?.email) return admin.email;

  const [staff] = await db.select({ email: tbl_staff.email }).from(tbl_staff).where(eq(tbl_staff.id, userId)).limit(1);
  if (staff?.email) return staff.email;

  const [user] = await db.select({ email: tbl_user.email }).from(tbl_user).where(eq(tbl_user.id, userId)).limit(1);
  if (user?.email) return user.email;

  return null;
}

export const GET: RequestHandler = async ({ url }) => {
  const userIdParam = url.searchParams.get('userId');
  if (!userIdParam) {
    return json({ success: false, message: 'Missing userId' }, { status: 400 });
  }

  const userId = Number(userIdParam);
  if (!userId || Number.isNaN(userId)) {
    return json({ success: false, message: 'Invalid userId' }, { status: 400 });
  }

  const twoFactorEnabled = await getTwoFactorAuthSetting();
  if (!twoFactorEnabled) {
    return json({ success: false, message: 'Two-factor authentication not enabled' }, { status: 403 });
  }

  const email = await findUserEmailById(userId);
  if (!email) {
    return json({ success: false, message: 'User not found or email missing' }, { status: 404 });
  }

  return json({ success: true, maskedEmail: maskEmail(email) });
};