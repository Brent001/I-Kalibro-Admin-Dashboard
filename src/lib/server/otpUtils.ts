export const otpStorage = new Map<string, { otp: string; expiresAt: number; attempts: number }>();
export const rateLimitStorage = new Map<string, { count: number; resetAt: number }>();

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const limit = rateLimitStorage.get(email);

  if (!limit || now > limit.resetAt) {
    rateLimitStorage.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 minutes
    return true;
  }

  if (limit.count >= 5) {
    return false; // Max 5 attempts per 15 minutes
  }

  limit.count++;
  return true;
}