import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_TTL = 60_000; // 1 minute
// Per-chain cache so BSC and X Layer don't share a snapshot.
const statsCacheByChain: Record<number, { data: Record<string, unknown>; ts: number }> = {};

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
  const { searchParams } = new URL(request.url);
  const rawChainId = searchParams.get('chainId');
  const chainId: 56 | 196 = rawChainId === '196' ? 196 : 56;

  // Return cache if fresh for this chain
  const cached = statsCacheByChain[chainId];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const baseUrl = new URL(request.url).origin;
    // Forward chainId so /api/tokens returns rows for the requested chain only.
    const res = await fetch(`${baseUrl}/api/tokens?chainId=${chainId}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (cached) return NextResponse.json(cached.data);
      return NextResponse.json(FALLBACK_STATS);
    }

    const tokens = await res.json();

    const totalTokens = tokens.length;
    // `reserve` and `marketCap` come from /api/tokens which already
    // computes them per-chain using the chain's native price feed, so
    // summing here is chain-correct.
    const totalReserveBnb = tokens.reduce((sum: number, t: any) => sum + (t.reserve || 0), 0);
    const totalMarketCap = tokens.reduce((sum: number, t: any) => sum + (t.marketCap || 0), 0);
    const activeTokens = tokens.filter((t: any) => t.status === 1).length;
    const dexTokens = tokens.filter((t: any) => t.status === 4).length;

    const result = {
      chainId,
      totalTokens,
      // Field name kept as `totalReserveBnb` for backward compat with
      // existing clients; the value is denominated in the chain's native
      // gas token (BNB on 56, OKB on 196).
      totalReserveBnb: totalReserveBnb.toFixed(2),
      totalMarketCap: formatUsd(totalMarketCap),
      activeTokens,
      dexTokens,
    };

    // Only cache if we actually got tokens — avoid caching zeros after deploy
    if (totalTokens > 0) {
      statsCacheByChain[chainId] = { data: result, ts: Date.now() };
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error(`[stats] chain=${chainId} Error:`, e);
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json(FALLBACK_STATS);
  }
}
