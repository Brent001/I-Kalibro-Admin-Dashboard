import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '$lib/server/db/index.js';
import { tbl_user, tbl_staff, tbl_admin, tbl_super_admin, tbl_security_log } from '$lib/server/db/schema/schema.js';
import { eq, and } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

async function authenticateAny(request: Request) {
    try {
        let token: string | null = null;
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
        if (!token) {
            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
                const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
                token = cookies.token;
            }
        }
        if (!token) return null;
        if (await isSessionRevoked(token)) return null;
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        if (!userId) return null;
        return { id: userId };
    } catch (err) {
        console.error('authenticateAny error:', err);
        return null;
    }
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const auth = await authenticateAny(request);
        if (!auth) return error(401, 'Unauthorized');

        const body = await request.json();
        const { currentPassword, newPassword, confirmPassword } = body || {};
        if (!currentPassword || !newPassword || !confirmPassword) return error(400, 'Missing fields');
        if (newPassword !== confirmPassword) return error(400, 'Passwords do not match');
        if (newPassword.length < 8) return error(400, 'Password must be at least 8 characters');

        // Find which table the user belongs to and verify current password
        // Check super_admin
        const [superAdmin] = await db.select().from(tbl_super_admin).where(eq(tbl_super_admin.id, auth.id)).limit(1);
        if (superAdmin) {
            const ok = await bcrypt.compare(currentPassword, superAdmin.password);
            if (!ok) return error(400, 'Current password incorrect');
            const hashed = await bcrypt.hash(newPassword, 10);
            await db.update(tbl_super_admin).set({ password: hashed }).where(eq(tbl_super_admin.id, auth.id));
            // log change
            try {
                await db.insert(tbl_security_log).values({
                    userId: auth.id,
                    userType: 'super_admin',
                    eventType: 'password_change'
                });
            } catch (e) {
                console.debug('Failed to log password change for super_admin:', e);
            }
            return json({ success: true });
        }

        const [admin] = await db.select().from(tbl_admin).where(eq(tbl_admin.id, auth.id)).limit(1);
        if (admin) {
            const ok = await bcrypt.compare(currentPassword, admin.password);
            if (!ok) return error(400, 'Current password incorrect');
            const hashed = await bcrypt.hash(newPassword, 10);
            await db.update(tbl_admin).set({ password: hashed }).where(eq(tbl_admin.id, auth.id));
            try {
                await db.insert(tbl_security_log).values({
                    userId: auth.id,
                    userType: 'admin',
                    eventType: 'password_change'
                });
            } catch (e) {
                console.debug('Failed to log password change for admin:', e);
            }
            return json({ success: true });
        }

        const [staff] = await db.select().from(tbl_staff).where(eq(tbl_staff.id, auth.id)).limit(1);
        if (staff) {
            const ok = await bcrypt.compare(currentPassword, staff.password);
            if (!ok) return error(400, 'Current password incorrect');
            const hashed = await bcrypt.hash(newPassword, 10);
            await db.update(tbl_staff).set({ password: hashed }).where(eq(tbl_staff.id, auth.id));
            try {
                await db.insert(tbl_security_log).values({
                    userId: auth.id,
                    userType: 'staff',
                    eventType: 'password_change'
                });
            } catch (e) {
                console.debug('Failed to log password change for staff:', e);
            }
            return json({ success: true });
        }

        const [user] = await db.select().from(tbl_user).where(eq(tbl_user.id, auth.id)).limit(1);
        if (user) {
            const ok = await bcrypt.compare(currentPassword, user.password);
            if (!ok) return error(400, 'Current password incorrect');
            const hashed = await bcrypt.hash(newPassword, 10);
            await db.update(tbl_user).set({ password: hashed }).where(eq(tbl_user.id, auth.id));
            try {
                await db.insert(tbl_security_log).values({
                    userId: auth.id,
                    userType: 'user',
                    eventType: 'password_change'
                });
            } catch (e) {
                console.debug('Failed to log password change for user:', e);
            }
            return json({ success: true });
        }

        return error(404, 'User not found');
    } catch (err: any) {
        console.error('POST /api/settings/change_pass error:', err);
        return error(500, err.message || 'Failed to change password');
    }
};
