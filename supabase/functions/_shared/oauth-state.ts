// HMAC-SHA256 signed OAuth state to prevent CSRF attacks

const encoder = new TextEncoder();

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function createSignedState(payload: Record<string, string>): Promise<string> {
  const secret = Deno.env.get('OAUTH_STATE_SECRET') || Deno.env.get('PREVIEW_SECRET');
  if (!secret) throw new Error('Missing OAUTH_STATE_SECRET env var');

  const nonce = crypto.randomUUID();
  const timestamp = Date.now().toString();
  const data = JSON.stringify({ ...payload, nonce, timestamp });
  const dataB64 = btoa(data);

  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(dataB64));

  return `${dataB64}.${bufferToHex(sig)}`;
}

export async function verifySignedState(state: string): Promise<Record<string, string> | null> {
  const secret = Deno.env.get('OAUTH_STATE_SECRET') || Deno.env.get('PREVIEW_SECRET');
  if (!secret) throw new Error('Missing OAUTH_STATE_SECRET env var');

  const parts = state.split('.');
  if (parts.length !== 2) return null;

  const [dataB64, sigHex] = parts;

  const key = await getHmacKey(secret);
  const sigBuffer = hexToBuffer(sigHex);
  const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, encoder.encode(dataB64));

  if (!valid) return null;

  try {
    const data = JSON.parse(atob(dataB64));

    // Reject states older than 10 minutes
    const age = Date.now() - parseInt(data.timestamp, 10);
    if (age > 10 * 60 * 1000) return null;

    return data;
  } catch {
    return null;
  }
}
