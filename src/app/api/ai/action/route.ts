import { NextRequest, NextResponse } from 'next/server';
import { updateAiAction } from '@/lib/ai/store';
import { getAuthenticatedAiWallet } from '@/lib/ai/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const walletAddress = getAuthenticatedAiWallet();
  const body = (await request.json().catch(() => ({}))) as {
    actionId?: string;
    status?: string;
    txHash?: string | null;
    payload?: Record<string, unknown> | null;
  };

  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!body.actionId) {
    return NextResponse.json(
      { error: 'Missing actionId' },
      { status: 400 },
    );
  }

  try {
    const action = await updateAiAction(body.actionId, walletAddress, {
      status: body.status,
      txHash: body.txHash,
      payload: body.payload,
    });
    return NextResponse.json({ action });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update AI action';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
