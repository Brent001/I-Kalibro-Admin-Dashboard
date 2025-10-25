import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/index.js';
import { user, staffAccount } from '$lib/server/db/schema/schema.js';
import { eq, or } from 'drizzle-orm';
import { redisClient } from '$lib/server/db/cache.js';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function checkRateLimit(identifier: string): Promise<boolean> {
  const key = `otp_rate:${identifier.toLowerCase()}`;
  const data = await redisClient.get(key);
  
  console.log(`[Rate Limit Check] key: ${key}, data:`, data);
  
  let limit = null;
  
  if (data) {
    try {
      limit = JSON.parse(data);
    } catch (parseError) {
      console.error('[Rate Limit] Failed to parse rate limit data:', parseError);
      limit = null;
    }
  }
  
  const now = Date.now();

  if (!limit || now > limit.resetAt) {
    const newLimit = { count: 1, resetAt: now + 15 * 60 * 1000 };
    await redisClient.setex(key, 15 * 60, JSON.stringify(newLimit));
    console.log(`[Rate Limit] New limit set:`, newLimit);
    return true;
  }

  if (limit.count >= 5) {
    console.log(`[Rate Limit] Exceeded for ${identifier}`);
    return false;
  }

  limit.count++;
  const ttl = Math.ceil((limit.resetAt - now) / 1000);
  await redisClient.setex(key, ttl, JSON.stringify(limit));
  console.log(`[Rate Limit] Updated count: ${limit.count}`);
  return true;
}

