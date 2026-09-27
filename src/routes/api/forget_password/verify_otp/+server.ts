import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { redisClient } from '$lib/server/db/cache.js';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, otp } = await request.json();

    console.log(`[Verify OTP] Request received - email: ${email}, otp: ${otp}`);

    if (!email || !otp) {
      return json({ success: false, message: 'Email and OTP are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.trim();
    const key = `otp:${normalizedEmail}`;
    
    console.log(`[Verify OTP] Looking up key: ${key}`);

    // Get OTP data from Redis
    const storedRaw = await redisClient.get(key);
    console.log(`[Verify OTP] Raw data from Redis:`, storedRaw);

    if (!storedRaw) {
      console.log(`[Verify OTP] No OTP found in Redis for key: ${key}`);
      return json({ 
        success: false, 
        message: 'OTP not found or expired. Please request a new one.' 
      }, { status: 404 });
    }

    let stored;
    try {
      stored = JSON.parse(storedRaw);
      console.log(`[Verify OTP] Parsed OTP data:`, stored);
    } catch (parseError) {
      console.error(`[Verify OTP] Failed to parse Redis data:`, parseError);
      await redisClient.del(key);
      return json({ 
        success: false, 
        message: 'Invalid OTP data. Please request a new one.' 
      }, { status: 500 });
    }

    // Check if OTP has expired
    if (Date.now() > stored.expiresAt) {
      console.log(`[Verify OTP] OTP expired - Current: ${Date.now()}, Expires: ${stored.expiresAt}`);
      await redisClient.del(key);
      return json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      }, { status: 400 });
    }

    // Check if too many failed attempts
    if (stored.attempts >= 5) {
      console.log(`[Verify OTP] Too many attempts: ${stored.attempts}`);
      await redisClient.del(key);
      return json(
        { success: false, message: 'Too many failed attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // Verify OTP
    if (stored.otp !== normalizedOTP) {
      stored.attempts = (stored.attempts || 0) + 1;
      const remainingAttempts = 5 - stored.attempts;
      
      console.log(`[Verify OTP] Invalid OTP - Expected: ${stored.otp}, Got: ${normalizedOTP}, Attempts: ${stored.attempts}, Remaining: ${remainingAttempts}`);
      
      // Update attempts in Redis
      const ttl = Math.ceil((stored.expiresAt - Date.now()) / 1000);
      if (ttl > 0) {
        await redisClient.setex(key, ttl, JSON.stringify(stored));
        console.log(`[Verify OTP] Updated attempts in Redis`);
      }
      
      return json(
        { 
          success: false, 
          message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` 
        },
        { status: 400 }
      );
    }

    console.log(`[Verify OTP] OTP verified successfully for ${email}`);
    
    // Don't delete the OTP yet - we need it for the password reset
    // It will be deleted after password reset is complete
    
    return json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('[Verify OTP] Error:', error);
    return json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
};