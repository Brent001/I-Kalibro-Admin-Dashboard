import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { db } from '$lib/server/db/index.js';
import { tbl_user, tbl_staff, tbl_admin, tbl_super_admin, tbl_security_log } from '$lib/server/db/schema/schema.js';
import { eq, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { revokeOtherUserSessions, verifyToken, type JWTPayload } from '$lib/server/db/auth.js';
import { redisClient } from '$lib/server/db/cache.js';

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const bearer = request.headers.get('authorization');
        const token = cookies.get('token') || (bearer?.startsWith('Bearer ') ? bearer.slice(7) : null);
        const auth = token ? await verifyToken(token) : null;
        if (!auth) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
        const sessionId = token ? (jwt.decode(token) as JWTPayload | null)?.sessionId : undefined;

        const body = await request.json();
        const { currentPassword, newPassword, confirmPassword, otp } = body || {};
        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || typeof confirmPassword !== 'string' || typeof otp !== 'string' || !currentPassword || !newPassword || !confirmPassword || !otp) {
            return json({ success: false, message: 'Current password, new password, confirmation, and verification code are required.' }, { status: 400 });
        }
        if (newPassword !== confirmPassword) return json({ success: false, message: 'Passwords do not match.' }, { status: 400 });
        if (!PASSWORD_POLICY.test(newPassword)) {
            return json({ success: false, message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.' }, { status: 400 });
        }

        let password: string | undefined;
        let updatePassword: (hashed: string) => Promise<unknown>;
        if (auth.userType === 'super_admin') {
            const [actor] = await db.select({ password: tbl_super_admin.password }).from(tbl_super_admin).where(eq(tbl_super_admin.id, auth.id)).limit(1);
            password = actor?.password;
            updatePassword = async (hashed) => db.update(tbl_super_admin).set({ password: hashed }).where(eq(tbl_super_admin.id, auth.id));
        } else if (auth.userType === 'admin') {
            const [actor] = await db.select({ password: tbl_admin.password }).from(tbl_admin).where(eq(tbl_admin.id, auth.id)).limit(1);
            password = actor?.password;
            updatePassword = async (hashed) => db.update(tbl_admin).set({ password: hashed }).where(eq(tbl_admin.id, auth.id));
        } else if (auth.userType === 'staff') {
            const [actor] = await db.select({ password: tbl_staff.password }).from(tbl_staff).where(eq(tbl_staff.id, auth.id)).limit(1);
            password = actor?.password;
            updatePassword = async (hashed) => db.update(tbl_staff).set({ password: hashed }).where(eq(tbl_staff.id, auth.id));
        } else {
            const [actor] = await db.select({ password: tbl_user.password }).from(tbl_user).where(eq(tbl_user.id, auth.id)).limit(1);
            password = actor?.password;
            updatePassword = async (hashed) => db.update(tbl_user).set({ password: hashed }).where(eq(tbl_user.id, auth.id));
        }

        if (!password) return json({ success: false, message: 'User not found.' }, { status: 404 });
        if (!(await bcrypt.compare(currentPassword, password))) return json({ success: false, message: 'Current password is incorrect.' }, { status: 400 });

        if (!sessionId) return json({ success: false, message: 'A valid session is required to change your password.' }, { status: 401 });
        const otpKey = `change_password_otp:${sessionId}`;
        const storedOtpRaw = await redisClient.get(otpKey);
        if (!storedOtpRaw) return json({ success: false, message: 'Verification code is missing or expired. Request a new code.' }, { status: 400 });

        let storedOtp: { otpHash: string; expiresAt: number; attempts: number; userId: number; userType: string; sessionId: string };
        try {
            storedOtp = JSON.parse(storedOtpRaw);
        } catch {
            await redisClient.del(otpKey);
            return json({ success: false, message: 'Verification code is invalid. Request a new code.' }, { status: 400 });
        }

        if (storedOtp.sessionId !== sessionId || storedOtp.userId !== auth.id || storedOtp.userType !== auth.userType || Date.now() > storedOtp.expiresAt) {
            await redisClient.del(otpKey);
            return json({ success: false, message: 'Verification code is invalid or expired. Request a new code.' }, { status: 400 });
        }

        const suppliedOtpHash = createHash('sha256').update(`${sessionId}:${otp.trim()}`).digest('hex');
        if (suppliedOtpHash !== storedOtp.otpHash) {
            storedOtp.attempts += 1;
            if (storedOtp.attempts >= 5) {
                await redisClient.del(otpKey);
                return json({ success: false, message: 'Too many incorrect codes. Request a new code.' }, { status: 429 });
            }
            const ttl = Math.ceil((storedOtp.expiresAt - Date.now()) / 1000);
            if (ttl > 0) await redisClient.setex(otpKey, ttl, JSON.stringify(storedOtp));
            return json({ success: false, message: `Incorrect verification code. ${5 - storedOtp.attempts} attempts remaining.` }, { status: 400 });
        }

        if (!(await redisClient.del(otpKey))) {
            return json({ success: false, message: 'Could not verify the code right now. Try again.' }, { status: 503 });
        }

        await updatePassword(await bcrypt.hash(newPassword, 10));
        try {
            await db.insert(tbl_security_log).values({ userId: auth.id, userType: auth.userType, eventType: 'password_change' });
        } catch (logError) {
            console.warn('Failed to record password change security log:', logError);
        }
        if (sessionId) await revokeOtherUserSessions(auth.id, auth.userType, sessionId);
        return json({ success: true, message: 'Password changed successfully. You can stay signed in.' });
    } catch (err: any) {
        console.error('POST /api/settings/change_pass error:', err);
        return json({ success: false, message: 'Failed to change password.' }, { status: 500 });
    }
};
