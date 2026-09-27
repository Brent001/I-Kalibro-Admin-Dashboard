import type { RequestHandler } from './$types.js';
import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_book, tbl_super_admin, tbl_admin } from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin';
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
            .select({ id: tbl_super_admin.id })
            .from(tbl_super_admin)
            .where(eq(tbl_super_admin.id, userId))
            .limit(1);

        if (superAdmin) return { id: userId, userType: 'super_admin' };

        const [admin] = await db
            .select({ id: tbl_admin.id })
            .from(tbl_admin)
            .where(eq(tbl_admin.id, userId))
            .limit(1);

        if (admin) return { id: userId, userType: 'admin' };

        return null;
    } catch (err) {
        return null;
    }
}

/**
 * GET endpoint to debug book cover image issues
 * Displays all books with cover image URLs and their status
 */
export const GET: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all books with cover images
        const books = await db
            .select({
                id: tbl_book.id,
                title: tbl_book.title,
                coverImage: tbl_book.coverImage,
                isActive: tbl_book.isActive
            })
            .from(tbl_book)
            .where(eq(tbl_book.isActive, true))
            .limit(10);

        const coverImageData = books.map(book => ({
            id: book.id,
            title: book.title,
            hasCoverImage: !!book.coverImage,
            coverImageUrl: book.coverImage || null,
            testUrl: book.coverImage ? `/api/images/cover/${encodeURIComponent(book.coverImage.split('/api/images/cover/')[1] || '')}` : null,
            directTestUrl: book.coverImage ? `https://s3.${process.env.VITE_BACKBLAZE_REGION || 'us-east-005'}.backblazeb2.com/${process.env.VITE_BACKBLAZE_BUCKET_NAME || 'E-Kalibro'}/${book.coverImage.split('/api/images/cover/')[1] || ''}` : null
        }));

        return json({
            success: true,
            message: 'Debug info for book cover images',
            b2Config: {
                bucket: process.env.VITE_BACKBLAZE_BUCKET_NAME,
                region: process.env.VITE_BACKBLAZE_REGION,
                hasKeyId: !!process.env.VITE_BACKBLAZE_KEY_ID,
                hasAppKey: !!process.env.VITE_BACKBLAZE_APPLICATION_KEY
            },
            booksWithCovers: coverImageData,
            totalBooksWithCovers: books.filter(b => b.coverImage).length,
            totalBooks: books.length,
            instructions: {
                testProxyEndpoint: 'Visit /api/images/cover/covers/FILENAME to test proxy endpoint',
                viewBooksCoverList: 'This endpoint lists all books and their cover URLs',
                troubleshooting: 'Check browser console for 404/500 errors when loading images'
            }
        });
    } catch (err: any) {
        console.error('Debug endpoint error:', err);
        return json({
            error: 'Debug query failed',
            message: err.message
        }, { status: 500 });
    }
};
