import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { account } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const load: PageServerLoad = async ({ cookies, url }) => {
    const token = cookies.get('token');
    
    if (!token) {
        // Not logged in, redirect to login page
        throw redirect(302, '/');
    }

    try {
        // Verify and decode the JWT token
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        
        if (!userId) {
            console.warn('Token missing user ID');
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

        // Verify user still exists and is active in database
        const [user] = await db
            .select({
                id: account.id,
                name: account.name,
                username: account.username,
                email: account.email,
                role: account.role,
                isActive: account.isActive
            })
            .from(account)
            .where(eq(account.id, userId))
            .limit(1);

        if (!user || !user.isActive) {
            console.warn('User not found or inactive:', userId);
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

        // Return user data to the page component (optional)
        return {
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role
            }
        };

    } catch (error) {
        // Token is invalid or expired
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            console.warn('Invalid or expired token:', error.message);
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }
        
        // Database or other errors
        console.error('Dashboard auth check error:', error);
        
        // Still redirect to login on any auth error
        cookies.delete('token', { path: '/' });
        throw redirect(302, '/');
    }
};