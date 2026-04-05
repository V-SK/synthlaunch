import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MORALIS_API_KEY = process.env.MORALIS_API_KEY ?? '';
const STAKING_CONTRACT = '0xcdf39d6c55997f3f937287ba45c33d76bb98fe03';
const STAKE_SELECTOR = '0xa694fc3a';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min server-side cache

let cache: { addresses: string[]; ts: number } | null = null;

export async function GET() {
  // Serve from cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ addresses: cache.addresses });
  }

  if (!MORALIS_API_KEY) {
    return NextResponse.json({ error: 'Moralis API key not configured' }, { status: 500 });
  }

  try {
    const url = `https://deep-index.moralis.io/api/v2.2/${STAKING_CONTRACT}?chain=0x38&limit=100`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': MORALIS_API_KEY },
      next: { revalidate: 1800 }, // Next.js cache 30 min
    });

    if (!res.ok) throw new Error(`Moralis ${res.status}`);

    const data = await res.json();
    const txs: Array<{ input: string; from_address: string }> = data.result ?? [];

    const stakers = new Set<string>();
    for (const tx of txs) {
      if (tx.input?.startsWith(STAKE_SELECTOR)) {
        stakers.add(tx.from_address.toLowerCase());
      }
    }

    const addresses = Array.from(stakers);
    cache = { addresses, ts: Date.now() };
    return NextResponse.json({ addresses });
  } catch (e) {
    console.error('staking/addresses error:', e);
    // Return cached data even if stale on error
    if (cache) return NextResponse.json({ addresses: cache.addresses });
    return NextResponse.json({ error: 'failed to fetch addresses' }, { status: 500 });
  }
}
