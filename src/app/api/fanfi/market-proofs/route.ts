import { NextRequest, NextResponse } from 'next/server';
import { verifyFanFiReceiptSignature } from '@/lib/fanfiProofAuth';
import { createFanFiMarketProof, getFanFiMarketProofs } from '@/lib/localFanfiMarketProofStore';
import { normalizeFanId } from '@/lib/localFanfiStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const fanId = normalizeFanId(new URL(request.url).searchParams.get('fanId'));
    const launches = await getFanFiMarketProofs(fanId);
    return NextResponse.json({ launches });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load FanFi market proofs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fanId = normalizeFanId(body?.fanId);
    const objective = body?.objective || '';
    const targetMatch = body?.targetMatch || '';
    const tone = body?.tone || '';
    const templateId = body?.templateId || 'brazil';
    const proofAuth = await verifyFanFiReceiptSignature({
      fanId,
      templateId,
      objective,
      targetMatch,
      tone,
      wallet: body?.wallet,
      xLayerTxHash: body?.xLayerTxHash,
      timestamp: body?.timestamp,
      signature: body?.signature,
      signatureMessage: body?.signatureMessage,
    });
    const result = await createFanFiMarketProof({
      fanId,
      campaignId: body?.campaignId,
      templateId,
      objective,
      targetMatch,
      tone,
      wallet: proofAuth.wallet,
      walletSignature: proofAuth.signature,
      signatureMessage: proofAuth.signatureMessage,
      xLayerTxHash: proofAuth.xLayerTxHash,
    });
    const launches = await getFanFiMarketProofs(result.launch.fanId);
    return NextResponse.json({ ...result, launches });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create FanFi market proof';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
