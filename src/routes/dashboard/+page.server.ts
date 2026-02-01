import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { decryptData } from '$lib/utils/encryption.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const actions = {
    default: async ({ request }) => {
        // Default action - returns empty to prevent 405 errors
        return { success: true };
    },
    refreshDashboard: async ({ request, cookies, fetch }) => {
        // Action to refresh dashboard data
        const token = cookies.get('token');
        
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        try {
            const dashboardResponse = await fetch('/api/dashboard', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `token=${token}`
                }
            });
            
            if (dashboardResponse.ok) {
                const data = await dashboardResponse.json();
                return { success: true, data: data.data };
            }
            
            return { success: false, error: 'Failed to fetch dashboard data' };
        } catch (error) {
            console.error('Dashboard refresh error:', error);
            return { success: false, error: 'Error refreshing dashboard' };
        }
    }
};

export const load: PageServerLoad = async ({ cookies, url, fetch }) => {
    const token = cookies.get('token');
    
    if (!token) {
        // Not logged in, redirect to login page
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

        // Verify and decode the JWT token
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        
        if (!userId) {
            console.warn('Token missing user ID');
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

        // Use user data from JWT token (no database query needed)
        // The JWT data is already validated and contains all necessary user info
        const user = {
            id: userId,
            username: decoded.username,
            email: decoded.email,
            userType: decoded.userType,
            isActive: true
        };

        // Prepare base response with user data
        const response = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                userType: user.userType
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
                    try {
                        // Decrypt the data if it's encrypted
                        if (dashboardResult.encrypted) {
                            response.dashboard = decryptData(dashboardResult.data);
                        } else {
                            response.dashboard = dashboardResult.data;
                        }
                    } catch (decryptError) {
                        console.error('Failed to decrypt dashboard data:', decryptError);
                        // Fallback to empty data if decryption fails
                        response.dashboard = {
                            totalBooks: 0,
                            activeMembers: 0,
                            booksBorrowed: 0,
                            overdueBooks: 0,
                            recentActivity: [],
                            overdueBooksList: []
                        };
                    }
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