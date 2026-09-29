import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

const sender = 'i-Kalibro <system@i-kalibro.online>';

export async function sendLibraryEmail(to: string, subject: string, html: string) {
  if (!env.VITE_RESEND_API_KEY) throw new Error('VITE_RESEND_API_KEY is not configured');

  const resend = new Resend(env.VITE_RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: sender, to, subject, html });
  if (error) throw new Error(error.message || 'Resend failed to send the email');
}