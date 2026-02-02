import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, parseAbi, getAddress, type Address } from 'viem';
import { bsc } from 'viem/chains';

export const dynamic = 'force-dynamic';

// --- Constants ---
const PORTAL_ADDRESS = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as Address;
const BSC_RPC = 'https://bsc-dataseed.binance.org';
const BILLION = 1000000000;
const CACHE_TTL = 15000; // 45 seconds

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

let tokenCache: CachedToken[] = [];
let cacheTimestamp = 0;
let bnbPriceCache = 0;
let bnbPriceTimestamp = 0;
let isFetching = false;
let fetchStartTime = 0;
let lastKnownSupabaseTokens: SupabaseToken[] = []; // fallback if Supabase goes down
let lastRefreshDebug = '';

const client = createPublicClient({
  chain: bsc,
  transport: http(BSC_RPC, { batch: true, retryCount: 3 }),
});

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
}

async function fetchTokenList(): Promise<SupabaseToken[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[tokens] Supabase not configured');
    return [];
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tokens?select=*&order=created_at.desc`,
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
      console.error('[tokens] Supabase error:', res.status, await res.text());
      if (lastKnownSupabaseTokens.length > 0) {
        console.log('[tokens] Using last-known-good Supabase data as fallback');
        return lastKnownSupabaseTokens;
      }
      return [];
    }

    const data = await res.json();
    // Filter out invalid addresses
    const valid = data.filter((t: any) => t.address && t.address.startsWith('0x') && t.address.length === 42);
    console.log(`[tokens] Supabase raw=${data.length} valid=${valid.length} addrs=${data.map((t:any)=>t.address?.slice(0,8)||'null').join(',')}`);
    if (valid.length > 0) {
      lastKnownSupabaseTokens = valid;
    }
    return valid;
  } catch (e) {
    console.error('[tokens] Failed to fetch from Supabase:', e);
    if (lastKnownSupabaseTokens.length > 0) {
      console.log('[tokens] Using last-known-good Supabase data as fallback');
      return lastKnownSupabaseTokens;
    }
    return [];
  }
}

// --- Main data fetch ---
async function refreshTokens(): Promise<void> {
  // Reset stale lock (stuck for > 30s)
  if (isFetching && Date.now() - fetchStartTime > 30000) {
    console.warn('[tokens] Resetting stale isFetching lock');
    isFetching = false;
  }
  if (isFetching) return;
  isFetching = true;
  fetchStartTime = Date.now();

  try {
    const [bnbPrice, supabaseTokens] = await Promise.all([
      fetchBnbPrice(),
      fetchTokenList(),
    ]);

    if (supabaseTokens.length === 0) {
      console.log('[tokens] No tokens from Supabase, keeping existing cache');
      isFetching = false;
      return;
    }
    const debugParts: string[] = [`sb=${supabaseTokens.length}`, `addrs=${supabaseTokens.map(t=>t.address?.slice(0,6)).join('|')}`];
    console.log(`[tokens] Fetched ${supabaseTokens.length} tokens from Supabase: ${supabaseTokens.map(t => t.address?.slice(0,8)).join(',')}`);

    const tokens: CachedToken[] = [];

    // Process in batches of 10
    for (let i = 0; i < supabaseTokens.length; i += 10) {
      const batch = supabaseTokens.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (info) => {
          try {
            const result = await client.readContract({
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
    lastRefreshDebug = debugParts.join(',');
    tokenCache = tokens;
    cacheTimestamp = Date.now();
  } catch (e) {
    console.error('[tokens] Error refreshing:', e);
  } finally {
    isFetching = false;
  }
}

// --- Route handler ---
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  const forceRefresh = searchParams.get('refresh') === '1';
  if (forceRefresh || Date.now() - cacheTimestamp > CACHE_TTL || tokenCache.length === 0) {
    if (forceRefresh) {
      cacheTimestamp = 0;
      isFetching = false;
    }
    await refreshTokens();
  }

  if (address) {
    const token = tokenCache.find(t => t.address.toLowerCase() === address.toLowerCase());
    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    return NextResponse.json(token);
  }

  const sort = searchParams.get('sort') || 'new';
  let sorted = [...tokenCache];

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
  response.headers.set('X-Cache-Age', String(Math.floor((Date.now() - cacheTimestamp) / 1000)));
  response.headers.set('X-Build', '20260201-v3');
  response.headers.set('X-Debug', lastRefreshDebug);
  return response;
}
