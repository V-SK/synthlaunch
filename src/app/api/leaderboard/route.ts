import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, defineChain, formatEther, http, parseAbi, type Address } from 'viem';
import { bsc } from 'viem/chains';
import { CHAIN_CONFIG, type SupportedChainId } from '@/lib/contracts';
import { readLocalTokens } from '@/lib/localTokenStore';

export const dynamic = 'force-dynamic';

const CUSTODY_ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
  'function tokenClaimed(address token) external view returns (uint256)',
  'function tokenAgent(address token) external view returns (string)',
]);

const xlayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: [CHAIN_CONFIG[196].rpc] } },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
});

const clients: Record<SupportedChainId, ReturnType<typeof createPublicClient>> = {
  56: createPublicClient({
    chain: bsc,
    transport: http(CHAIN_CONFIG[56].rpc, { batch: true, retryCount: 3 }),
  }),
  196: createPublicClient({
    chain: xlayer,
    transport: http(CHAIN_CONFIG[196].rpc, { batch: true, retryCount: 3 }),
  }),
};

const CACHE_TTL = 30000;
const PLATFORM_FEE_RATE = 0.20;
const HIDDEN_TOKENS = ['0xf0af019693179ae0fd4b92ec39068b16f4887777'];

interface SupabaseToken {
  address: string;
  name: string;
  symbol: string;
  agent_name: string;
  tax_rate: number;
  created_at: string;
}

interface LeaderboardEntry {
  rank: number;
  chainId: SupportedChainId;
  nativeSymbol: string;
  agentName: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  taxRate: number;
  totalFeesNative: number;
  totalFeesBnb: number;
  totalFeesUsd: number;
  claimedNative: number;
  claimedBnb: number;
  claimedUsd: number;
  pendingNative: number;
  pendingBnb: number;
  pendingUsd: number;
  createdAt: string;
}

type LeaderboardCache = {
  entries: LeaderboardEntry[];
  timestamp: number;
  lastKnownSupabase: SupabaseToken[];
};

const leaderboardCaches: Record<SupportedChainId, LeaderboardCache> = {
  56: { entries: [], timestamp: 0, lastKnownSupabase: [] },
  196: { entries: [], timestamp: 0, lastKnownSupabase: [] },
};

const nativePriceCache: Record<SupportedChainId, { price: number; timestamp: number }> = {
  56: { price: 0, timestamp: 0 },
  196: { price: 0, timestamp: 0 },
};

function parseChainId(request: NextRequest): SupportedChainId {
  const rawChainId = new URL(request.url).searchParams.get('chainId');
  return rawChainId === '196' ? 196 : 56;
}

async function fetchNativePrice(chainId: SupportedChainId): Promise<number> {
  const cached = nativePriceCache[chainId];
  if (Date.now() - cached.timestamp < 120000 && cached.price > 0) {
    return cached.price;
  }

  const config = chainId === 196
    ? { id: 'okb', fallback: 45 }
    : { id: 'binancecoin', fallback: 600 };

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${config.id}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    cached.price = data[config.id]?.usd || config.fallback;
    cached.timestamp = Date.now();
  } catch {
    if (cached.price === 0) {
      cached.price = config.fallback;
    }
  }

  return cached.price;
}

