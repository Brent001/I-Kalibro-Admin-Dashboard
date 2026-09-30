export interface AuthSessionResult {
  ok: boolean;
  status: number;
  body: any;
}

let sessionRequest: Promise<AuthSessionResult> | null = null;

export function fetchAuthSession(): Promise<AuthSessionResult> {
  if (!sessionRequest) {
    sessionRequest = (async () => {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        // Keep status information available when the server returns no JSON.
      }
      return { ok: response.ok, status: response.status, body };
    })().finally(() => {
      sessionRequest = null;
    });
  }

  return sessionRequest;
}