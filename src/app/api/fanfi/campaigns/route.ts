import { NextRequest, NextResponse } from 'next/server';
import { FANFI_CAMPAIGN_TEMPLATES } from '@/lib/fanfiCampaigns';
import { verifyFanFiCampaignSignature } from '@/lib/fanfiProofAuth';
import { getFanFiCampaigns, upsertFanFiCampaign } from '@/lib/localFanfiCampaignStore';
import { normalizeFanId } from '@/lib/localFanfiStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const fanId = normalizeFanId(new URL(request.url).searchParams.get('fanId'));
    const campaigns = await getFanFiCampaigns(fanId);
    return NextResponse.json({ templates: FANFI_CAMPAIGN_TEMPLATES, campaigns });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load FanFi campaigns';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fanId = normalizeFanId(body?.fanId);
    const templateId = String(body?.templateId || '').trim();
    const objective = String(body?.objective || '').trim();
    const targetMatch = String(body?.targetMatch || '').trim();
    const tone = String(body?.tone || '').trim();

    // Auth: require a wallet-signed payload. Closes the prior issue where
    // anyone could POST a campaign to an arbitrary fan_id.
    const signatureAuth = await verifyFanFiCampaignSignature({
      fanId,
      templateId,
      objective,
      targetMatch,
      tone,
      wallet: body?.wallet,
      timestamp: body?.timestamp,
      signature: body?.signature,
      signatureMessage: body?.signatureMessage,
    });

    const campaign = await upsertFanFiCampaign({
      id: body?.id,
      fanId,
      templateId,
      objective,
      targetMatch,
      tone,
      tokenAddress: body?.tokenAddress || '',
      launchDraft: body?.launchDraft || '',
    });

    const campaigns = await getFanFiCampaigns(campaign.fanId);
    return NextResponse.json({
      templates: FANFI_CAMPAIGN_TEMPLATES,
      campaign,
      campaigns,
      wallet: signatureAuth.wallet,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save FanFi campaign';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
