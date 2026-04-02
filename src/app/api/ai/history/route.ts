import { NextRequest, NextResponse } from 'next/server';
import { getAiHistory, getOrCreateAiSession } from '@/lib/ai/store';
import { getAuthenticatedAiWallet } from '@/lib/ai/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestedSessionId =
    request.nextUrl.searchParams.get('sessionId')?.trim() ?? undefined;
  const walletAddress = getAuthenticatedAiWallet();

  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { session } = await getOrCreateAiSession(walletAddress, requestedSessionId);
    const history = await getAiHistory(walletAddress, session.id);
    return NextResponse.json({
      session,
      messages: history.messages,
      actions: history.actions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load AI history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
