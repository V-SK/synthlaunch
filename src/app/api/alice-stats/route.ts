import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DISTRIBUTION_WALLET = 'a2t35oD3DjDnFbe3RRm6g4nzp7SBSjVrWVu6h4cpR1chRXhkL';
const ALICE_RPC = 'https://rpc.aliceprotocol.org';
const ALICE_SS58_PREFIX = 300;
const ALICE_DECIMALS = 12;

// Cache: 5 minutes for balance, 1 minute for stats
let balanceCache: { value: string; ts: number } | null = null;
let statsCache: { data: unknown; ts: number } | null = null;

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}

async function fetchPoolBalance(): Promise<string> {
  if (balanceCache && Date.now() - balanceCache.ts < 5 * 60 * 1000) {
    return balanceCache.value;
  }

  const { decodeAddress, xxhashAsHex, blake2AsHex, cryptoWaitReady } = await import('@polkadot/util-crypto');
  const { u8aToHex } = await import('@polkadot/util');
  await cryptoWaitReady();

  const pubKey = decodeAddress(DISTRIBUTION_WALLET, false, ALICE_SS58_PREFIX);
  const moduleHash = xxhashAsHex('System', 128).slice(2);
  const storageHash = xxhashAsHex('Account', 128).slice(2);
  const keyHash = blake2AsHex(pubKey, 128).slice(2) + u8aToHex(pubKey).slice(2);
  const storageKey = '0x' + moduleHash + storageHash + keyHash;

  const res = await fetch(ALICE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'state_getStorage', params: [storageKey] }),
  });
  const data = await res.json();
  let balance = '0';
  if (data.result && data.result !== '0x') {
    const hex = data.result.slice(2);
    if (hex.length >= 64) {
      const freeHex = hex.slice(32, 64);
      const bytes = freeHex.match(/.{2}/g) ?? [];
      const raw = BigInt('0x' + ([...bytes].reverse().join('') || '0'));
      balance = raw.toString();
    }
  }

  balanceCache = { value: balance, ts: Date.now() };
  return balance;
}

function formatAlice(raw: bigint): string {
  const divisor = BigInt(10 ** ALICE_DECIMALS);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(ALICE_DECIMALS, '0').slice(0, 4);
  return `${whole}.${frac}`;
}

// GET /api/alice-stats
// Public: returns pool balance, recent rounds, per-address totals
export async function GET() {
  if (statsCache && Date.now() - statsCache.ts < 60_000) {
    return NextResponse.json(statsCache.data);
  }

  try {
    const supabase = getSupabase();

    // Page through alice_distributions so we get every success row.
    // PostgREST defaults to max 1000 rows per request; relying on that
    // default silently stopped the leaderboard updating once the table
    // grew past 1000 rows — the aggregate was always computed from the
    // oldest 1000 inserts. Explicitly page with .range() and keep going
    // until a page comes back short.
    async function fetchAllSuccessDistributions() {
      const pageSize = 1000;
      const rows: Array<{ bsc_address: string; alice_amount: string }> = [];
      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('alice_distributions')
          .select('bsc_address, alice_amount')
          .eq('status', 'success')
          .order('id', { ascending: true })
          .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
      }
      return rows;
    }

    const [balanceResult, roundsRes, allDistRows] = await Promise.all([
      fetchPoolBalance().catch((e) => { console.error('pool balance error:', e); return '0'; }),
      supabase.from('alice_distribution_rounds').select('*').order('created_at', { ascending: false }).limit(10),
      fetchAllSuccessDistributions().catch((e) => { console.error('distributions paginate error:', e); return []; }),
    ]);
    const balanceRaw = balanceResult;

    // Aggregate per-address across ALL success rows
    const addressTotals = new Map<string, bigint>();
    for (const row of allDistRows) {
      const prev = addressTotals.get(row.bsc_address) ?? 0n;
      addressTotals.set(row.bsc_address, prev + BigInt(row.alice_amount));
    }

    const perAddress: Record<string, string> = {};
    for (const [addr, total] of addressTotals) {
      perAddress[addr] = total.toString();
    }

    const balance = BigInt(balanceRaw);
    const result = {
      poolAddress: DISTRIBUTION_WALLET,
      poolBalance: balanceRaw,
      poolBalanceReadable: formatAlice(balance),
      recentRounds: roundsRes.data ?? [],
      perAddressTotals: perAddress,
    };

    statsCache = { data: result, ts: Date.now() };
    return NextResponse.json(result);
  } catch (e) {
    console.error('alice-stats error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
