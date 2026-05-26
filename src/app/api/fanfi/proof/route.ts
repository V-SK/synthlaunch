import { NextRequest, NextResponse } from 'next/server';
import { FANFI_MISSIONS, getFanFiMission } from '@/lib/fanfiMissions';
import { getFanFiCampaigns } from '@/lib/localFanfiCampaignStore';
import { getFanFiMarketProofs } from '@/lib/localFanfiMarketProofStore';
import { getFanFiProgress, getFanFiTotalPoints } from '@/lib/localFanfiStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tokenAddress = request.nextUrl.searchParams.get('tokenAddress')?.trim().toLowerCase();

    if (!tokenAddress || !/^0x[a-f0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json({ error: 'Missing or invalid tokenAddress' }, { status: 400 });
    }

    const launches = await getFanFiMarketProofs();
    const launch = launches.find((item) => item.tokenAddress.toLowerCase() === tokenAddress);

    if (!launch) {
      return NextResponse.json({ error: 'FanFi proof not found' }, { status: 404 });
    }

    const [campaigns, progress] = await Promise.all([
      getFanFiCampaigns(launch.fanId),
      getFanFiProgress(launch.fanId),
    ]);
    const campaign =
      campaigns.find((item) => item.id === launch.campaignId) ||
      campaigns.find((item) => item.tokenAddress.toLowerCase() === tokenAddress) ||
      null;
    const rankedProfile =
      progress.leaderboard.find((item) => item.fanId === launch.fanId) ||
      ({
        ...progress.profile,
        rank: progress.leaderboard.length + 1,
        totalPoints: getFanFiTotalPoints(progress.profile),
      } as const);

    return NextResponse.json({
      launch,
      campaign,
      progress: {
        fanId: progress.profile.fanId,
        handle: progress.profile.handle,
        wallet: progress.profile.wallet,
        totalPoints: rankedProfile.totalPoints,
        rank: rankedProfile.rank,
        completedMissions: progress.profile.completions.length,
        totalMissions: FANFI_MISSIONS.length,
        completions: progress.profile.completions.map((completion) => ({
          ...completion,
          title: getFanFiMission(completion.missionId)?.title || completion.missionId,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load FanFi proof';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
