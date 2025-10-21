import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { staffAccount } from '$lib/server/db/schema/schema.js'; // updated import
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const load: PageServerLoad = async ({ cookies, url, fetch }) => {
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
                id: staffAccount.id,
                name: staffAccount.name,
                username: staffAccount.username,
                email: staffAccount.email,
                role: staffAccount.role,
                isActive: staffAccount.isActive
            })
            .from(staffAccount)
            .where(eq(staffAccount.id, userId))
            .limit(1);

        if (!user || !user.isActive) {
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

        // Fetch transactions from API
        const res = await fetch('/api/transactions');
        const transactions = res.ok ? await res.json().then(r => r.data.transactions) : [];

        return {
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role
            },
            transactions
        };

    } catch (error) {
        cookies.delete('token', { path: '/' });
        throw redirect(302, '/');
    }
};