import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_book, tbl_magazine, tbl_journal, tbl_admin, tbl_super_admin, tbl_staff } from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { uploadCoverPhotoToB2, generateCoverPhotoUrl } from '$lib/server/utils/backblazeUpload.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin' | 'staff' | 'user';
    username: string;
    email: string;
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

        // Check if user is admin or super_admin
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

        return null;
    } catch (err: any) {
        console.error('Authentication error:', err);
        return null;
    }
}

// GET - Simply return success (credentials are server-side only)
export const GET: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || (user.userType !== 'admin' && user.userType !== 'super_admin')) {
            return error(403, 'Unauthorized - Only admins can upload cover photos');
        }

        return json({
            ready: true,
            message: 'Server ready to accept uploads'
        });
    } catch (err: any) {
        console.error('Error checking server:', err);
        return error(500, err.message || 'Server error');
    }
};

// POST - Upload cover photo file to B2 and save to database
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || (user.userType !== 'admin' && user.userType !== 'super_admin')) {
            return error(403, 'Unauthorized - Only admins can upload cover photos');
        }

        const formData = await request.formData();
        const itemId = formData.get('itemId') as string;
        const itemType = formData.get('itemType') as string;
        const file = formData.get('file') as File;

        if (!itemId || !itemType || !file) {
            return error(400, 'Missing required fields: itemId, itemType, file');
        }

        // Validate itemType
        if (!['book', 'magazine', 'journal'].includes(itemType)) {
            return error(400, 'Cover photo upload only supported for book, magazine, or journal');
        }

        // Validate file
        if (!file.type.startsWith('image/')) {
            return error(400, 'File must be an image');
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;

        // Upload to B2 with itemType for organization
        const photoUrl = await uploadCoverPhotoToB2(fileName, buffer, file.type, itemType);

        // Save to database
        if (itemType === 'book') {
            await db
                .update(tbl_book)
                .set({ coverImage: photoUrl })
                .where(eq(tbl_book.id, Number(itemId)));
        } else if (itemType === 'magazine') {
            await db
                .update(tbl_magazine)
                .set({ coverImage: photoUrl })
                .where(eq(tbl_magazine.id, Number(itemId)));
        } else if (itemType === 'journal') {
            await db
                .update(tbl_journal)
                .set({ coverImage: photoUrl })
                .where(eq(tbl_journal.id, Number(itemId)));
        }

        return json({
            success: true,
            message: 'Cover photo uploaded successfully',
            itemId,
            itemType,
            photoUrl,
            fileName
        });
    } catch (err: any) {
        console.error('Error uploading cover photo:', err);
        return error(500, err.message || 'Failed to upload cover photo');
    }
};
