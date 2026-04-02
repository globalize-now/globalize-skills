// TODO: This file is a temporary copy of api-client/src/device-auth.ts.
// Once @globalize-now/client is published, replace with an import from that package.
import { randomBytes, createHash } from 'node:crypto';
import { exec } from 'node:child_process';
import { platform } from 'node:os';

// ── PKCE ────────────────────────────────────────────────────────────────────

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

// ── Device code request ─────────────────────────────────────────────────────

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export async function requestDeviceCode(
  apiUrl: string,
  clientId: string,
  codeChallenge: string,
): Promise<DeviceCodeResponse> {
  const res = await fetch(`${apiUrl}/api/auth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to request device code: ${res.status} ${text}`);
  }

  return res.json() as Promise<DeviceCodeResponse>;
}

// ── Token polling ───────────────────────────────────────────────────────────

export interface TokenResponse {
  api_key: string;
  api_key_id: string;
  org: { id: string; name: string };
}

export class DeviceAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DeviceAuthError';
  }
}

export async function pollForToken(
  apiUrl: string,
  deviceCode: string,
  codeVerifier: string,
  interval: number,
  expiresIn: number,
): Promise<TokenResponse> {
  let pollInterval = interval * 1000; // seconds → ms
  const deadline = Date.now() + expiresIn * 1000;

  for (;;) {
    await sleep(pollInterval);

    if (Date.now() > deadline) {
      throw new DeviceAuthError('expired_token', 'Device code expired. Please restart the login flow.');
    }

    const res = await fetch(`${apiUrl}/api/auth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_code: deviceCode,
        code_verifier: codeVerifier,
      }),
    });

    if (res.ok) {
      return res.json() as Promise<TokenResponse>;
    }

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const error = body.error as string | undefined;

    if (error === 'authorization_pending') {
      continue;
    }
    if (error === 'slow_down') {
      pollInterval += 5000;
      continue;
    }
    if (error === 'expired_token') {
      throw new DeviceAuthError('expired_token', 'Device code expired. Please restart the login flow.');
    }
    if (error === 'access_denied') {
      throw new DeviceAuthError('access_denied', 'Authorization request was denied.');
    }

    throw new DeviceAuthError(
      error ?? 'unknown',
      `Unexpected error during device auth: ${JSON.stringify(body)}`,
    );
  }
}

// ── Browser open ────────────────────────────────────────────────────────────

export function openInBrowser(url: string): void {
  const os = platform();
  const cmd =
    os === 'darwin' ? 'open' :
    os === 'win32' ? 'start' :
    'xdg-open';

  // Note: on Windows, `start` does not reliably handle double-quoted URLs.
  // This is non-fatal — the user can always open the URL manually.
  exec(`${cmd} ${JSON.stringify(url)}`, (err) => {
    if (err) {
      // Non-fatal: user can open the URL manually
    }
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
