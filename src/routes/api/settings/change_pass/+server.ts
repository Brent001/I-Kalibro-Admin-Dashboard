import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import bcrypt from 'bcrypt';
import { db } from '$lib/server/db/index.js';
import { tbl_user, tbl_staff, tbl_admin, tbl_super_admin, tbl_security_log } from '$lib/server/db/schema/schema.js';
import { eq, and } from 'drizzle-orm';
import { revokeAllUserSessions, verifyToken } from '$lib/server/db/auth.js';

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const bearer = request.headers.get('authorization');
        const token = cookies.get('token') || (bearer?.startsWith('Bearer ') ? bearer.slice(7) : null);
        const auth = token ? await verifyToken(token) : null;
        if (!auth) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { currentPassword, newPassword, confirmPassword } = body || {};
        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || typeof confirmPassword !== 'string' || !currentPassword || !newPassword || !confirmPassword) {
            return json({ success: false, message: 'All password fields are required.' }, { status: 400 });
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

        await updatePassword(await bcrypt.hash(newPassword, 10));
        try {
            await db.insert(tbl_security_log).values({ userId: auth.id, userType: auth.userType, eventType: 'password_change' });
        } catch (logError) {
            console.warn('Failed to record password change security log:', logError);
        }
        await revokeAllUserSessions(auth.id);
        return json({ success: true, message: 'Password changed. Please sign in again.' });
    } catch (err: any) {
        console.error('POST /api/settings/change_pass error:', err);
        return json({ success: false, message: 'Failed to change password.' }, { status: 500 });
    }
};
