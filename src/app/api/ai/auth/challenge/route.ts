import { NextRequest, NextResponse } from 'next/server';
import {
  AI_AUTH_NONCE_TTL_MS,
  createAiChallengeToken,
  createAiAuthMessage,
  createAiAuthNonce,
} from '@/lib/ai/auth';
import { createAiAuthNonceRecord, ensureAiUser } from '@/lib/ai/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    walletAddress?: string;
  };
  const walletAddress = body.walletAddress?.trim().toLowerCase();

  if (!walletAddress) {
    return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
  }

  const nonce = createAiAuthNonce();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + AI_AUTH_NONCE_TTL_MS).toISOString();
  await ensureAiUser(walletAddress);
  const message = createAiAuthMessage({
    walletAddress,
    nonce,
    origin: request.nextUrl.origin,
    issuedAt,
    expiresAt,
  });

  const persisted = await createAiAuthNonceRecord({
    walletAddress,
    nonce,
    message,
    expiresAt,
  });

  if (!persisted) {
    return NextResponse.json(
      { error: 'Failed to store AI auth challenge' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    walletAddress,
    nonce,
    message,
    expiresAt,
    challengeToken: createAiChallengeToken({
      walletAddress,
      nonce,
      expiresAt,
      message,
    }),
  });
}
