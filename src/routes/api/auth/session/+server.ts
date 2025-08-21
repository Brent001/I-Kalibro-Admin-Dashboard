import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { account } from '$lib/server/db/schema/schema.js';
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
            
            if (jwtError instanceof jwt.TokenExpiredError) {
                return json(
                    {
                        success: false,
                        message: 'Authentication token has expired',
                        error: 'TOKEN_EXPIRED'
                    },
                    { status: 401 }
                );
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

        // Fetch user from database
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

        if (!user) {
            return json(
                {
                    success: false,
                    message: 'User not found',
                    error: 'USER_NOT_FOUND'
                },
                { status: 401 }
            );
        }

        if (!user.isActive) {
            return json(
                {
                    success: false,
                    message: 'User account is inactive',
                    error: 'USER_INACTIVE'
                },
                { status: 401 }
            );
        }

        // Return user session information
        const sessionData = {
            success: true,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    role: user.role,
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