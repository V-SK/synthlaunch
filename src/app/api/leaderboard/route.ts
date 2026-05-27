import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, parseAbi, defineChain, type Address, type PublicClient } from 'viem';
import { bsc } from '@/lib/chains';
import { CHAIN_CONFIG, type SupportedChainId } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

const CUSTODY_ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
  'function tokenClaimed(address token) external view returns (uint256)',
  'function tokenAgent(address token) external view returns (string)',
]);

const PLATFORM_FEE_RATE = 0.20; // 20% platform protocol fee

interface LeaderboardEntry {
  rank: number;
  agentName: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  taxRate: number;
  totalFeesBnb: number;     // amount in chain's NATIVE token (BNB or OKB)
  totalFeesUsd: number;
  claimedBnb: number;       // amount in chain's NATIVE token
  claimedUsd: number;
  pendingBnb: number;       // amount in chain's NATIVE token
  pendingUsd: number;
  createdAt: string;
}

interface SupabaseToken {
  address: string;
  name: string;
  symbol: string;
  agent_name: string;
  tax_rate: number;
  created_at: string;
  chain_id?: number;
}

const xlayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: [CHAIN_CONFIG[196].rpc] } },
});

interface ChainState {
  client: PublicClient;
  custodyAddress: Address;
  cache: LeaderboardEntry[];
  cacheTs: number;
  nativePriceUsd: number;
  nativePriceTs: number;
  nativeFallbackUsd: number;
  nativeCoingeckoId: string;
}

const CACHE_TTL = 30_000;
const PRICE_TTL = 120_000;

const chains: Record<SupportedChainId, ChainState> = {
  56: {
    client: createPublicClient({
      chain: bsc,
      transport: http(CHAIN_CONFIG[56].rpc, { batch: true, retryCount: 3 }),
    }) as PublicClient,
    custodyAddress: CHAIN_CONFIG[56].custodyAddress as Address,
    cache: [],
    cacheTs: 0,
    nativePriceUsd: 0,
    nativePriceTs: 0,
    nativeFallbackUsd: 600, // BNB
    nativeCoingeckoId: 'binancecoin',
  },
  196: {
    client: createPublicClient({
      chain: xlayer,
      transport: http(CHAIN_CONFIG[196].rpc, { batch: true, retryCount: 3 }),
    }) as PublicClient,
    custodyAddress: CHAIN_CONFIG[196].custodyAddress as Address,
    cache: [],
    cacheTs: 0,
    nativePriceUsd: 0,
    nativePriceTs: 0,
    nativeFallbackUsd: 40, // OKB
    nativeCoingeckoId: 'okb',
  },
};

async function fetchNativePrice(chainId: SupportedChainId): Promise<number> {
  const c = chains[chainId];
  if (Date.now() - c.nativePriceTs < PRICE_TTL && c.nativePriceUsd > 0) {
    return c.nativePriceUsd;
  }
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${c.nativeCoingeckoId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) },
    );
    const data = await res.json();
    c.nativePriceUsd = data[c.nativeCoingeckoId]?.usd || c.nativeFallbackUsd;
    c.nativePriceTs = Date.now();
  } catch {
    if (c.nativePriceUsd === 0) c.nativePriceUsd = c.nativeFallbackUsd;
  }
  return c.nativePriceUsd;
}