const resend = new Resend(env.VITE_RESEND_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { identifier } = await request.json();

    console.log(`[Send OTP] Request received for identifier: ${identifier}`);

    if (!identifier || identifier.trim().length === 0) {
      return json({ success: false, message: 'Email or username is required' }, { status: 400 });
    }

    const trimmedIdentifier = identifier.trim();

    // Find user by email or username (user OR staff)
    let userRow = null;
    let isStaff = false;

    // Try user table
    [userRow] = await db
      .select({ 
        id: user.id, 
        email: user.email,
        username: user.username 
      })
      .from(user)
      .where(
        or(
          eq(user.email, trimmedIdentifier.toLowerCase()),
          eq(user.username, trimmedIdentifier)
        )
      )
      .limit(1);

    // If not found, try staff_account
    if (!userRow) {
      [userRow] = await db
        .select({ 
          id: staffAccount.id, 
          email: staffAccount.email,
          username: staffAccount.username 
        })
        .from(staffAccount)
        .where(
          or(
            eq(staffAccount.email, trimmedIdentifier.toLowerCase()),
            eq(staffAccount.username, trimmedIdentifier)
          )
        )
        .limit(1);
      if (userRow) isStaff = true;
    }

    if (!userRow) {
      console.log(`[Send OTP] No user found for: ${trimmedIdentifier}`);
      return json({ 
        success: false, 
        message: 'No account found with this email or username. Please check your credentials or contact support.' 
      }, { status: 404 });
    }

    const userEmail = userRow.email;
    
    if (!userEmail) {
      console.log(`[Send OTP] User has no email address`);
      return json({ 
        success: false, 
        message: 'No email associated with this account.' 
      }, { status: 400 });
    }
    
    console.log(`[Send OTP] User found, email: ${userEmail}`);

    // Normalize email for Redis key
    const normalizedEmail = userEmail.toLowerCase().trim();

    // Check rate limit
    if (!(await checkRateLimit(normalizedEmail))) {
      return json(
        { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
        { status: 429 }
      );
    }

    const key = `otp:${normalizedEmail}`;
    
    // Delete old OTP if exists (for resend functionality)
    const existingOTP = await redisClient.get(key);
    if (existingOTP) {
      await redisClient.del(key);
      console.log(`[Send OTP] Deleted old OTP for ${normalizedEmail}`);
    }

    // Generate NEW OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store NEW OTP in Redis with attempts counter
    const otpData = { 
      otp, 
      expiresAt, 
      attempts: 0,
      email: normalizedEmail,
      isStaff // <--- store this for later
    };
    
    const saved = await redisClient.setex(
      key,
      10 * 60, // 10 minutes TTL
      JSON.stringify(otpData)
    );

    if (!saved) {
      console.error('[Send OTP] Failed to save OTP to Redis');
      return json(
        { success: false, message: 'Failed to generate OTP. Please try again.' },
        { status: 500 }
      );
    }

    console.log(`[Send OTP] OTP saved to Redis:`, { key, otp, expiresAt });

    // Verify OTP was saved
    const verification = await redisClient.get(key);
    console.log(`[Send OTP] Verification read from Redis:`, verification);

    // Mask email for display
    const maskedEmail = normalizedEmail.replace(/^(.{2})(.*)(@.*)$/, (_, start, middle, domain) => {
      return start + '*'.repeat(middle.length) + domain;
    });

    // Send email
    try {
      await resend.emails.send({
        from: 'i-Kalibro <system@i-kalibro.online>',
        to: normalizedEmail,
        subject: 'Password Reset - OTP Verification',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #334155;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .container {
                  background: linear-gradient(to bottom right, #f8fafc, #f1f5f9);
                  border-radius: 12px;
                  padding: 40px;
                  border: 1px solid #e2e8f0;
                }
                .logo {
                  text-align: center;
                  margin-bottom: 30px;
                }
                .logo-box {
                  display: inline-block;
                  background: #0f172a;
                  padding: 12px;
                  border-radius: 8px;
                  margin-bottom: 10px;
                }
                .logo-text {
                  font-size: 24px;
                  font-weight: bold;
                  color: #0f172a;
                  margin: 0;
                }
                .otp-box {
                  background: white;
                  border: 2px solid #0f172a;
                  border-radius: 8px;
                  padding: 20px;
                  text-align: center;
                  margin: 30px 0;
                }
                .otp-code {
                  font-size: 36px;
                  font-weight: bold;
                  letter-spacing: 8px;
                  color: #0f172a;
                  margin: 0;
                }
                .warning {
                  background: #fef2f2;
                  border-left: 4px solid #ef4444;
                  padding: 12px;
                  border-radius: 4px;
                  margin-top: 20px;
                  font-size: 14px;
                }
                .footer {
                  text-align: center;
                  margin-top: 30px;
                  font-size: 12px;
                  color: #64748b;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-box">
                    <img src="https://i-kalibro.online/assets/logo/logo_email.png" alt="i-Kalibro Logo" width="32" height="32" style="display:block;margin:0 auto;" />
                  </div>
                  <p class="logo-text">i-Kalibro</p>
                </div>
                
                <h2 style="color: #0f172a; margin-bottom: 10px;">Password Reset Request</h2>
                <p>You requested to reset your password for your i-Kalibro account. Use the OTP code below to verify your identity:</p>
                
                <div class="otp-box">
                  <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
                  <p class="otp-code">${otp}</p>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #64748b;">Valid for 10 minutes</p>
                </div>
                
                <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                
                <div class="warning">
                  <strong>Security Notice:</strong> Never share this OTP with anyone. i-Kalibro staff will never ask for your OTP.
                </div>
                
                <div class="footer">
                  <p>© 2025 i-Kalibro Library Management System<br>Metro Dagupan Colleges</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      console.log(`[Send OTP] Email sent successfully to ${normalizedEmail}`);
      console.log(`[Send OTP] OTP for testing: ${otp}`);

      return json({ 
        success: true, 
        message: 'OTP has been sent to your email',
        email: normalizedEmail,
        maskedEmail: maskedEmail
      });
    } catch (emailError) {
      console.error('[Send OTP] Failed to send email:', emailError);
      // Delete the OTP if email fails
      await redisClient.del(key);
      return json(
        { success: false, message: 'Failed to send email. Please try again later.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Send OTP] Error:', error);
    return json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
};