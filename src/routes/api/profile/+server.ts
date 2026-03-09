import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_book, tbl_magazine, tbl_admin, tbl_super_admin, tbl_staff, tbl_user } from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { uploadProfilePhotoToB2, generateProfilePhotoUrl } from '$lib/server/utils/backblazeUpload.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin' | 'staff' | 'user';
    username?: string;
    email?: string;
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

        if (await isSessionRevoked(token)) {
            return null;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;

        if (!userId) return null;

        // Check types in order: super_admin, admin, staff, user
        const [superAdmin] = await db
            .select({ id: tbl_super_admin.id, username: tbl_super_admin.username, email: tbl_super_admin.email })
            .from(tbl_super_admin)
            .where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true)))
            .limit(1);

        if (superAdmin) return { id: userId, userType: 'super_admin', username: superAdmin.username, email: superAdmin.email };

        const [admin] = await db
            .select({ id: tbl_admin.id, username: tbl_admin.username, email: tbl_admin.email })
            .from(tbl_admin)
            .where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true)))
            .limit(1);

        if (admin) return { id: userId, userType: 'admin', username: admin.username, email: admin.email };

        const [staff] = await db
            .select({ id: tbl_staff.id, username: tbl_staff.username, email: tbl_staff.email })
            .from(tbl_staff)
            .where(and(eq(tbl_staff.id, userId), eq(tbl_staff.isActive, true)))
            .limit(1);

        if (staff) return { id: userId, userType: 'staff', username: staff.username, email: staff.email };

        const [user] = await db
            .select({ id: tbl_user.id, username: tbl_user.username, email: tbl_user.email })
            .from(tbl_user)
            .where(and(eq(tbl_user.id, userId), eq(tbl_user.isActive, true)))
            .limit(1);

        if (user) return { id: userId, userType: 'user', username: user.username, email: user.email };

        return null;
    } catch (err: any) {
        console.error('Authentication error:', err);
        return null;
    }
}

// GET - readiness check
export const GET: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user) return error(403, 'Unauthorized');

        return json({ ready: true, user });
    } catch (err: any) {
        console.error('Profile GET error:', err);
        return error(500, err.message || 'Server error');
    }
};

// POST - upload profile photo
export const POST: RequestHandler = async ({ request }) => {
    try {
        const authUser = await authenticateUser(request);
        if (!authUser) return error(403, 'Unauthorized');

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const targetType = (formData.get('targetType') as string) || null; // optional: 'user'|'staff'|'admin'|'super_admin'
        const targetIdStr = (formData.get('targetId') as string) || null;

        if (!file) return error(400, 'Missing file');
        if (!file.type.startsWith('image/')) return error(400, 'File must be an image');

        // Decide which record to update
        let finalType = authUser.userType;
        let finalId = authUser.id;

        if (targetType && targetIdStr) {
            // Only allow admins/super_admins to update other users
            if (authUser.userType !== 'admin' && authUser.userType !== 'super_admin') {
                return error(403, 'Unauthorized to update other users');
            }
            finalType = targetType as AuthenticatedUser['userType'];
            finalId = Number(targetIdStr);
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;

        const photoUrl = await uploadProfilePhotoToB2(fileName, buffer, file.type);

        // Save to database based on finalType
        if (finalType === 'super_admin') {
            await db.update(tbl_super_admin).set({ profilePhoto: photoUrl }).where(eq(tbl_super_admin.id, Number(finalId)));
        } else if (finalType === 'admin') {
            await db.update(tbl_admin).set({ profilePhoto: photoUrl }).where(eq(tbl_admin.id, Number(finalId)));
        } else if (finalType === 'staff') {
            await db.update(tbl_staff).set({ profilePhoto: photoUrl }).where(eq(tbl_staff.id, Number(finalId)));
        } else if (finalType === 'user') {
            await db.update(tbl_user).set({ profilePhoto: photoUrl }).where(eq(tbl_user.id, Number(finalId)));
        }

        return json({ success: true, photoUrl, fileName, targetType: finalType, targetId: finalId });
    } catch (err: any) {
        console.error('Error uploading profile photo:', err);
        return error(500, err.message || 'Failed to upload profile photo');
    }
};
