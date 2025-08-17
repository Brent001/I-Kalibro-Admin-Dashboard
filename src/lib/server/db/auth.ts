// lib/server/auth.ts
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { account } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export interface AuthUser {
    id: number;
    name: string;
    username: string;
    email: string;
    role: 'admin' | 'staff';
    isActive: boolean;
}

export interface JWTPayload {
    userId: number;
    username: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
    iss: string;
    sub: string;
}

/**
 * Verify JWT token and return user data
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        
        // Fetch current user data from database
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
            .where(eq(account.id, decoded.userId))
            .limit(1);

        if (!user || !user.isActive) {
            return null;
        }

        return user as AuthUser;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(request: Request): string | null {
    // Try Authorization header first
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Try cookie as fallback
    const cookies = request.headers.get('Cookie');
    if (cookies) {
        const tokenMatch = cookies.match(/auth-token=([^;]+)/);
        if (tokenMatch) {
            return tokenMatch[1];
        }
    }

    return null;
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthUser, requiredRole: 'admin' | 'staff'): boolean {
    if (requiredRole === 'admin') {
        return user.role === 'admin';
    }
    if (requiredRole === 'staff') {
        return user.role === 'admin' || user.role === 'staff';
    }
    return false;
}

/**
 * Middleware-style authentication for SvelteKit
 */
export async function requireAuth(
    request: Request,
    requiredRole?: 'admin' | 'staff'
): Promise<{ user: AuthUser } | { error: Response }> {
    const token = extractToken(request);
    
    if (!token) {
        return {
            error: new Response(
                JSON.stringify({ success: false, message: 'Authentication required' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            )
        };
    }

    const user = await verifyToken(token);
    
    if (!user) {
        return {
            error: new Response(
                JSON.stringify({ success: false, message: 'Invalid or expired token' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            )
        };
    }

    if (requiredRole && !hasRole(user, requiredRole)) {
        return {
            error: new Response(
                JSON.stringify({ success: false, message: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            )
        };
    }

    return { user };
}

/**
 * Generate a new JWT token for user
 */
export function generateToken(user: AuthUser): string {
    const payload: Partial<JWTPayload> = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '7d',
        issuer: 'kalibro-library',
        subject: user.id.toString()
    });
}