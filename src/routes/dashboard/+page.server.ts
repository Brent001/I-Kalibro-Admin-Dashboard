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
            console.warn('User not found or inactive:', userId);
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

        // Prepare base response with user data
        const response = {
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role
            },
            dashboard: {} as any
        };

        // Try to fetch dashboard data, but don't fail if it's unavailable
        try {
            const dashboardResponse = await fetch('/api/dashboard', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `token=${token}` // Pass auth cookie if API needs it
                }
            });

            if (dashboardResponse.ok) {
                const dashboardResult = await dashboardResponse.json();
                
                if (dashboardResult.success && dashboardResult.data) {
                    response.dashboard = dashboardResult.data;
                }
            } else {
                console.warn('Dashboard API returned non-ok status:', dashboardResponse.status);
                // Set empty dashboard data as fallback
                response.dashboard = {
                    totalBooks: 0,
                    activeMembers: 0,
                    booksBorrowed: 0,
                    overdueBooks: 0,
                    recentActivity: [],
                    overdueBooksList: []
                };
            }
        } catch (dashboardError) {
            // Dashboard fetch failed, but user auth is valid
            console.warn('Dashboard data fetch failed:', dashboardError);
            
            // Provide empty dashboard data as fallback
            response.dashboard = {
                totalBooks: 0,
                activeMembers: 0,
                booksBorrowed: 0,
                overdueBooks: 0,
                recentActivity: [],
                overdueBooksList: []
            };
        }

        return response;

    } catch (error) {
        // Token is invalid or expired
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            console.warn('Invalid or expired token:', error.message);
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }
        
        // Database or other errors
        console.error('Dashboard page server load error:', error);
        
        // Still redirect to login on any auth error
        cookies.delete('token', { path: '/' });
        throw redirect(302, '/');
    }
};