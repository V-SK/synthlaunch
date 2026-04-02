import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { verifySignature } from '@/lib/auth';

const AI_AUTH_COOKIE = 'synth_ai_session';
const AI_AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const AI_AUTH_NONCE_TTL_MS = 10 * 60 * 1000;
const consumedChallengeTokens = new Set<string>();

type AiSessionPayload = {
  walletAddress: string;
  expiresAt: string;
  nonce: string;
};

type AiChallengePayload = {
  walletAddress: string;
  nonce: string;
  expiresAt: string;
  message: string;
};

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized.padEnd(normalized.length + (4 - (normalized.length % 4)), '=');
  return Buffer.from(padded, 'base64');
}

function getAiAuthSecret(): string {
  const secret =
    process.env.AI_SESSION_SECRET ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error('AI session secret is not configured');
  }

  return secret;
}

function signPayload(payload: string): string {
  return toBase64Url(
    createHmac('sha256', getAiAuthSecret()).update(payload).digest(),
  );
}

function normalizeWallet(walletAddress: string): string {
  return walletAddress.trim().toLowerCase();
}

export function createAiAuthMessage(input: {
  walletAddress: string;
  nonce: string;
  origin: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  return [
    'SynthLaunch AI Authentication',
    '',
    `Origin: ${input.origin}`,
    `Wallet: ${normalizeWallet(input.walletAddress)}`,
    'Chain: X Layer (196)',
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expires At: ${input.expiresAt}`,
    'Purpose: Unlock wallet-linked AI memory and trade actions.',
  ].join('\n');
}

export function createAiAuthNonce(): string {
  return randomUUID();
}

export function createAiChallengeToken(payload: AiChallengePayload): string {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifyAiChallengeToken(token: string | undefined): AiChallengePayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = signPayload(encoded);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encoded).toString('utf8')) as AiChallengePayload;
    if (
      !payload.walletAddress ||
      !payload.nonce ||
      !payload.expiresAt ||
      !payload.message
    ) {
      return null;
    }
    if (Date.parse(payload.expiresAt) <= Date.now()) {
      return null;
    }
    return {
      walletAddress: normalizeWallet(payload.walletAddress),
      nonce: payload.nonce,
      expiresAt: payload.expiresAt,
      message: payload.message,
    };
  } catch {
    return null;
  }
}

export function consumeAiChallengeToken(token: string | undefined): AiChallengePayload | null {
  if (!token || consumedChallengeTokens.has(token)) {
    return null;
  }
  const payload = verifyAiChallengeToken(token);
  if (!payload) {
    return null;
  }
  consumedChallengeTokens.add(token);
  return payload;
}

export function createAiSessionToken(walletAddress: string): {
  token: string;
  expiresAt: string;
} {
  const payload: AiSessionPayload = {
    walletAddress: normalizeWallet(walletAddress),
    expiresAt: new Date(Date.now() + AI_AUTH_TTL_MS).toISOString(),
    nonce: randomUUID(),
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encoded);
  return {
    token: `${encoded}.${signature}`,
    expiresAt: payload.expiresAt,
  };
}

export function verifyAiSessionToken(token: string | undefined): AiSessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = signPayload(encoded);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encoded).toString('utf8')) as AiSessionPayload;
    if (!payload.walletAddress || !payload.expiresAt) {
      return null;
    }
    if (Date.parse(payload.expiresAt) <= Date.now()) {
      return null;
    }
    return {
      walletAddress: normalizeWallet(payload.walletAddress),
      expiresAt: payload.expiresAt,
      nonce: payload.nonce,
    };
  } catch {
    return null;
  }
}

export function getAiAuthCookieName(): string {
  return AI_AUTH_COOKIE;
}

export function getAiSessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function clearAiSessionCookie() {
  cookies().set(AI_AUTH_COOKIE, '', {
    ...getAiSessionCookieOptions(0),
    expires: new Date(0),
  });
}

export function getAiAuthState() {
  const token = cookies().get(AI_AUTH_COOKIE)?.value;
  const payload = verifyAiSessionToken(token);
  return {
    authenticated: Boolean(payload),
    walletAddress: payload?.walletAddress ?? null,
    expiresAt: payload?.expiresAt ?? null,
  };
}

export function getAuthenticatedAiWallet(): string | null {
  const auth = getAiAuthState();
  return auth.authenticated ? auth.walletAddress ?? null : null;
}

export async function assertAiWalletSignature(input: {
  walletAddress: string;
  message: string;
  signature: `0x${string}`;
}): Promise<boolean> {
  const recovered = await verifySignature(input.message, input.signature);
  return recovered === normalizeWallet(input.walletAddress);
}
