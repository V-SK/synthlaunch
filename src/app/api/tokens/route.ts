import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, parseAbi, getAddress, type Address } from 'viem';
import { bsc, xlayer } from '@/lib/chains';
import { CHAIN_CONFIG, type SupportedChainId } from '@/lib/contracts';
import { getFanFiMarketProofs } from '@/lib/localFanfiMarketProofStore';
import { readLocalTokens } from '@/lib/localTokenStore';

export const dynamic = 'force-dynamic';

// --- Constants ---
const BILLION = 1000000000;
const CACHE_TTL = 15000; // 45 seconds

function getViemChain(chainId: SupportedChainId) {
  return chainId === 196 ? xlayer : bsc;
}

const PORTAL_ABI = parseAbi([
  'function getTokenV5(address token) external view returns ((uint8,uint256,uint256,uint256,uint8,uint256,uint256,uint256,uint256,address,bool,bytes32))',
]);

// --- Bonding curve math ---
function estimateReserve(r: number, h: number, k: number, supply: number): number {
  const denom = BILLION + h - supply;
  if (denom <= 0) return 0;
  return k / denom - r;
}

// --- Cache ---
interface CachedToken {
  address: string;
  name: string;
  symbol: string;
  meta: string;
  image: string;
  description: string;
  creator: string;
  agent_name: string;
  taxRate: number;
  price: number;
  priceUsd: number;
  marketCap: number;
  marketCapBnb: number;
  circulatingSupply: number;
  status: number;
  progress: number;
  createdAt: number;
  reserve: number;
  r: number;
  h: number;
  k: number;
  dexSupplyThreshold: number;
}

// Per-chain cache so BSC and X Layer don't stomp on each other.
interface ChainCache {
  tokens: CachedToken[];
  timestamp: number;
  isFetching: boolean;
  fetchStartTime: number;
  refreshPromise: Promise<void> | null;
  lastKnownSupabase: SupabaseToken[];
  lastRefreshDebug: string;
  client: ReturnType<typeof createPublicClient>;
}

const chainCaches: Record<SupportedChainId, ChainCache> = {
  56: {
    tokens: [],
    timestamp: 0,
    isFetching: false,
    fetchStartTime: 0,
    refreshPromise: null,
    lastKnownSupabase: [],
    lastRefreshDebug: '',
    client: createPublicClient({
      chain: bsc,
      transport: http(CHAIN_CONFIG[56].rpc, { batch: true, retryCount: 3 }),
    }),
  },
  196: {
    tokens: [],
    timestamp: 0,
    isFetching: false,
    fetchStartTime: 0,
    refreshPromise: null,
    lastKnownSupabase: [],
    lastRefreshDebug: '',
    client: createPublicClient({
      chain: xlayer,
      transport: http(CHAIN_CONFIG[196].rpc, { batch: true, retryCount: 3 }),
    }),
  },
};

let bnbPriceCache = 0;
let bnbPriceTimestamp = 0;

// --- BNB Price ---
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

// --- IPFS Metadata ---
async function fetchMeta(cid: string): Promise<{ name: string; description: string; image: string }> {
  if (!cid || cid.length < 10) {
    return { name: '', description: '', image: '' };
  }
  try {
    const url = `https://ipfs.io/ipfs/${cid}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { name: '', description: '', image: '' };
    const data = await res.json();
    let image = data.image || '';
    if (image && !image.startsWith('http') && !image.startsWith('data:')) {
      image = `https://ipfs.io/ipfs/${image}`;
    }
    return { name: data.name || '', description: data.description || '', image };
  } catch {
    return { name: '', description: '', image: '' };
  }
}

// --- Fetch token list from Supabase ---
interface SupabaseToken {
  address: string;
  name: string;
  symbol: string;
  meta: string;
  creator: string;
  agent_name: string;
  tax_rate: number;
  created_at: string;
  tx_hash?: string;
  launch_type?: string;
}

function isFanFiMarketProofTokenInfo(info: SupabaseToken): boolean {
  return (
    info.launch_type === 'fanfi-market-proof' ||
    info.launch_type === 'fanfi-demo' ||
    info.tx_hash?.startsWith('local-proof-') ||
    info.tx_hash?.startsWith('local-demo-') ||
    info.meta?.startsWith('sportfi-prediction-proof:') ||
    info.meta?.startsWith('fanfi-demo:')
  );
}

