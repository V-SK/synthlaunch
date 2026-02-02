import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_TTL = 60_000; // 1 minute
let statsCache: Record<string, unknown> | null = null;
let statsCacheTs = 0;

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const FALLBACK_STATS = {
  totalTokens: 0,
  totalReserveBnb: '0',
  totalMarketCap: '$0',
  activeTokens: 0,
  dexTokens: 0,
};

export async function GET(request: NextRequest) {
  // Return cache if fresh
  if (statsCache && Date.now() - statsCacheTs < CACHE_TTL) {
    return NextResponse.json(statsCache);
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const res = await fetch(`${baseUrl}/api/tokens`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (statsCache) return NextResponse.json(statsCache);
      return NextResponse.json(FALLBACK_STATS);
    }

    const tokens = await res.json();

    const totalTokens = tokens.length;
    const totalReserveBnb = tokens.reduce((sum: number, t: any) => sum + (t.reserve || 0), 0);
    const totalMarketCap = tokens.reduce((sum: number, t: any) => sum + (t.marketCap || 0), 0);
    const activeTokens = tokens.filter((t: any) => t.status === 1).length;
    const dexTokens = tokens.filter((t: any) => t.status === 4).length;

    const result = {
      totalTokens,
      totalReserveBnb: totalReserveBnb.toFixed(2),
      totalMarketCap: formatUsd(totalMarketCap),
      activeTokens,
      dexTokens,
    };

    // Only cache if we actually got tokens — avoid caching zeros after deploy
    if (totalTokens > 0) {
      statsCache = result;
      statsCacheTs = Date.now();
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('[stats] Error:', e);
    if (statsCache) return NextResponse.json(statsCache);
    return NextResponse.json(FALLBACK_STATS);
  }
}
