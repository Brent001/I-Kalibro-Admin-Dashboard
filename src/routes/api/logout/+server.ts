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
        
        let userId: number | null = null;
        let sessionId: string | null = null;
        let logoutErrors: string[] = [];
        
        // If token exists, extract user info and invalidate server-side
        if (token) {
            try {
                // Verify and decode token to get user info
                const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                userId = parseInt(decoded.userId?.toString() || decoded.sub);
                sessionId = decoded.sessionId || decoded.jti;
                
                // Handle logout from all devices FIRST
                if (logoutAllDevices && userId) {
                    try {
                        console.log(`[LOGOUT] Starting logout all devices for user ${userId}`);
                        
                        // Get all active sessions for the user
                        const userSessions = await getUserSessions(userId);
                        console.log(`[LOGOUT] Found ${userSessions.length} active sessions`);
                        
                        // Revoke all user sessions in Redis
                        await revokeAllUserSessions(userId);
                        
                        // Add all session tokens to blacklist
                        // Note: We can't blacklist the actual tokens since we only store hashes
                        // Instead, we rely on the session revocation in Redis
                        for (const session of userSessions) {
                            try {
                                // The session invalidation in revokeAllUserSessions should handle this
                                // But we can also mark sessions as revoked
                                await redisClient.setex(
                                    `session:${session.id}:revoked`, 
                                    24 * 60 * 60, // 24 hours
                                    'logout_all_devices'
                                );
                            } catch (sessionError) {
                                console.warn(`Failed to revoke session ${session.id}:`, sessionError);
                                logoutErrors.push(`Session ${session.id} revocation failed`);
                            }
                        }
                        
                        console.log(`[LOGOUT] Successfully revoked ${userSessions.length} sessions for user ${userId}`);
                        
                    } catch (error) {
                        console.error('Multi-device logout failed:', error);
                        logoutErrors.push('Failed to logout from all devices');
                    }
                } else {
                    // Single device logout - just revoke current session
                    if (sessionId) {
                        try {
                            await revokeToken(sessionId);
                            console.log(`[LOGOUT] Revoked session ${sessionId}`);
                        } catch (error) {
                            console.warn('Current session revocation failed:', error);
                            logoutErrors.push('Current session revocation failed');
                        }
                    }
                }
                
                // Blacklist the current token (additional security layer)
                try {
                    const tokenExp = decoded.exp ? (decoded.exp * 1000) - Date.now() : 3600000; // Default 1 hour
                    if (tokenExp > 0) {
                        await redisClient.setex(`blacklist:${token}`, Math.ceil(tokenExp / 1000), 'revoked');
                    }
                } catch (error) {
                    console.warn('Token blacklisting failed:', error);
                    logoutErrors.push('Token blacklisting failed');
                }
                
            } catch (tokenError) {
                console.warn('Token verification failed during logout:', tokenError);
                logoutErrors.push('Token verification failed');
                // Continue with logout even if token is invalid
            }
        }

        // Handle refresh token revocation
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
                logoutErrors.push('Refresh token revocation failed');
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
                userId: userId?.toString() || 'anonymous',
                sessionId: sessionId || 'unknown',
                ip: clientIP,
                userAgent,
                reason,
                logoutAllDevices,
                timestamp: new Date(),
                metadata: {
                    processingTime: Date.now() - startTime,
                    errors: logoutErrors.length > 0 ? logoutErrors : undefined
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
                // Don't delete user sessions key here if we're doing single logout
                if (logoutAllDevices) {
                    await redisClient.del(`user:${userId}:sessions`);
                }
            } catch (error) {
                console.warn('Cache cleanup failed:', error);
                logoutErrors.push('Cache cleanup failed');
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

        // Determine response based on errors
        const hasErrors = logoutErrors.length > 0;
        const status = hasErrors ? 207 : 200; // 207 Multi-Status for partial success
        
        const response = {
            success: true,
            message: hasErrors 
                ? `Logout completed with ${logoutErrors.length} warning(s)` 
                : 'Logged out successfully',
            data: {
                loggedOutAt: new Date().toISOString(),
                allDevicesLoggedOut: logoutAllDevices,
                processingTime: Date.now() - startTime,
                ...(hasErrors && { errors: logoutErrors, partial: true })
            }
        };

        return json(response, { 
            status, 
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