function createFanFiMarketProofToken(info: SupabaseToken, _nativePriceUsd: number): CachedToken | null {
  if (!isFanFiMarketProofTokenInfo(info)) return null;

  // SportFi prediction receipts are not tradeable assets. They surface in
  // /tokens so users can see the X Layer prediction activity feed, but all
  // financial fields stay zero — there is no bonding curve, no market price,
  // no real market cap. The "address" is the receipt identity hash, not a
  // deployed ERC-20 contract.
  return {
    address: info.address,
    name: info.name || 'FanFi Prediction Receipt',
    symbol: info.symbol || 'FANFI',
    meta: info.meta,
    image: '/fanfi-logo.png',
    description:
      'SportFi prediction receipt. Wallet-signed proof of a prediction submission; not a tradeable asset.',
    creator: info.creator || '',
    agent_name: info.agent_name || 'tw:SynthFanFi',
    taxRate: (info.tax_rate || 200) / 100,
    price: 0,
    priceUsd: 0,
    marketCap: 0,
    marketCapBnb: 0,
    circulatingSupply: 0,
    status: 1,
    progress: 0,
    createdAt: info.created_at ? Math.floor(new Date(info.created_at).getTime() / 1000) : 0,
    reserve: 0,
    r: 0,
    h: 0,
    k: 0,
    dexSupplyThreshold: 0,
  };
}

async function filterValidFanFiProofTokens(tokens: SupabaseToken[]): Promise<SupabaseToken[]> {
  if (!tokens.some(isFanFiMarketProofTokenInfo)) return tokens;

  const validProofs = await getFanFiMarketProofs();
  const validProofAddresses = new Set(validProofs.map((proof) => proof.tokenAddress.toLowerCase()));

  return tokens.filter((token) =>
    !isFanFiMarketProofTokenInfo(token) || validProofAddresses.has(token.address.toLowerCase())
  );
}

async function fetchTokenList(chainId: SupportedChainId): Promise<SupabaseToken[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  const cache = chainCaches[chainId];
  const localTokens = await filterValidFanFiProofTokens(await readLocalTokens(chainId));

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[tokens] Supabase not configured; using local dev token store');
    return localTokens;
  }

  // chain_id column may not yet exist in older supabase instances; the
  // default filter `chain_id=eq.<n>` is safe after running migration 008.
  // For BSC we also accept rows missing the column (treated as legacy BSC).
  const filter = chainId === 56
    ? `or=(chain_id.eq.56,chain_id.is.null)`
    : `chain_id=eq.${chainId}`;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tokens?select=*&${filter}&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
        },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[tokens] Supabase error:', res.status, errText);
      // Fallback: if chain_id column is missing, the or= filter will 400.
      // Retry without filter and tag everything as the requested chain.
      if (res.status === 400 && errText.includes('chain_id')) {
        console.warn('[tokens] chain_id column missing — falling back to unfiltered query');
        const fallback = await fetch(`${supabaseUrl}/rest/v1/tokens?select=*&order=created_at.desc`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Cache-Control': 'no-cache, no-store',
          },
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        });
        if (fallback.ok && chainId === 56) {
          const data = await fallback.json();
          const HIDDEN_TOKENS = ['0xf0af019693179ae0fd4b92ec39068b16f4887777'];
          const valid = await filterValidFanFiProofTokens(data.filter((t: any) => t.address && t.address.startsWith('0x') && t.address.length === 42 && !HIDDEN_TOKENS.includes(t.address.toLowerCase())));
          const merged = mergeTokens(valid, localTokens);
          if (merged.length > 0) cache.lastKnownSupabase = merged;
          return merged;
        }
      }
      if (cache.lastKnownSupabase.length > 0) {
        console.log('[tokens] Using last-known-good Supabase data as fallback');
        return mergeTokens(cache.lastKnownSupabase, localTokens);
      }
      return localTokens;
    }

    const data = await res.json();
    const HIDDEN_TOKENS = ['0xf0af019693179ae0fd4b92ec39068b16f4887777'];
    const valid = await filterValidFanFiProofTokens(data.filter((t: any) => t.address && t.address.startsWith('0x') && t.address.length === 42 && !HIDDEN_TOKENS.includes(t.address.toLowerCase())));
    console.log(`[tokens] chain=${chainId} Supabase raw=${data.length} valid=${valid.length}`);
    const merged = mergeTokens(valid, localTokens);
    if (merged.length > 0) {
      cache.lastKnownSupabase = merged;
    }
    return merged;
  } catch (e) {
    console.error('[tokens] Failed to fetch from Supabase:', e);
    if (cache.lastKnownSupabase.length > 0) {
      console.log('[tokens] Using last-known-good Supabase data as fallback');
      return mergeTokens(cache.lastKnownSupabase, localTokens);
    }
    return localTokens;
  }
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