async function fetchTokenList(chainId: SupportedChainId): Promise<SupabaseToken[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return [];

  // BSC also accepts rows where chain_id is NULL (legacy data pre-migration).
  const filter = chainId === 56
    ? `or=(chain_id.eq.56,chain_id.is.null)`
    : `chain_id=eq.${chainId}`;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tokens?select=address,name,symbol,agent_name,tax_rate,created_at,chain_id&${filter}&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      const text = await res.text();
      // Fallback for old supabase instances missing the chain_id column
      if (res.status === 400 && text.includes('chain_id') && chainId === 56) {
        const fb = await fetch(
          `${supabaseUrl}/rest/v1/tokens?select=address,name,symbol,agent_name,tax_rate,created_at&order=created_at.desc`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Cache-Control': 'no-cache',
            },
            signal: AbortSignal.timeout(5000),
            cache: 'no-store',
          },
        );
        if (fb.ok) return await fb.json();
      }
      return [];
    }
    const data = await res.json();
    const HIDDEN_TOKENS = ['0xf0af019693179ae0fd4b92ec39068b16f4887777'];
    return data.filter((t: any) =>
      t.address?.startsWith('0x') &&
      t.address.length === 42 &&
      !HIDDEN_TOKENS.includes(t.address.toLowerCase()),
    );
  } catch {
    return [];
  }
}

async function refreshLeaderboard(chainId: SupportedChainId): Promise<void> {
  const c = chains[chainId];
  try {
    const [nativePrice, tokens] = await Promise.all([
      fetchNativePrice(chainId),
      fetchTokenList(chainId),
    ]);

    if (tokens.length === 0) {
      c.cache = [];
      c.cacheTs = Date.now();
      return;
    }

    const calls = tokens.flatMap((t) => [
      {
        address: c.custodyAddress,
        abi: CUSTODY_ABI,
        functionName: 'tokenFees' as const,
        args: [t.address as Address],
      },
      {
        address: c.custodyAddress,
        abi: CUSTODY_ABI,
        functionName: 'tokenClaimed' as const,
        args: [t.address as Address],
      },
    ]);

    const results = await c.client.multicall({ contracts: calls });

    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const feesResult = results[i * 2];
      const claimedResult = results[i * 2 + 1];

      const rawFeesNative = feesResult.status === 'success'
        ? parseFloat(formatEther(feesResult.result as bigint))
        : 0;
      const rawClaimedNative = claimedResult.status === 'success'
        ? parseFloat(formatEther(claimedResult.result as bigint))
        : 0;
      // Show agent's share after deducting platform fee (20%)
      const totalFeesNative = rawFeesNative * (1 - PLATFORM_FEE_RATE);
      const claimedNative = rawClaimedNative * (1 - PLATFORM_FEE_RATE);
      const pendingNative = totalFeesNative - claimedNative;

      entries.push({
        rank: 0,
        agentName: tokens[i].agent_name || 'Unknown',
        tokenAddress: tokens[i].address,
        tokenName: tokens[i].name || 'Unknown',
        tokenSymbol: tokens[i].symbol || '???',
        taxRate: (tokens[i].tax_rate || 0) / 100,
        totalFeesBnb: totalFeesNative,
        totalFeesUsd: totalFeesNative * nativePrice,
        claimedBnb: claimedNative,
        claimedUsd: claimedNative * nativePrice,
        pendingBnb: pendingNative,
        pendingUsd: pendingNative * nativePrice,
        createdAt: tokens[i].created_at,
      });
    }

    entries.sort((a, b) => b.totalFeesBnb - a.totalFeesBnb);
    entries.forEach((e, i) => { e.rank = i + 1; });

    c.cache = entries;
    c.cacheTs = Date.now();
  } catch (e) {
    console.error(`[leaderboard] chain=${chainId} Error:`, e);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawChainId = searchParams.get('chainId');
  const chainId: SupportedChainId = rawChainId === '196' ? 196 : 56;
  const c = chains[chainId];

  try {
    if (Date.now() - c.cacheTs > CACHE_TTL || c.cache.length === 0) {
      await refreshLeaderboard(chainId);
    }

    const filtered = c.cache.filter((e) => e.totalFeesBnb > 0);

    return NextResponse.json({
      chainId,
      entries: filtered,
      totalEntries: filtered.length,
      cachedAt: c.cacheTs,
    });
  } catch (e: any) {
    console.error(`[leaderboard] chain=${chainId} GET error:`, e);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
