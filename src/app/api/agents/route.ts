import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MOLTBOARD_URL = 'https://moltboard-production.up.railway.app/api/agents/leaderboard';
const CACHE_TTL = 120_000; // 2 minutes

let cache: { data: unknown; ts: number } | null = null;

export async function GET() {
  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(MOLTBOARD_URL, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`MoltBoard API returned ${res.status}`);
    }

    const data = await res.json();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    // Return stale cache if available
    if (cache) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json(
      { error: 'MoltBoard API unavailable' },
      { status: 502 }
    );
  }
}
