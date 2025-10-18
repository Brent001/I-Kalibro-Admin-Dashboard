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
        throw redirect(302, '/');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        
        if (!userId) {
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

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
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

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
        cookies.delete('token', { path: '/' });
        throw redirect(302, '/');
    }
};