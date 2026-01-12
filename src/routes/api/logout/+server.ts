import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { revokeToken, logSecurityEvent, getUserSessions, revokeAllUserSessions } from '$lib/server/db/auth.js';
import { redisClient } from '$lib/server/db/cache.js';
import { db } from '$lib/server/db/index.js';
import { securityLog } from '$lib/server/db/schema/schema.js';
import { z } from 'zod';

// Request validation schema
const logoutSchema = z.object({
    logoutAllDevices: z.boolean().optional().default(false),
    reason: z.enum(['user_logout', 'security_logout', 'admin_logout']).optional().default('user_logout')
});

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
    const startTime = Date.now();
    const clientIP = getClientAddress();
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
        // Parse request body for additional logout options
        let body;
        try {
            body = await request.json();
        } catch {
            body = {}; // Default to empty object if no body or invalid JSON
        }

        const { logoutAllDevices, reason } = logoutSchema.parse(body);

        // Get the current token from cookies
        const token = cookies.get('token');
        const refreshToken = cookies.get('refresh_token');

        let userId: string | null = null;
        let sessionId: string | null = null;

        // Extract user info from token if available (don't verify for speed)
        if (token) {
            try {
                const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
                const decoded = jwt.decode(token) as any; // Use decode instead of verify for speed
                userId = decoded?.userId?.toString() || decoded?.sub;
                sessionId = decoded?.sessionId || decoded?.jti;
            } catch (error) {
                console.warn('Token decode failed during logout:', error);
            }
        }

        // Clear all authentication cookies immediately
        const cookieOptions = {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict' as const,
        };

        cookies.delete('token', cookieOptions);
        cookies.delete('refresh_token', cookieOptions);
        cookies.delete('session_id', cookieOptions);
        cookies.delete('csrf_token', cookieOptions);

        // Return success response immediately
        const response = {
            success: true,
            message: 'Logged out successfully',
            data: {
                loggedOutAt: new Date().toISOString(),
                allDevicesLoggedOut: logoutAllDevices,
                processingTime: Date.now() - startTime
            }
        };

        // Perform cleanup operations asynchronously in the background
        setImmediate(async () => {
            try {
                // Blacklist tokens in Redis
                if (token) {
                    await redisClient.setex(`blacklist:${token}`, 3600, 'revoked'); // 1 hour
                }
                if (refreshToken) {
                    await redisClient.setex(`blacklist:refresh:${refreshToken}`, 86400, 'revoked'); // 24 hours
                }

                // Server-side token revocation
                if (sessionId) {
                    try {
                        await revokeToken(sessionId);
                    } catch (error) {
                        console.warn('Session revocation failed:', error);
                    }
                }

                // Handle logout from all devices
                if (logoutAllDevices && userId) {
                    try {
                        const userSessions = await getUserSessions(parseInt(userId));
                        await revokeAllUserSessions(parseInt(userId));

                        // Blacklist all user's tokens
                        for (const session of userSessions) {
                            if (session.token && session.token !== token) {
                                await redisClient.setex(`blacklist:${session.token}`, 3600, 'revoked');
                            }
                        }
                    } catch (error) {
                        console.warn('Multi-device logout failed:', error);
                    }
                }

                // Log security event
                try {
                    await logSecurityEvent({
                        type: 'logout',
                        userId: userId || 'anonymous',
                        sessionId: sessionId || 'unknown',
                        ip: clientIP,
                        userAgent,
                        reason,
                        logoutAllDevices,
                        timestamp: new Date(),
                        metadata: {
                            processingTime: Date.now() - startTime,
                        }
                    });
                } catch (error) {
                    console.warn('Security logging failed:', error);
                }

                // Invalidate cached user data
                if (userId) {
                    try {
                        await redisClient.del(`user:${userId}:profile`);
                        await redisClient.del(`user:${userId}:permissions`);
                        await redisClient.del(`user:${userId}:sessions`);
                    } catch (error) {
                        console.warn('Cache cleanup failed:', error);
                    }
                }
            } catch (error) {
                console.error('Background cleanup failed:', error);
            }
        });

        return json(response, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY'
            }
        });

    } catch (validationError) {
        // Handle validation errors
        if (validationError instanceof z.ZodError) {
            return json(
                {
                    success: false,
                    message: 'Invalid request parameters',
                    errors: validationError.issues
                },
                { status: 400 }
            );
        }

        // For any other errors, still clear cookies and return success
        console.error('Logout endpoint error:', validationError);

        const cookieOptions = {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict' as const
        };

        cookies.delete('token', cookieOptions);
        cookies.delete('refresh_token', cookieOptions);
        cookies.delete('session_id', cookieOptions);

        return json(
            {
                success: false,
                message: 'Logout completed with some errors',
                data: {
                    loggedOutAt: new Date().toISOString(),
                    partial: true
                }
            },
            { status: 207 } // Multi-status: partial success
        );
    }
};