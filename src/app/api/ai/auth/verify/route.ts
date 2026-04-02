import { NextRequest, NextResponse } from 'next/server';
import {
  createAiSessionToken,
  getAiAuthCookieName,
  getAiSessionCookieOptions,
  assertAiWalletSignature,
  consumeAiChallengeToken,
} from '@/lib/ai/auth';
import { consumeAiAuthNonceRecord } from '@/lib/ai/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    walletAddress?: string;
    nonce?: string;
    signature?: `0x${string}`;
    challengeToken?: string;
  };

  const walletAddress = body.walletAddress?.trim().toLowerCase();
  const nonce = body.nonce?.trim();

  if (!walletAddress || !nonce || !body.signature) {
    return NextResponse.json(
      { error: 'Missing walletAddress, nonce or signature' },
      { status: 400 },
    );
  }

  const record = await consumeAiAuthNonceRecord({ walletAddress, nonce });
  const challengePayload = consumeAiChallengeToken(body.challengeToken);
  const fallbackRecord =
    challengePayload &&
    challengePayload.walletAddress === walletAddress &&
    challengePayload.nonce === nonce
      ? {
          message: challengePayload.message,
          expiresAt: challengePayload.expiresAt,
        }
      : null;
  const effectiveRecord = record ?? fallbackRecord;

  if (!effectiveRecord) {
    return NextResponse.json(
      { error: 'AI auth challenge is invalid or expired' },
      { status: 401 },
    );
  }

  const isValid = await assertAiWalletSignature({
    walletAddress,
    message: effectiveRecord.message,
    signature: body.signature,
  });

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid wallet signature' }, { status: 401 });
  }

  const { token, expiresAt } = createAiSessionToken(walletAddress);
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
  );

  const response = NextResponse.json({
    authenticated: true,
    walletAddress,
    expiresAt,
  });
  response.cookies.set(
    getAiAuthCookieName(),
    token,
    getAiSessionCookieOptions(maxAgeSeconds),
  );
  return response;
}
