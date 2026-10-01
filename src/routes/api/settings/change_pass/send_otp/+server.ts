import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { createHash, randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { redisClient } from '$lib/server/db/cache.js';
import { verifyToken, type JWTPayload } from '$lib/server/db/auth.js';

const OTP_TTL_SECONDS = 10 * 60;
const RATE_TTL_SECONDS = 15 * 60;
const MAX_SENDS_PER_WINDOW = 5;

function maskEmail(email: string): string {
	const [name, domain] = email.split('@');
	if (!name || !domain) return 'your registered email';
	return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, name.length - 1))}@${domain}`;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	const user = token ? await verifyToken(token) : null;
	if (!user) return json({ success: false, message: 'Your session has expired. Sign in again.' }, { status: 401 });
	if (!user.email) return json({ success: false, message: 'No email is registered for this account.' }, { status: 400 });
	if (!env.VITE_RESEND_API_KEY) return json({ success: false, message: 'Email delivery is not configured.' }, { status: 503 });

	const sessionId = (jwt.decode(token!) as JWTPayload | null)?.sessionId;
	if (!sessionId) return json({ success: false, message: 'A valid session is required.' }, { status: 401 });

	const rateKey = `change_password_otp_rate:${user.userType}:${user.id}`;
	const rateRaw = await redisClient.get(rateKey);
	let rate = { count: 0, resetAt: Date.now() + RATE_TTL_SECONDS * 1000 };
	if (rateRaw) {
		try {
			rate = JSON.parse(rateRaw);
		} catch {
			rate = { count: 0, resetAt: Date.now() + RATE_TTL_SECONDS * 1000 };
		}
	}
	if (Date.now() > rate.resetAt) rate = { count: 0, resetAt: Date.now() + RATE_TTL_SECONDS * 1000 };
	if (rate.count >= MAX_SENDS_PER_WINDOW) {
		return json({ success: false, message: 'Too many verification codes requested. Try again in 15 minutes.' }, { status: 429 });
	}

	const rateTtl = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));
	if (!(await redisClient.setex(rateKey, rateTtl, JSON.stringify({ count: rate.count + 1, resetAt: rate.resetAt })))) {
		return json({ success: false, message: 'Verification is temporarily unavailable. Try again.' }, { status: 503 });
	}

	const otp = String(randomInt(100000, 1000000));
	const otpKey = `change_password_otp:${sessionId}`;
	const otpHash = createHash('sha256').update(`${sessionId}:${otp}`).digest('hex');
	const otpRecord = {
		otpHash,
		expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
		attempts: 0,
		userId: user.id,
		userType: user.userType,
		sessionId
	};

	if (!(await redisClient.setex(otpKey, OTP_TTL_SECONDS, JSON.stringify(otpRecord)))) {
		return json({ success: false, message: 'Verification is temporarily unavailable. Try again.' }, { status: 503 });
	}

	try {
		const resend = new Resend(env.VITE_RESEND_API_KEY);
		const sent = await resend.emails.send({
			from: 'i-Kalibro <system@i-kalibro.online>',
			to: user.email,
			subject: 'Password Change Verification Code',
			text: `Your password change verification code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`
		});
		if (sent.error) throw new Error('Email provider rejected the message');
		return json({ success: true, message: 'Verification code sent.', maskedEmail: maskEmail(user.email) });
	} catch (error) {
		await redisClient.del(otpKey);
		console.error('[change-password] Verification email delivery failed:', error);
		return json({ success: false, message: 'Could not send the verification code. Try again.' }, { status: 502 });
	}
};
