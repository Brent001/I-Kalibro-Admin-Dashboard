import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { revokeToken, logSecurityEvent, getUserSessions, revokeAllUserSessions } from '$lib/server/db/auth.js';
import { redisClient } from '$lib/server/db/cache.js';
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
        
        // If token exists, extract user info and invalidate server-side
        if (token) {
            try {
                // Verify and decode token to get user info
                const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                userId = decoded.userId?.toString() || decoded.sub;
                sessionId = decoded.sessionId || decoded.jti;
                
                // Server-side token revocation using your session system
                if (sessionId) {
                    try {
                        await revokeToken(sessionId);
                    } catch (error) {
                        console.warn('Session revocation failed:', error);
                    }
                    
                    // Add token to blacklist in Redis (with expiration matching token TTL)
                    const tokenExp = decoded.exp ? (decoded.exp * 1000) - Date.now() : 3600000; // Default 1 hour
                    if (tokenExp > 0) {
                        await redisClient.setex(`blacklist:${token}`, Math.ceil(tokenExp / 1000), 'revoked');
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
                
            } catch (tokenError) {
                console.warn('Token verification failed during logout:', tokenError);
                // Continue with logout even if token is invalid
            }
        }

        // Handle refresh token revocation (if you implement refresh tokens later)
        if (refreshToken) {
            try {
                const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
                const decodedRefresh = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
                const refreshTokenId = decodedRefresh.jti || decodedRefresh.sessionId;
                if (refreshTokenId) {
                    await revokeToken(refreshTokenId, 'refresh');
                    await redisClient.setex(`blacklist:refresh:${refreshToken}`, 86400, 'revoked'); // 24 hours
                }
            } catch (refreshError) {
                console.warn('Refresh token verification failed during logout:', refreshError);
            }
        }

        // Clear all authentication cookies with proper options
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

        // Log security event for audit trail
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

        // Invalidate any cached user data
        if (userId) {
            try {
                await redisClient.del(`user:${userId}:profile`);
                await redisClient.del(`user:${userId}:permissions`);
                await redisClient.del(`user:${userId}:sessions`);
            } catch (error) {
                console.warn('Cache cleanup failed:', error);
            }
        }

        // Security headers for response
        const responseHeaders = new Headers({
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
        });

        const response = {
            success: true,
            message: 'Logged out successfully',
            data: {
                loggedOutAt: new Date().toISOString(),
                allDevicesLoggedOut: logoutAllDevices,
                processingTime: Date.now() - startTime
            }
        };

        return json(response, { 
            status: 200, 
            headers: responseHeaders 
        });

    } catch (validationError) {
        // Handle validation errors
        if (validationError instanceof z.ZodError) {
            return json(
                {
                    success: false,
                    message: 'Invalid request parameters',
                    errors: validationError.errors
                },
                { status: 400 }
            );
        }

        // Log unexpected errors
        console.error('Logout endpoint error:', validationError);
        
        // Still attempt to clear cookies even if server-side operations fail
        const cookieOptions = {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict' as const
        };

        cookies.delete('token', cookieOptions);
        cookies.delete('refresh_token', cookieOptions);
        cookies.delete('session_id', cookieOptions);

        // Log the error for security monitoring
        try {
            await logSecurityEvent({
                type: 'logout_error',
                userId: 'unknown',
                ip: clientIP,
                userAgent,
                error: validationError instanceof Error ? validationError.message : 'Unknown error',
                timestamp: new Date()
            });
        } catch (logError) {
            console.error('Security logging failed:', logError);
        }

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