import { NextRequest, NextResponse } from 'next/server';
import { verifyFanFiReceiptSignature } from '@/lib/fanfiProofAuth';
import { getFanFiCampaignTemplate } from '@/lib/fanfiCampaigns';
import { createFanFiMarketProof, getFanFiMarketProofs } from '@/lib/localFanfiMarketProofStore';
import { completeFanFiMission, getFanFiProgress, normalizeFanId } from '@/lib/localFanfiStore';

export const dynamic = 'force-dynamic';

const AUDIT_MISSION_IDS = [
  'choose-campaign',
  'write-launch-draft',
  'submit-prediction',
  'create-fan-content',
  'launch-or-attach-token',
  'review-trading-flow',
];

function createMissionProof(params: {
  missionId: string;
  title: string;
  symbol: string;
  objective: string;
  targetMatch: string;
  tone: string;
  tokenAddress: string;
  txHash: string;
  receiptHash: string;
}): string {
  switch (params.missionId) {
    case 'choose-campaign':
      return `${params.title} selected for ${params.targetMatch}. Prediction format: ${params.objective}`;
    case 'write-launch-draft':
      return `${params.title} market brief: ${params.objective} Prepared for Synth SportFi Arena Season One launch.`;
    case 'submit-prediction':
      return `${params.targetMatch}: prediction prompt and settlement note prepared for match-day engagement.`;
    case 'create-fan-content':
      return `${params.symbol} prediction argument and meme prompt prepared in a ${params.tone} voice.`;
    case 'launch-or-attach-token':
      return params.txHash
        ? `X Layer tx proof: ${params.tokenAddress} / ${params.txHash}`
        : `Wallet-signed receipt proof: ${params.receiptHash}`;
    case 'review-trading-flow':
      return `Inspect OKB balance, search ${params.symbol} market asset, then route quote through OKX swap surfaces and wallet confirmation.`;
    default:
      return `${params.title} review proof`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const fanId = normalizeFanId(body?.fanId);
    const templateId = body?.templateId || 'brazil';
    const template = getFanFiCampaignTemplate(templateId);

    if (!template) {
      return NextResponse.json({ error: 'Unknown FanFi campaign template' }, { status: 400 });
    }

    const objective = body?.objective?.trim()
      || `Prepare ${template.name} as a private review flow for Synth SportFi Prediction Arena.`;
    const targetMatch = body?.targetMatch?.trim() || `${template.team} match day`;
    const tone = body?.tone?.trim() || 'high-energy, review-ready, community-first';
    const proofAuth = await verifyFanFiReceiptSignature({
      fanId,
      templateId: template.id,
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
      templateId: template.id,
      objective,
      targetMatch,
      tone,
      wallet: proofAuth.wallet,
      walletSignature: proofAuth.signature,
      signatureMessage: proofAuth.signatureMessage,
      xLayerTxHash: proofAuth.xLayerTxHash,
    });

    for (const missionId of AUDIT_MISSION_IDS) {
      await completeFanFiMission({
        fanId,
        handle: fanId,
        wallet: proofAuth.wallet,
        missionId,
        proof: createMissionProof({
          missionId,
          title: template.name,
          symbol: template.symbol,
          objective,
          targetMatch,
          tone,
          tokenAddress: result.launch.tokenAddress,
          txHash: result.launch.txHash,
          receiptHash: result.launch.receiptHash,
        }),
      });
    }

    const [progress, launches] = await Promise.all([
      getFanFiProgress(fanId),
      getFanFiMarketProofs(fanId),
    ]);

    return NextResponse.json({
      ...result,
      launches,
      progress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create FanFi review proof';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
