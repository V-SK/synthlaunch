import { NextRequest, NextResponse } from 'next/server';
import { FANFI_CAMPAIGN_TEMPLATES } from '@/lib/fanfiCampaigns';
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
    const campaign = await upsertFanFiCampaign({
      id: body?.id,
      fanId: body?.fanId,
      templateId: body?.templateId,
      objective: body?.objective || '',
      targetMatch: body?.targetMatch || '',
      tone: body?.tone || '',
      tokenAddress: body?.tokenAddress || '',
      launchDraft: body?.launchDraft || '',
    });
    const campaigns = await getFanFiCampaigns(campaign.fanId);
    return NextResponse.json({ templates: FANFI_CAMPAIGN_TEMPLATES, campaign, campaigns });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save FanFi campaign';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