// --- Main data fetch ---
async function refreshTokens(chainId: SupportedChainId): Promise<void> {
  const cache = chainCaches[chainId];
  const PORTAL_ADDRESS = CHAIN_CONFIG[chainId].flapAddress as Address;

  // Reset stale lock (stuck for > 30s)
  if (cache.isFetching && Date.now() - cache.fetchStartTime > 30000) {
    console.warn(`[tokens] chain=${chainId} Resetting stale isFetching lock`);
    cache.isFetching = false;
    cache.refreshPromise = null;
  }
  if (cache.isFetching) {
    if (cache.refreshPromise) await cache.refreshPromise;
    return;
  }
  cache.isFetching = true;
  cache.fetchStartTime = Date.now();
  cache.refreshPromise = (async () => {

    try {
      const [bnbPrice, supabaseTokens] = await Promise.all([
        fetchBnbPrice(),
        fetchTokenList(chainId),
      ]);

      if (supabaseTokens.length === 0) {
        console.log(`[tokens] chain=${chainId} No tokens from Supabase, keeping existing cache`);
        cache.isFetching = false;
        return;
      }
      const debugParts: string[] = [`chain=${chainId}`, `sb=${supabaseTokens.length}`, `addrs=${supabaseTokens.map(t=>t.address?.slice(0,6)).join('|')}`];

      const tokens: CachedToken[] = [];

      // Process in batches of 10
      for (let i = 0; i < supabaseTokens.length; i += 10) {
        const batch = supabaseTokens.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map(async (info) => {
            try {
              const marketProofToken = createFanFiMarketProofToken(info, bnbPrice);
              if (marketProofToken) return marketProofToken;

              const result = await cache.client.readContract({
                address: PORTAL_ADDRESS,
                abi: PORTAL_ABI,
                functionName: 'getTokenV5',
                args: [getAddress(info.address) as Address],
              }) as any;

              const status = Number(result[0]);
              const reserve = parseFloat(formatEther(result[1]));
              const circulatingSupply = parseFloat(formatEther(result[2]));
              const priceBnb = parseFloat(formatEther(result[3]));
              const r = parseFloat(formatEther(result[5]));
              const h = parseFloat(formatEther(result[6]));
              const k = parseFloat(formatEther(result[7]));
              const dexSupplyThreshold = parseFloat(formatEther(result[8]));

              let priceUsd = priceBnb * bnbPrice;
              let marketCapBnb = priceBnb * BILLION;
              let marketCapUsd = marketCapBnb * bnbPrice;

              let progress = 0;
              if (status === 4) {
                progress = 1;
                // DEX tokens: bonding curve data is zeroed, try DexScreener
                if (marketCapUsd === 0) {
                  try {
                    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${info.address}`, {
                      signal: AbortSignal.timeout(5000),
                    });
                    const dexData = await dexRes.json();
                    const pair = dexData.pairs?.[0];
                    if (pair) {
                      priceUsd = parseFloat(pair.priceUsd || '0');
                      marketCapUsd = pair.fdv || pair.marketCap || 0;
                      marketCapBnb = bnbPrice > 0 ? marketCapUsd / bnbPrice : 0;
                    }
                  } catch {
                    // DexScreener unavailable, keep zeros
                  }
                }
              } else if (dexSupplyThreshold > 0) {
                const currentReserve = estimateReserve(r, h, k, circulatingSupply);
                const targetReserve = estimateReserve(r, h, k, dexSupplyThreshold);
                if (targetReserve > 0) {
                  progress = Math.min(1, Math.max(0, currentReserve / targetReserve));
                }
              }

              // Fetch IPFS metadata
              const meta = await fetchMeta(info.meta);

              return {
                address: info.address,
                name: meta.name || info.name,
                symbol: info.symbol,
                meta: info.meta,
                image: meta.image,
                description: meta.description,
                creator: info.creator,
                agent_name: info.agent_name || '',
                taxRate: (info.tax_rate || 0) / 100,
                price: priceBnb,
                priceUsd,
                marketCap: marketCapUsd,
                marketCapBnb,
                circulatingSupply,
                status,
                progress,
                createdAt: info.created_at ? Math.floor(new Date(info.created_at).getTime() / 1000) : 0,
                reserve,
                r,
                h,
                k,
                dexSupplyThreshold,
              } as CachedToken;
            } catch (e: any) {
              console.error(`[tokens] Failed for ${info.address}: ${e.message || e}`);
              // Return a minimal entry so the token still shows
              return {
                address: info.address,
                name: info.name || info.agent_name || 'Unknown',
                symbol: info.symbol || '???',
                meta: '',
                image: '',
                description: '',
                creator: info.creator || '',
                agent_name: info.agent_name || '',
                taxRate: (info.tax_rate || 0) / 100,
                price: 0,
                priceUsd: 0,
                marketCap: 0,
                marketCapBnb: 0,
                circulatingSupply: 0,
                status: -1,
                progress: 0,
                createdAt: info.created_at ? Math.floor(new Date(info.created_at).getTime() / 1000) : 0,
                reserve: 0,
                r: 0,
                h: 0,
                k: 0,
                dexSupplyThreshold: 0,
              } as CachedToken;
            }
          })
        );

        for (let ri = 0; ri < results.length; ri++) {
          const r = results[ri];
          if (r.status === 'fulfilled' && r.value) {
            tokens.push(r.value);
          } else if (r.status === 'rejected') {
            console.error(`[tokens] Rejected token ${batch[ri]?.address}:`, r.reason?.message || r.reason);
          }
        }
      }

      debugParts.push(`ok=${tokens.length}`);
      cache.lastRefreshDebug = debugParts.join(',');
      cache.tokens = tokens;
      cache.timestamp = Date.now();
    } catch (e) {
      console.error(`[tokens] chain=${chainId} Error refreshing:`, e);
    } finally {
      cache.isFetching = false;
      cache.refreshPromise = null;
    }
  })();
  await cache.refreshPromise;
}

// --- Route handler ---
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  // Parse chainId (default BSC for backward compat)
  const rawChainId = searchParams.get('chainId');
  const chainId: SupportedChainId =
    rawChainId === '196' ? 196 : 56;
  const cache = chainCaches[chainId];

  const forceRefresh = searchParams.get('refresh') === '1';
  if (forceRefresh || Date.now() - cache.timestamp > CACHE_TTL || cache.tokens.length === 0) {
    if (forceRefresh) {
      cache.timestamp = 0;
      cache.isFetching = false;
      cache.refreshPromise = null;
    }
    await refreshTokens(chainId);
  }

  if (address) {
    const token = cache.tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    return NextResponse.json(token);
  }

  const sort = searchParams.get('sort') || 'new';
  let sorted = [...cache.tokens];

  switch (sort) {
    case 'hot':
      sorted.sort((a, b) => b.reserve - a.reserve);
      break;
    case 'top':
      sorted.sort((a, b) => b.marketCap - a.marketCap);
      break;
    case 'dex':
      sorted = sorted.filter((t) => t.status === 4);
      sorted.sort((a, b) => b.marketCap - a.marketCap);
      break;
    case 'new':
    default:
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  const response = NextResponse.json(sorted);
  response.headers.set('X-Token-Count', String(sorted.length));
  response.headers.set('X-Chain-Id', String(chainId));
  response.headers.set('X-Cache-Age', String(Math.floor((Date.now() - cache.timestamp) / 1000)));
  response.headers.set('X-Build', '20260408-multichain');
  response.headers.set('X-Debug', cache.lastRefreshDebug);
  return response;
}
