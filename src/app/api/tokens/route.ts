import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, parseAbi, type Address } from 'viem';
import { bsc } from 'viem/chains';

// --- Constants ---
const PORTAL_ADDRESS = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as Address;
const BSC_RPC = 'https://bsc-dataseed.binance.org';
const BILLION = 1000000000;
const CACHE_TTL = 45000; // 45 seconds

const PORTAL_ABI = parseAbi([
  'event TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta)',
  'function getTokenV5(address token) external view returns ((uint8,uint256,uint256,uint256,uint8,uint256,uint256,uint256,uint256,address,bool,bytes32))',
]);

const ERC20_ABI = parseAbi([
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function metaURI() external view returns (string)',
]);

// --- Bonding curve math (CDPV2) ---
function calcPrice(k: number, h: number, supply: number): number {
  const denom = h + BILLION - supply;
  if (denom <= 0) return 0;
  return k / (denom * denom);
}

function estimateSupply(r: number, h: number, k: number, reserve: number): number {
  const denom = reserve + r;
  if (denom <= 0) return 0;
  return BILLION + h - k / denom;
}

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
  taxRate: number;
  price: number;        // in BNB
  priceUsd: number;
  marketCap: number;    // in USD
  marketCapBnb: number;
  circulatingSupply: number;
  status: number;       // 0=Invalid, 1=Tradable, 4=DEX
  progress: number;     // 0-1
  createdAt: number;    // unix timestamp
  reserve: number;      // in BNB
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
    if (bnbPriceCache === 0) bnbPriceCache = 600; // fallback
  }
  return bnbPriceCache;
}

// --- IPFS Metadata ---
async function fetchMeta(cid: string): Promise<{ name: string; description: string; image: string }> {
  if (!cid || cid === '' || cid.length < 10) {
    return { name: '', description: '', image: '' };
  }
  try {
    const url = `https://ipfs.io/ipfs/${cid}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { name: '', description: '', image: '' };
    const data = await res.json();
    let image = data.image || '';
    // If image is an IPFS hash (not a URL), convert it
    if (image && !image.startsWith('http') && !image.startsWith('data:')) {
      image = `https://ipfs.io/ipfs/${image}`;
    }
    return {
      name: data.name || '',
      description: data.description || '',
      image,
    };
  } catch {
    return { name: '', description: '', image: '' };
  }
}

// --- Main data fetch ---
async function refreshTokens(): Promise<void> {
  if (isFetching) return;
  isFetching = true;

  try {
    const bnbPrice = await fetchBnbPrice();

    // Start block for BSC portal - we search recent blocks for events
    // First, get the current block
    const currentBlock = await client.getBlockNumber();

    // Search last ~2M blocks (~7 days on BSC at 3s/block)
    // But limit to batches of 5000 to avoid RPC limits
    const startBlock = currentBlock - BigInt(2000000);
    const batchSize = BigInt(5000);

    const allTokenAddresses: Map<string, { creator: string; name: string; symbol: string; meta: string; ts: number }> = new Map();

    // Fetch events in batches
    let fromBlock = startBlock;
    while (fromBlock <= currentBlock) {
      const toBlock = fromBlock + batchSize > currentBlock ? currentBlock : fromBlock + batchSize;
      try {
        const logs = await client.getLogs({
          address: PORTAL_ADDRESS,
          event: PORTAL_ABI[0] as any,
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          const args = (log as any).args;
          if (args && args.token) {
            allTokenAddresses.set(args.token.toLowerCase(), {
              creator: args.creator || '',
              name: args.name || '',
              symbol: args.symbol || '',
              meta: args.meta || '',
              ts: Number(args.ts || 0),
            });
          }
        }
      } catch (e) {
        // Some batch failed, just continue
        console.error(`Log fetch failed for blocks ${fromBlock}-${toBlock}:`, e);
      }
      fromBlock = toBlock + BigInt(1);
    }

    if (allTokenAddresses.size === 0) {
      isFetching = false;
      return;
    }

    // Fetch on-chain state for each token using getTokenV5
    const tokens: CachedToken[] = [];
    const entries = Array.from(allTokenAddresses.entries());

    // Process in batches of 10 to avoid overloading RPC
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async ([addr, info]) => {
          try {
            const result = await client.readContract({
              address: PORTAL_ADDRESS,
              abi: PORTAL_ABI,
              functionName: 'getTokenV5',
              args: [addr as Address],
            }) as any;

            const status = Number(result[0]);
            const reserve = parseFloat(formatEther(result[1]));
            const circulatingSupply = parseFloat(formatEther(result[2]));
            // Use the on-chain price field directly — the contract computes it
            // correctly for both bonding curve and DEX tokens.
            const priceBnb = parseFloat(formatEther(result[3]));
            const r = parseFloat(formatEther(result[5]));
            const h = parseFloat(formatEther(result[6]));
            const k = parseFloat(formatEther(result[7]));
            const dexSupplyThreshold = parseFloat(formatEther(result[8]));

            const priceUsd = priceBnb * bnbPrice;

            // Market cap = price × total supply (FDV), matches Flap's display
            const marketCapBnb = priceBnb * BILLION;
            const marketCapUsd = marketCapBnb * bnbPrice;

            // Calculate progress
            let progress = 0;
            if (status === 4) {
              progress = 1;
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
              address: addr,
              name: meta.name || info.name,
              symbol: info.symbol,
              meta: info.meta,
              image: meta.image,
              description: meta.description,
              creator: info.creator,
              taxRate: 0, // Would need separate call for tax
              price: priceBnb,
              priceUsd,
              marketCap: marketCapUsd,
              marketCapBnb,
              circulatingSupply,
              status,
              progress,
              createdAt: info.ts,
              reserve,
              r,
              h,
              k,
              dexSupplyThreshold,
            } as CachedToken;
          } catch (e) {
            console.error(`Failed to fetch token state for ${addr}:`, e);
            return null;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          tokens.push(r.value);
        }
      }
    }

    tokenCache = tokens.sort((a, b) => b.createdAt - a.createdAt);
    cacheTimestamp = Date.now();
  } catch (e) {
    console.error('Error refreshing tokens:', e);
  } finally {
    isFetching = false;
  }
}

// --- Route handler ---
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  // Refresh if cache is stale
  if (Date.now() - cacheTimestamp > CACHE_TTL || tokenCache.length === 0) {
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
    case 'new':
    default:
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  return NextResponse.json(sorted);
}
