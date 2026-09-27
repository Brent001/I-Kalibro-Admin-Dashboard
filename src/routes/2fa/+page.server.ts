import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { redisClient } from '$lib/server/db/cache.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_user } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

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

export const load: PageServerLoad = async ({ cookies }) => {
  const twoFactorToken = cookies.get('twoFactorToken');
  if (!twoFactorToken) {
    throw redirect(303, '/');
  }

  const tokenKey = `login:2fa:token:${twoFactorToken}`;
  const rawToken = await redisClient.get(tokenKey);

  if (!rawToken) {
    cookies.delete('twoFactorToken', { path: '/2fa' });
    throw redirect(303, '/');
  }

  let tokenData;
  try {
    tokenData = JSON.parse(rawToken);
  } catch {
    cookies.delete('twoFactorToken', { path: '/2fa' });
    throw redirect(303, '/');
  }

  const userId = Number(tokenData.userId);
  if (!userId || Number.isNaN(userId)) {
    cookies.delete('twoFactorToken', { path: '/2fa' });
    throw redirect(303, '/');
  }

  const email = await findUserEmailById(userId);
  if (!email) {
    cookies.delete('twoFactorToken', { path: '/2fa' });
    throw redirect(303, '/');
  }

  return {
    maskedEmail: maskEmail(email),
    rememberMe: Boolean(tokenData.rememberMe),
  };
};
