import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_user, tbl_library_settings } from '$lib/server/db/schema/schema.js';
import { eq, or } from 'drizzle-orm';
import { redisClient } from '$lib/server/db/cache.js';
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

const resendInstance = env.VITE_RESEND_API_KEY ? new Resend(env.VITE_RESEND_API_KEY) : null;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendTwoFactorEmail(toEmail: string, otp: string) {
  if (!toEmail) return;

  if (!resendInstance) {
    console.log(`[2FA] OTP for ${toEmail}: ${otp}`);
    return;
  }

  void resendInstance.emails.send({
    from: 'i-Kalibro <system@i-kalibro.online>',
    to: toEmail,
    subject: 'Your 2FA verification code',
    html: `<p>Your login verification code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`
  });
}

async function getTwoFactorAuthSetting(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ settingValue: tbl_library_settings.settingValue })
      .from(tbl_library_settings)
      .where(eq(tbl_library_settings.settingKey, 'twoFactorAuth'))
      .limit(1);

    return row?.settingValue?.toLowerCase() === 'true';
  } catch (error) {
    console.warn('[resend-2fa] failed to read setting', error);
    return false;
  }
}

async function findUserById(userId: number) {
  const [superAdmin] = await db.select().from(tbl_super_admin).where(eq(tbl_super_admin.id, userId)).limit(1);
  if (superAdmin && superAdmin.isActive) return { id: superAdmin.id, email: superAdmin.email, isActive: superAdmin.isActive };

  const [admin] = await db.select().from(tbl_admin).where(eq(tbl_admin.id, userId)).limit(1);
  if (admin && admin.isActive) return { id: admin.id, email: admin.email, isActive: admin.isActive };

  const [staff] = await db.select().from(tbl_staff).where(eq(tbl_staff.id, userId)).limit(1);
  if (staff && staff.isActive) return { id: staff.id, email: staff.email, isActive: staff.isActive };

  const [user] = await db.select().from(tbl_user).where(eq(tbl_user.id, userId)).limit(1);
  if (user && user.isActive) return { id: user.id, email: user.email, isActive: user.isActive };

  return null;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const payload = await request.json();
    let userId = Number(payload?.userId);

    const cookieHeader = request.headers.get('cookie') || '';
    const cookieEntries = Object.fromEntries(cookieHeader.split('; ').filter(Boolean).map((c) => { const [name, ...rest] = c.split('='); return [name, rest.join('=')]; }));
    const twoFactorToken = cookieEntries.twoFactorToken;

    if (!userId && twoFactorToken) {
      const tokenKey = `login:2fa:token:${twoFactorToken}`;
      const tokenData = await redisClient.get(tokenKey);
      if (tokenData) {
        const data = JSON.parse(tokenData);
        userId = Number(data.userId);
      }
    }

    if (!userId || Number.isNaN(userId)) {
      return json({ success: false, message: 'userId is required' }, { status: 400 });
    }

    const twoFactorEnabled = await getTwoFactorAuthSetting();
    if (!twoFactorEnabled) {
      return json({ success: false, message: 'Two-factor authentication is not enabled.' }, { status: 400 });
    }

    const found = await findUserById(userId);
    if (!found || !found.isActive) {
      return json({ success: false, message: 'User not found or inactive.' }, { status: 404 });
    }

    const email = found.email?.trim();
    if (!email) {
      return json({ success: false, message: 'User does not have an email for 2FA.' }, { status: 400 });
    }

    const otp = generateOTP();
    const key = `login:2fa:${userId}`;
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await redisClient.setex(key, 10 * 60, JSON.stringify({ otp, expiresAt, attempts: 0, userId }));

    sendTwoFactorEmail(email, otp);

    return json({ success: true, message: 'A new OTP has been sent to your email.' });
  } catch (error) {
    console.error('[resend-2fa] error', error);
    return json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
};
