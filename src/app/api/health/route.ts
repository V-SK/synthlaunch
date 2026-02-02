import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CHECK_TIMEOUT = 5000;

interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  [key: string]: unknown;
}

async function timedCheck<T extends CheckResult>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    result.latencyMs = Date.now() - start;
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[health] ${name} check failed:`, msg);
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: msg,
    } as unknown as T;
  }
}

async function checkSupabase(): Promise<CheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { status: 'error', error: 'Not configured' };
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/tokens?select=address&limit=100`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      signal: AbortSignal.timeout(CHECK_TIMEOUT),
    }
  );

  if (!res.ok) {
    return { status: 'error', error: `HTTP ${res.status}` };
  }

  const data = await res.json();
  return { status: 'ok', tokenCount: data.length };
}

async function checkBscRpc(): Promise<CheckResult> {
  const res = await fetch('https://bsc-dataseed.binance.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
    signal: AbortSignal.timeout(CHECK_TIMEOUT),
  });

  if (!res.ok) {
    return { status: 'error', error: `HTTP ${res.status}` };
  }

  const data = await res.json();
  const blockNumber = parseInt(data.result, 16);
  return { status: 'ok', blockNumber };
}

async function checkBnbPrice(): Promise<CheckResult> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd',
    { signal: AbortSignal.timeout(CHECK_TIMEOUT) }
  );

  if (!res.ok) {
    return { status: 'error', error: `HTTP ${res.status}` };
  }

  const data = await res.json();
  const price = data.binancecoin?.usd;
  if (!price) {
    return { status: 'error', error: 'No price data' };
  }
  return { status: 'ok', price };
}

async function checkIpfs(): Promise<CheckResult> {
  // Just check if IPFS gateway responds (use a known CID or just HEAD)
  const res = await fetch('https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', {
    method: 'HEAD',
    signal: AbortSignal.timeout(CHECK_TIMEOUT),
  });

  return { status: res.ok ? 'ok' : 'error' };
}

async function checkMoltboard(): Promise<CheckResult> {
  const res = await fetch('https://moltboard-production.up.railway.app/api/agents/leaderboard', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(CHECK_TIMEOUT),
  });

  if (!res.ok) {
    return { status: 'error', error: `HTTP ${res.status}` };
  }

  return { status: 'ok' };
}

export async function GET() {
  const [supabase, bscRpc, bnbPrice, ipfs, moltboard] = await Promise.all([
    timedCheck('supabase', checkSupabase),
    timedCheck('bscRpc', checkBscRpc),
    timedCheck('bnbPrice', checkBnbPrice),
    timedCheck('ipfs', checkIpfs),
    timedCheck('moltboard', checkMoltboard),
  ]);

  const checks = { supabase, bscRpc, bnbPrice, ipfs, moltboard };
  const allStatuses = Object.values(checks).map((c) => c.status);
  const errorCount = allStatuses.filter((s) => s === 'error').length;

  let status: 'ok' | 'degraded' | 'error';
  if (errorCount === 0) {
    status = 'ok';
  } else if (errorCount === allStatuses.length) {
    status = 'error';
  } else {
    status = 'degraded';
  }

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.BUILD_TIME || 'dev',
  });
}
