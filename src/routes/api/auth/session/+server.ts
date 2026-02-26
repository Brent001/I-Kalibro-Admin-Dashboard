import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { redisClient, isRedisConfigured } from '$lib/server/db/cache.js';
import { refreshAccessToken } from '$lib/server/db/auth.js';
import { db } from '$lib/server/db/index.js';
import { tbl_staff_session } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const GET: RequestHandler = async ({ request, getClientAddress, cookies }) => {
    const startTime = Date.now();
    const clientIP = getClientAddress();
    
    try {
        // Get token from cookies first, then fallback to Authorization header
        let token = cookies.get('token');
        
        if (!token) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            return json(
                {
                    success: false,
                    message: 'No authentication token provided',
                    error: 'MISSING_TOKEN'
                },
                { status: 401 }
            );
        }

        // Verify and decode JWT token
        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
            console.warn('JWT verification failed:', jwtError);

            // If token expired, attempt to refresh using refresh token cookie
            if (jwtError instanceof jwt.TokenExpiredError) {
                try {
                    const refreshToken = cookies.get('refresh_token');
                    if (refreshToken) {
                        const refreshed = await refreshAccessToken(refreshToken);
                        if (refreshed && refreshed.accessToken) {
                            // Set new access token cookie (httpOnly, secure in prod)
                            cookies.set('token', refreshed.accessToken, {
                                path: '/',
                                httpOnly: true,
                                secure: process.env.NODE_ENV === 'production',
                                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
                            });

                            // Verify new token and continue
                            decoded = jwt.verify(refreshed.accessToken, JWT_SECRET);
                        } else {
                            return json(
                                {
                                    success: false,
                                    message: 'Authentication token has expired',
                                    error: 'TOKEN_EXPIRED'
                                },
                                { status: 401 }
                            );
                        }
                    } else {
                        return json(
                            {
                                success: false,
                                message: 'Authentication token has expired',
                                error: 'TOKEN_EXPIRED'
                            },
                            { status: 401 }
                        );
                    }
                } catch (refreshErr) {
                    console.warn('Token refresh failed:', refreshErr);
                    return json(
                        {
                            success: false,
                            message: 'Authentication token has expired',
                            error: 'TOKEN_EXPIRED'
                        },
                        { status: 401 }
                    );
                }
            } else if (jwtError instanceof jwt.JsonWebTokenError) {
                return json(
                    {
                        success: false,
                        message: 'Invalid authentication token',
                        error: 'INVALID_TOKEN'
                    },
                    { status: 401 }
                );
            }

            throw jwtError;
        }

        // Prefer DB session checks (more reliable than Redis). If DB check fails,
        // fall back to Redis-only markers or JWT-only validation.
        if (decoded.sessionId) {
            try {
                const [sessionRow] = await db
                    .select({ sessionId: tbl_staff_session.sessionId, userId: tbl_staff_session.actorId, isActive: tbl_staff_session.isActive, expiresAt: tbl_staff_session.expiresAt })
                    .from(tbl_staff_session)
                    .where(eq(tbl_staff_session.sessionId, decoded.sessionId))
                    .limit(1);

                if (!sessionRow) {
                    // No DB session found - treat as revoked / invalid
                    return json({ success: false, message: 'Session not found', error: 'SESSION_NOT_FOUND' }, { status: 401 });
                }

                if (!sessionRow.isActive) {
                    return json({ success: false, message: 'Session is no longer active', error: 'SESSION_INACTIVE' }, { status: 401 });
                }

                if (sessionRow.expiresAt && new Date(sessionRow.expiresAt) <= new Date()) {
                    return json({ success: false, message: 'Session has expired', error: 'SESSION_EXPIRED' }, { status: 401 });
                }
            } catch (dbErr) {
                console.warn('DB session check failed, falling back to Redis/JWT checks:', dbErr);

                // Fallback: check Redis blacklist and session markers if available
                if (isRedisConfigured()) {
                    try {
                        const blacklistKey = `blacklist:${token}`;
                        const isBlacklisted = await redisClient.get(blacklistKey);
                        if (isBlacklisted === 'revoked' || isBlacklisted) {
                            return json({ success: false, message: 'Authentication token has been revoked', error: 'TOKEN_REVOKED' }, { status: 401 });
                        }

                        const revokedKey = `revoked:session:${decoded.sessionId}`;
                        const isRevoked = await redisClient.get(revokedKey);
                        if (isRevoked) {
                            return json({ success: false, message: 'Session has been revoked. Please login again.', error: 'SESSION_REVOKED' }, { status: 401 });
                        }

                        const sessionData = await redisClient.get(`session:${decoded.sessionId}`);
                        if (sessionData) {
                            const session: any = JSON.parse(sessionData);
                            if (!session.isActive) {
                                return json({ success: false, message: 'Session is no longer active', error: 'SESSION_INACTIVE' }, { status: 401 });
                            }
                        }
                    } catch (cacheErr) {
                        console.warn('Redis fallback checks failed, continuing with JWT-only validation:', cacheErr);
                    }
                }
            }
        }

        const userId = decoded.userId || decoded.id;
        
        if (!userId) {
            return json(
                {
                    success: false,
                    message: 'Token does not contain user information',
                    error: 'INVALID_TOKEN_PAYLOAD'
                },
                { status: 401 }
            );
        }

        // Use cached user data from JWT token instead of fetching from database (much faster)
        // The JWT already contains all necessary user info
        const user = {
            id: userId,
            uniqueId: decoded.uniqueId,
            username: decoded.username,
            email: decoded.email,
            userType: decoded.userType,
            isActive: true  // If token is valid, user is active
        };

        // Return user session information
        const sessionData = {
            success: true,
            data: {
                user: {
                    id: user.id,
                    uniqueId: user.uniqueId,
                    username: user.username,
                    email: user.email,
                    userType: user.userType,
                    isActive: user.isActive
                },
                sessionInfo: {
                    authenticatedAt: new Date().toISOString(),
                    ipAddress: clientIP,
                    processingTime: Date.now() - startTime,
                    tokenIssued: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null,
                    tokenExpires: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
                }
            }
        };

        // Security headers
        const responseHeaders = new Headers({
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff'
        });

        return json(sessionData, { 
            status: 200,
            headers: responseHeaders 
        });

    } catch (error) {
        console.error('Session endpoint error:', error);
        
        return json(
            {
                success: false,
                message: 'Failed to retrieve session information',
                error: 'INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
};

// Optional: Handle OPTIONS for CORS if needed
export const OPTIONS: RequestHandler = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
};