async function fetchTokenList(chainId: SupportedChainId): Promise<SupabaseToken[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  const cache = leaderboardCaches[chainId];
  const localTokens = await readLocalTokens(chainId);

  if (!supabaseUrl || !supabaseKey) return localTokens;

  const filter = chainId === 56
    ? 'or=(chain_id.eq.56,chain_id.is.null)'
    : `chain_id=eq.${chainId}`;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tokens?select=address,name,symbol,agent_name,tax_rate,created_at&${filter}&order=created_at.desc`,
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

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 400 && errText.includes('chain_id') && chainId === 56) {
        const fallback = await fetch(
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
        if (fallback.ok) {
          const data = await fallback.json();
          const valid = mergeTokens(filterValidTokens(data), localTokens);
          if (valid.length > 0) cache.lastKnownSupabase = valid;
          return valid;
        }
      }
      return mergeTokens(cache.lastKnownSupabase, localTokens);
    }

    const data = await res.json();
    const valid = mergeTokens(filterValidTokens(data), localTokens);
    if (valid.length > 0) {
      cache.lastKnownSupabase = valid;
    }
    return valid;
  } catch {
    return mergeTokens(cache.lastKnownSupabase, localTokens);
  }
}

function filterValidTokens(data: any[]): SupabaseToken[] {
  return data.filter((t: any) =>
    t.address?.startsWith('0x') &&
    t.address.length === 42 &&
    !HIDDEN_TOKENS.includes(t.address.toLowerCase())
  );
}

function mergeTokens(primary: SupabaseToken[], localTokens: SupabaseToken[]): SupabaseToken[] {
  const seen = new Set<string>();
  return [...localTokens, ...primary].filter((token) => {
    const key = token.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function refreshLeaderboard(chainId: SupportedChainId): Promise<void> {
  try {
    const [nativePriceUsd, tokens] = await Promise.all([
      fetchNativePrice(chainId),
      fetchTokenList(chainId),
    ]);

    if (tokens.length === 0) return;

    const nativeSymbol = CHAIN_CONFIG[chainId].nativeSymbol;
    const custodyAddress = CHAIN_CONFIG[chainId].custodyAddress as Address;
    const entries: LeaderboardEntry[] = [];

    const calls = tokens.flatMap((t) => [
      {
        address: custodyAddress,
        abi: CUSTODY_ABI,
        functionName: 'tokenFees' as const,
        args: [t.address as Address],
      },
      {
        address: custodyAddress,
        abi: CUSTODY_ABI,
        functionName: 'tokenClaimed' as const,
        args: [t.address as Address],
      },
    ]);

    const results = await clients[chainId].multicall({ contracts: calls });

    for (let i = 0; i < tokens.length; i++) {
      const feesResult = results[i * 2];
      const claimedResult = results[i * 2 + 1];

      const rawFeesNative = feesResult.status === 'success'
        ? parseFloat(formatEther(feesResult.result as bigint))
        : 0;
      const rawClaimedNative = claimedResult.status === 'success'
        ? parseFloat(formatEther(claimedResult.result as bigint))
        : 0;
      const totalFeesNative = rawFeesNative * (1 - PLATFORM_FEE_RATE);
      const claimedNative = rawClaimedNative * (1 - PLATFORM_FEE_RATE);
      const pendingNative = totalFeesNative - claimedNative;

      entries.push({
        rank: 0,
        chainId,
        nativeSymbol,
        agentName: tokens[i].agent_name || 'Unknown',
        tokenAddress: tokens[i].address,
        tokenName: tokens[i].name || 'Unknown',
        tokenSymbol: tokens[i].symbol || '???',
        taxRate: (tokens[i].tax_rate || 0) / 100,
        totalFeesNative,
        totalFeesBnb: totalFeesNative,
        totalFeesUsd: totalFeesNative * nativePriceUsd,
        claimedNative,
        claimedBnb: claimedNative,
        claimedUsd: claimedNative * nativePriceUsd,
        pendingNative,
        pendingBnb: pendingNative,
        pendingUsd: pendingNative * nativePriceUsd,
        createdAt: tokens[i].created_at,
      });
    }

    entries.sort((a, b) => b.totalFeesNative - a.totalFeesNative);
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    leaderboardCaches[chainId].entries = entries;
    leaderboardCaches[chainId].timestamp = Date.now();
  } catch (e) {
    console.error(`[leaderboard] chain=${chainId} error:`, e);
  }
}

export async function GET(request: NextRequest) {
  try {
    const chainId = parseChainId(request);
    const cache = leaderboardCaches[chainId];

    if (Date.now() - cache.timestamp > CACHE_TTL || cache.entries.length === 0) {
      await refreshLeaderboard(chainId);
    }

    const entries = cache.entries.filter((entry) => entry.totalFeesNative > 0);

    return NextResponse.json({
      chainId,
      nativeSymbol: CHAIN_CONFIG[chainId].nativeSymbol,
      entries,
      totalEntries: entries.length,
      cachedAt: cache.timestamp,
    });
  } catch (e: any) {
    console.error('[leaderboard] GET error:', e);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
