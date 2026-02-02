import { NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, parseAbi, type Address } from 'viem';
import { bsc } from 'viem/chains';

export const dynamic = 'force-dynamic';

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7' as Address;
const BSC_RPC = 'https://bsc-dataseed.binance.org';

const CUSTODY_ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
  'function tokenClaimed(address token) external view returns (uint256)',
  'function tokenAgent(address token) external view returns (string)',
]);

// Cache
let leaderboardCache: LeaderboardEntry[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30s
let bnbPriceCache = 0;
let bnbPriceTimestamp = 0;

interface SupabaseToken {
  address: string;
  name: string;
  symbol: string;
  agent_name: string;
  tax_rate: number;
  created_at: string;
}

const PLATFORM_FEE_RATE = 0.20; // 20% platform protocol fee

interface LeaderboardEntry {
  rank: number;
  agentName: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  taxRate: number;
  totalFeesBnb: number;
  totalFeesUsd: number;
  claimedBnb: number;
  claimedUsd: number;
  pendingBnb: number;
  pendingUsd: number;
  createdAt: string;
}

const client = createPublicClient({
  chain: bsc,
  transport: http(BSC_RPC, { batch: true, retryCount: 3 }),
});

async function fetchBnbPrice(): Promise<number> {
  if (Date.now() - bnbPriceTimestamp < 120000 && bnbPriceCache > 0) {
    return bnbPriceCache;
  }
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    bnbPriceCache = data.binancecoin?.usd || 600;
    bnbPriceTimestamp = Date.now();
  } catch {
    if (bnbPriceCache === 0) bnbPriceCache = 600;
  }
  return bnbPriceCache;
}

async function fetchTokenList(): Promise<SupabaseToken[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tokens?select=address,name,symbol,agent_name,tax_rate,created_at&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.filter((t: any) => t.address?.startsWith('0x') && t.address.length === 42);
  } catch {
    return [];
  }
}

async function refreshLeaderboard(): Promise<void> {
  try {
    const [bnbPrice, tokens] = await Promise.all([
      fetchBnbPrice(),
      fetchTokenList(),
    ]);

    if (tokens.length === 0) return;

    // Read fees for all tokens from custody contract
    const entries: LeaderboardEntry[] = [];

    // Batch read: tokenFees + tokenClaimed for each token
    const calls = tokens.flatMap((t) => [
      {
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'tokenFees' as const,
        args: [t.address as Address],
      },
      {
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'tokenClaimed' as const,
        args: [t.address as Address],
      },
    ]);

    const results = await client.multicall({ contracts: calls });

    for (let i = 0; i < tokens.length; i++) {
      const feesResult = results[i * 2];
      const claimedResult = results[i * 2 + 1];

      const rawFeesBnb = feesResult.status === 'success'
        ? parseFloat(formatEther(feesResult.result as bigint))
        : 0;
      const rawClaimedBnb = claimedResult.status === 'success'
        ? parseFloat(formatEther(claimedResult.result as bigint))
        : 0;
      // Show agent's share after deducting platform fee (20%)
      const totalFeesBnb = rawFeesBnb * (1 - PLATFORM_FEE_RATE);
      const claimedBnb = rawClaimedBnb * (1 - PLATFORM_FEE_RATE);
      const pendingBnb = totalFeesBnb - claimedBnb;

      entries.push({
        rank: 0,
        agentName: tokens[i].agent_name || 'Unknown',
        tokenAddress: tokens[i].address,
        tokenName: tokens[i].name || 'Unknown',
        tokenSymbol: tokens[i].symbol || '???',
        taxRate: (tokens[i].tax_rate || 0) / 100,
        totalFeesBnb,
        totalFeesUsd: totalFeesBnb * bnbPrice,
        claimedBnb,
        claimedUsd: claimedBnb * bnbPrice,
        pendingBnb,
        pendingUsd: pendingBnb * bnbPrice,
        createdAt: tokens[i].created_at,
      });
    }

    // Sort by total fees descending
    entries.sort((a, b) => b.totalFeesBnb - a.totalFeesBnb);

    // Assign ranks
    entries.forEach((e, i) => { e.rank = i + 1; });

    leaderboardCache = entries;
    cacheTimestamp = Date.now();
  } catch (e) {
    console.error('[leaderboard] Error:', e);
  }
}

export async function GET() {
  try {
    if (Date.now() - cacheTimestamp > CACHE_TTL || leaderboardCache.length === 0) {
      await refreshLeaderboard();
    }

    // Filter out tokens with 0 fees
    const filtered = leaderboardCache.filter(e => e.totalFeesBnb > 0);

    return NextResponse.json({
      entries: filtered,
      totalEntries: filtered.length,
      cachedAt: cacheTimestamp,
    });
  } catch (e: any) {
    console.error('[leaderboard] GET error:', e);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
