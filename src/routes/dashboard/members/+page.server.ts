import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const load: PageServerLoad = async ({ cookies, url }) => {
    const token = cookies.get('token');
    
    if (!token) {
        throw redirect(302, '/');
    }

    try {
        // Check if session has been revoked (logout from all devices)
        if (await isSessionRevoked(token)) {
            console.warn('Session has been revoked');
            cookies.delete('token', { path: '/' });
            cookies.delete('refresh_token', { path: '/' });
            throw redirect(302, '/');
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        
        if (!userId) {
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

        // Use user data from JWT token (no database query needed)
        // Map userType to role for display purposes
        const userType = decoded.userType || decoded.role || 'user';
        const roleMap: { [key: string]: string } = {
            'super_admin': 'admin',
            'admin': 'admin',
            'staff': 'staff',
            'student': 'student',
            'faculty': 'faculty'
        };
        const role = roleMap[userType] || 'user';

        const user = {
            id: userId,
            username: decoded.username,
            email: decoded.email,
            role: role,
            isActive: true
        };

        return {
            user: {
                id: user.id,
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