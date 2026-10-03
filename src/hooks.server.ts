import type { Handle } from '@sveltejs/kit';

const insecureSecrets = new Set([
  'your-super-secret-jwt-key-change-in-production',
  'your-super-secret-refresh-key-change-in-production'
]);

function isConfiguredSecret(secret: string | undefined): boolean {
  return Boolean(secret && secret.length >= 32 && !insecureSecrets.has(secret) && !/^<[^>]+>$/.test(secret));
}

export const handle: Handle = async ({ event, resolve }) => {
  if (
    process.env.NODE_ENV === 'production' &&
    (!isConfiguredSecret(process.env.JWT_SECRET) || !isConfiguredSecret(process.env.JWT_REFRESH_SECRET))
  ) {
    return new Response(JSON.stringify({ message: 'Server authentication is not configured.' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    });
  }

  return resolve(event);
};