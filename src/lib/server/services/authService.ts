import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '../db/auth.js';

export type UserType = 'super_admin' | 'admin' | 'staff' | 'user';

export interface AuthenticatedUser {
  id: number;
  userType: UserType;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Extract token from request
 */
export function extractToken(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fallback to cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map((c) => c.split('='))
    );
    return cookies.token || null;
  }

  return null;
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      userType: UserType;
    };

    return {
      id: decoded.userId,
      userType: decoded.userType
    };
  } catch (err) {
    console.error('Token verification failed:', err);
    return null;
  }
}

/**
 * Authenticate user from request
 */
export async function authenticateUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = extractToken(request);
  if (!token) {
    return null;
  }

  const user = verifyToken(token);
  if (!user) {
    return null;
  }

  // Check if session is revoked
  if (await isSessionRevoked(token)) {
    return null;
  }

  return user;
}

/**
 * Check if user has required permission
 */
export function hasPermission(user: AuthenticatedUser, requiredTypes: UserType[]): boolean {
  return requiredTypes.includes(user.userType);
}

/**
 * Check if user is staff or higher
 */
export function isStaffOrHigher(user: AuthenticatedUser): boolean {
  return hasPermission(user, ['super_admin', 'admin', 'staff']);
}
