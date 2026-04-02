import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateAiSession,
  updateAiUser,
} from '@/lib/ai/store';
import { getAiAuthState, getAuthenticatedAiWallet } from '@/lib/ai/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim();
  const auth = getAiAuthState();

  if (!auth.authenticated || !auth.walletAddress) {
    return NextResponse.json({
      authenticated: false,
      walletAddress: null,
      expiresAt: null,
      user: null,
      session: null,
    });
  }

  try {
    const { user, session } = await getOrCreateAiSession(auth.walletAddress, sessionId);
    return NextResponse.json({
      authenticated: true,
      walletAddress: auth.walletAddress,
      expiresAt: auth.expiresAt,
      user,
      session,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load AI session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const walletAddress = getAuthenticatedAiWallet();
  const body = (await request.json().catch(() => ({}))) as {
    riskBias?: 'conservative' | 'balanced' | 'aggressive';
    preferredQuoteToken?: 'OKB' | 'USDT' | 'USDC';
    sessionId?: string;
  };

  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await updateAiUser(walletAddress, {
      riskBias: body.riskBias,
      preferredQuoteToken: body.preferredQuoteToken,
      lastSessionId: body.sessionId,
    });
    return NextResponse.json({
      authenticated: true,
      walletAddress,
      user,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update AI preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
