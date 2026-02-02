import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, type Address } from 'viem';
import { bsc } from 'viem/chains';
import { SYNTHID_ABI, SYNTHID_ADDRESS } from '@/lib/synthid';

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org'),
});

/**
 * GET /api/synthid/check?platform=moltbook&platformId=AliceBTC
 * Check if an agent already has a SynthID
 */
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get('platform');
  const platformId = req.nextUrl.searchParams.get('platformId');

  if (!platform || !platformId) {
    return NextResponse.json({ error: 'platform and platformId required' }, { status: 400 });
  }

  try {
    const tokenId = await client.readContract({
      address: SYNTHID_ADDRESS as Address,
      abi: SYNTHID_ABI,
      functionName: 'getByPlatform',
      args: [platform, platformId],
    }) as bigint;

    if (tokenId > 0n) {
      return NextResponse.json({ exists: true, tokenId: Number(tokenId) });
    }
    return NextResponse.json({ exists: false });
  } catch (err) {
    return NextResponse.json({ error: 'RPC call failed' }, { status: 502 });
  }
}
