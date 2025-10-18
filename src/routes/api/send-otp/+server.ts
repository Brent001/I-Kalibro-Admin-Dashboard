import { json, error } from '@sveltejs/kit';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const POST = async ({ request }) => {
  const { email } = await request.json();
  if (!email) throw error(400, { message: 'Email required' });

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP to DB or cache here (not shown)

  // Send email
  await resend.emails.send({
    from: 'no-reply@yourdomain.com',
    to: email,
    subject: 'Your OTP Code',
    html: `<p>Your OTP code is <b>${otp}</b>. It expires in 5 minutes.</p>`
  });

  return json({ success: true });
};