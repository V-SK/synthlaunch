import { NextRequest, NextResponse } from 'next/server';
import { verifyFanFiMissionSignature } from '@/lib/fanfiProofAuth';
import { completeFanFiMission, getFanFiProgress, normalizeFanId } from '@/lib/localFanfiStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const fanId = normalizeFanId(new URL(request.url).searchParams.get('fanId'));
    const progress = await getFanFiProgress(fanId);
    return NextResponse.json(progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load FanFi progress';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fanId = normalizeFanId(body?.fanId);
    const missionId = body?.missionId || '';
    const proof = body?.proof || '';
    const proofAuth = await verifyFanFiMissionSignature({
      fanId,
      missionId,
      proof,
      wallet: body?.wallet,
      timestamp: body?.timestamp,
      signature: body?.signature,
      signatureMessage: body?.signatureMessage,
    });
    const profile = await completeFanFiMission({
      fanId,
      handle: body?.handle,
      wallet: proofAuth.wallet,
      missionId,
      proof,
    });
    const progress = await getFanFiProgress(profile.fanId);
    return NextResponse.json(progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save FanFi progress';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
