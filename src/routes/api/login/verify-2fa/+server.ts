import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_user, tbl_security_log, tbl_staff_permission } from '$lib/server/db/schema/schema.js';
import { eq, or } from 'drizzle-orm';
import { redisClient } from '$lib/server/db/cache.js';
import { generateTokens, type AuthUser } from '$lib/server/db/auth.js';
import { randomBytes } from 'crypto';
import jwt, { type Secret } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

async function findUserById(id: number): Promise<{ id:number; uniqueId:string; name:string; username:string; email:string; password:string; isActive:boolean; userType:'super_admin'|'admin'|'staff'|'user'; } | null> {
    const [superAdmin] = await db.select().from(tbl_super_admin).where(eq(tbl_super_admin.id, id)).limit(1);
    if (superAdmin && superAdmin.isActive) return { id: superAdmin.id, uniqueId: superAdmin.uniqueId!, name: superAdmin.name, username: superAdmin.username, email: superAdmin.email, password: superAdmin.password, isActive: superAdmin.isActive || false, userType:'super_admin' };

    const [admin] = await db.select().from(tbl_admin).where(eq(tbl_admin.id, id)).limit(1);
    if (admin && admin.isActive) return { id: admin.id, uniqueId: admin.uniqueId!, name: admin.name, username: admin.username, email: admin.email, password: admin.password, isActive: admin.isActive || false, userType:'admin' };

    const [staff] = await db.select().from(tbl_staff).where(eq(tbl_staff.id, id)).limit(1);
    if (staff && staff.isActive) return { id: staff.id, uniqueId: staff.uniqueId!, name: staff.name, username: staff.username, email: staff.email, password: staff.password, isActive: staff.isActive || false, userType:'staff' };

    const [user] = await db.select().from(tbl_user).where(eq(tbl_user.id, id)).limit(1);
    if (user && user.isActive) return { id: user.id, uniqueId: user.uniqueId!, name: user.name, username: user.username, email: user.email || '', password: user.password, isActive: user.isActive || false, userType:'user' };

    return null;
}

async function createAuthUser(foundUser: NonNullable<Awaited<ReturnType<typeof findUserById>>>): Promise<AuthUser> {
    let permissions: string[] = [];
    if (['admin', 'super_admin', 'staff'].includes(foundUser.userType) && foundUser.uniqueId) {
        const [perm] = await db.select({
            canManageBooks: tbl_staff_permission.canManageBooks,
            canManageUsers: tbl_staff_permission.canManageUsers,
            canManageBorrowing: tbl_staff_permission.canManageBorrowing,
            canManageReservations: tbl_staff_permission.canManageReservations,
            canViewReports: tbl_staff_permission.canViewReports,
            canManageFines: tbl_staff_permission.canManageFines,
        }).from(tbl_staff_permission).where(eq(tbl_staff_permission.staffUniqueId, foundUser.uniqueId)).limit(1);

        if (perm) permissions = (Object.keys(perm) as (keyof typeof perm)[]).filter((k) => perm[k]);
    }

    return {
        id: foundUser.id,
        name: foundUser.name,
        username: foundUser.username,
        email: foundUser.email,
        userType: foundUser.userType,
        isActive: foundUser.isActive,
        permissions
    };
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
    try {
        const ip = getClientAddress();
        const body = await request.json();
        const { otp, rememberMe } = body;

        const cookieHeader = request.headers.get('cookie') || '';
        const cookieEntries = Object.fromEntries(cookieHeader.split('; ').filter(Boolean).map((c) => { const [name, ...rest] = c.split('='); return [name, rest.join('=')]; }));
        const twoFactorToken = cookieEntries.twoFactorToken;

        if (!twoFactorToken) {
            return new Response(JSON.stringify({ success: false, message: '2FA token missing' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const tokenKey = `login:2fa:token:${twoFactorToken}`;
        const rawToken = await redisClient.get(tokenKey);
        if (!rawToken) {
            return new Response(JSON.stringify({ success: false, message: '2FA token expired or invalid' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        if (!otp) {
            return new Response(JSON.stringify({ success: false, message: 'Missing OTP information' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const tokenData = JSON.parse(rawToken);
        const userId = tokenData.userId;

        if (!userId) {
            return new Response(JSON.stringify({ success: false, message: 'User not found in token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const key = `login:2fa:${userId}`;
        const raw = await redisClient.get(key);
        if (!raw) {
            await redisClient.del(tokenKey);
            return new Response(JSON.stringify({ success: false, message: 'OTP expired or not found' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const data = JSON.parse(raw);
        if (Date.now() > data.expiresAt) {
            await redisClient.del(key);
            return new Response(JSON.stringify({ success: false, message: 'OTP expired. Please initiate login again.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        if (data.attempts >= 5) {
            await redisClient.del(key);
            return new Response(JSON.stringify({ success: false, message: 'Too many failed OTP attempts.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        if (data.otp !== otp) {
            await redisClient.setex(key, Math.max(60, Math.ceil((data.expiresAt - Date.now())/1000)), JSON.stringify({ ...data, attempts: data.attempts + 1 }));
            return new Response(JSON.stringify({ success: false, message: 'Invalid OTP.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        await redisClient.del(key);
        await redisClient.del(tokenKey);
        cookies.set('twoFactorToken', '', { path: '/', maxAge: 0 });

        const foundUser = await findUserById(Number(userId));
        if (!foundUser || !foundUser.isActive) {
            return new Response(JSON.stringify({ success: false, message: 'User not found or inactive' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const authUser = await createAuthUser(foundUser);
        const { accessToken, refreshToken, sessionId } = await generateTokens(authUser, { userAgent: request.headers.get('user-agent') || '', ipAddress: ip });

        cookies.set('token', accessToken, { path: '/', httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 15 * 60 });
        cookies.set('refresh_token', refreshToken, { path: '/', httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', secure: process.env.NODE_ENV === 'production', maxAge: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60 });

        return new Response(JSON.stringify({ success: true, message: '2FA verified. Login successful.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('verify-2fa error:', error);
        return new Response(JSON.stringify({ success: false, message: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
