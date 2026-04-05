import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

// ─── Config ────────────────────────────────────────────────────────────────

const STAKING_CONTRACT = '0xCDf39d6c55997f3F937287bA45c33d76bB98fE03' as const;
const MORALIS_API_KEY = process.env.MORALIS_API_KEY ?? '';
const ALICE_RPC = 'https://rpc.aliceprotocol.org';
const ALICE_DECIMALS = 12;
const ALICE_SS58_PREFIX = 300;
const DISTRIBUTION_PERCENT = 0.01; // 1% of balance per hour
const ADMIN_ADDRESS = '0x0198b366978ff0ee67bf308b0367c9b6fced2725';

const STAKING_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getStakeInfo',
    outputs: [
      { name: 'stakedAmount', type: 'uint256' },
      { name: 'multiplier', type: 'uint256' },
      { name: 'stakeTimestamp', type: 'uint256' },
      { name: 'unstakeRequestTime', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

function formatAlice(raw: bigint): string {
  const divisor = BigInt(10 ** ALICE_DECIMALS);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(ALICE_DECIMALS, '0').slice(0, 4);
  return `${whole}.${frac}`;
}

// ─── Fetch staker addresses via Moralis ────────────────────────────────────

async function fetchStakerAddresses(): Promise<string[]> {
  const STAKE_SELECTOR = '0xa694fc3a';
  const stakers = new Set<string>();
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ chain: '0x38', limit: '100' });
    if (cursor) params.set('cursor', cursor);
    const url = `https://deep-index.moralis.io/api/v2.2/${STAKING_CONTRACT}?${params}`;
    const res = await fetch(url, { headers: { 'X-API-Key': MORALIS_API_KEY } });
    if (!res.ok) throw new Error(`Moralis ${res.status}`);
    const data = await res.json();
    for (const tx of data.result ?? []) {
      if (tx.input?.startsWith(STAKE_SELECTOR)) {
        stakers.add(tx.from_address.toLowerCase());
      }
    }
    cursor = data.cursor ?? null;
  } while (cursor);

  return Array.from(stakers);
}

// ─── Fetch on-chain stake info ─────────────────────────────────────────────

interface StakeInfo {
  address: string;
  stakedAmount: bigint;
  multiplier: bigint;
  weight: bigint;
}

async function fetchStakeInfos(addresses: string[]): Promise<StakeInfo[]> {
  const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });
  const results: StakeInfo[] = [];

  for (let i = 0; i < addresses.length; i += 50) {
    const batch = addresses.slice(i, i + 50);
    const calls = batch.map((addr) => ({
      address: STAKING_CONTRACT,
      abi: STAKING_ABI,
      functionName: 'getStakeInfo' as const,
      args: [addr as `0x${string}`] as const,
    }));
    const data = await client.multicall({ contracts: calls });
    for (let j = 0; j < batch.length; j++) {
      const result = data[j];
      if (result.status === 'success') {
        const [stakedAmount, multiplier] = result.result;
        if (stakedAmount > 0n) {
          results.push({ address: batch[j], stakedAmount, multiplier, weight: stakedAmount * multiplier });
        }
      }
    }
  }
  return results;
}

// ─── Fetch Alice balance via RPC ───────────────────────────────────────────

async function fetchAliceBalance(address: string): Promise<bigint> {
  const { decodeAddress, xxhashAsHex, blake2AsHex, cryptoWaitReady } = await import('@polkadot/util-crypto');
  const { u8aToHex } = await import('@polkadot/util');
  await cryptoWaitReady();

  const pubKey = decodeAddress(address, false, ALICE_SS58_PREFIX);
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
  if (!data.result || data.result === '0x') return 0n;
  const hex = data.result.slice(2);
  if (hex.length < 64) return 0n;
  const freeHex = hex.slice(32, 64);
  const bytes = freeHex.match(/.{2}/g) ?? [];
  return BigInt('0x' + ([...bytes].reverse().join('') || '0'));
}

// ─── Send ALICE via Substrate extrinsic ────────────────────────────────────

async function sendAliceTransfers(
  distributions: Array<{ aliceAddress: string; aliceAmount: bigint }>,
): Promise<Map<number, { hash: string } | { error: string }>> {
  const { ApiPromise, WsProvider } = await import('@polkadot/api');
  const { Keyring } = await import('@polkadot/keyring');
  const { cryptoWaitReady } = await import('@polkadot/util-crypto');

  await cryptoWaitReady();

  const mnemonic = process.env.ALICE_SENDER_MNEMONIC;
  if (!mnemonic) throw new Error('ALICE_SENDER_MNEMONIC not set');

  let api: InstanceType<typeof ApiPromise>;
  try {
    api = await ApiPromise.create({ provider: new WsProvider('wss://rpc.aliceprotocol.org') });
  } catch {
    const { HttpProvider } = await import('@polkadot/rpc-provider');
    api = await ApiPromise.create({ provider: new HttpProvider(ALICE_RPC) });
  }

  const keyring = new Keyring({ type: 'sr25519', ss58Format: ALICE_SS58_PREFIX });
  const sender = keyring.addFromMnemonic(mnemonic);

  const results = new Map<number, { hash: string } | { error: string }>();

  for (let i = 0; i < distributions.length; i++) {
    const { aliceAddress, aliceAmount } = distributions[i];
    if (aliceAmount <= 0n) {
      results.set(i, { error: 'zero amount' });
      continue;
    }
    try {
      const tx = api.tx.balances.transferKeepAlive(aliceAddress, aliceAmount);
      const hash = await tx.signAndSend(sender);
      results.set(i, { hash: hash.toHex() });
      // Brief pause between txs to avoid nonce issues
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      results.set(i, { error: String(e) });
    }
  }

  await api.disconnect();
  return results;
}

// ─── Main handler ──────────────────────────────────────────────────────────

export const maxDuration = 300; // 5 minute timeout for Vercel

export async function GET(req: NextRequest) {
  // Auth: only Bearer CRON_SECRET (used by Vercel cron and admin trigger)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Start time gate: don't distribute before ALICE_DISTRIBUTION_START
  const startTime = process.env.ALICE_DISTRIBUTION_START;
  if (startTime && Date.now() < new Date(startTime).getTime()) {
    return NextResponse.json({ ok: false, reason: `distribution starts at ${startTime}` });
  }

  const supabase = getSupabase();

  // Concurrency guard: refuse if a round is already running
  const { data: running } = await supabase
    .from('alice_distribution_rounds')
    .select('round_id')
    .eq('status', 'running')
    .limit(1);
  if (running && running.length > 0) {
    return NextResponse.json({ ok: false, reason: 'distribution already running' });
  }

  // Rate limit: refuse if last completed round was less than 30 minutes ago
  const { data: recent } = await supabase
    .from('alice_distribution_rounds')
    .select('created_at')
    .in('status', ['completed', 'running'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (recent && recent.length > 0) {
    const lastTime = new Date(recent[0].created_at).getTime();
    if (Date.now() - lastTime < 30 * 60 * 1000) {
      return NextResponse.json({ ok: false, reason: 'too soon since last distribution' });
    }
  }

  const roundId = new Date().toISOString().replace(/[:.]/g, '-');

  try {
    // 1. Get sender wallet address and balance
    const { Keyring } = await import('@polkadot/keyring');
    const { cryptoWaitReady } = await import('@polkadot/util-crypto');
    await cryptoWaitReady();
    const mnemonic = process.env.ALICE_SENDER_MNEMONIC;
    if (!mnemonic) throw new Error('ALICE_SENDER_MNEMONIC not set');
    const keyring = new Keyring({ type: 'sr25519', ss58Format: ALICE_SS58_PREFIX });
    const sender = keyring.addFromMnemonic(mnemonic);

    const poolBalance = await fetchAliceBalance(sender.address);
    if (poolBalance <= 0n) {
      return NextResponse.json({ ok: false, reason: 'pool balance is 0' });
    }

    // 2. Calculate 1% of balance
    const totalPool = poolBalance / 100n;
    if (totalPool <= 0n) {
      return NextResponse.json({ ok: false, reason: 'pool too small for 1% distribution' });
    }

    // 3. Fetch stakers
    const addresses = await fetchStakerAddresses();
    const stakeInfos = await fetchStakeInfos(addresses);

    // 4. Load bindings
    const { data: bindingsData } = await supabase.from('alice_bindings').select('bsc_address, alice_address');
    const bindings = new Map<string, string>();
    for (const row of bindingsData ?? []) {
      bindings.set(row.bsc_address.toLowerCase(), row.alice_address);
    }

    // 5. Calculate distribution
    const eligible = stakeInfos.filter((s) => bindings.has(s.address));
    if (eligible.length === 0) {
      return NextResponse.json({ ok: false, reason: 'no eligible stakers with bindings' });
    }

    const totalWeight = eligible.reduce((sum, s) => sum + s.weight, 0n);
    if (totalWeight === 0n) {
      return NextResponse.json({ ok: false, reason: 'total weight is 0' });
    }

    const distributions = eligible.map((s) => {
      const aliceAmount = (totalPool * s.weight) / totalWeight;
      const share = Number(s.weight * 1000000n / totalWeight) / 1000000;
      return {
        bscAddress: s.address,
        aliceAddress: bindings.get(s.address)!,
        stakedAmount: s.stakedAmount,
        multiplier: Number(s.multiplier),
        weight: s.weight,
        share,
        aliceAmount,
        aliceReadable: formatAlice(aliceAmount),
      };
    });

    // 6. Create round record
    await supabase.from('alice_distribution_rounds').insert({
      round_id: roundId,
      total_pool: totalPool.toString(),
      pool_balance: poolBalance.toString(),
      recipient_count: distributions.length,
      status: 'running',
    });

    // 7. Insert distribution records
    await supabase.from('alice_distributions').insert(
      distributions.map((d) => ({
        round_id: roundId,
        bsc_address: d.bscAddress,
        alice_address: d.aliceAddress,
        staked_amount: d.stakedAmount.toString(),
        multiplier: d.multiplier,
        weight: d.weight.toString(),
        share: d.share,
        alice_amount: d.aliceAmount.toString(),
        alice_readable: d.aliceReadable,
        status: 'pending',
      })),
    );

    // 8. Send transfers
    const txResults = await sendAliceTransfers(distributions);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < distributions.length; i++) {
      const result = txResults.get(i);
      if (result && 'hash' in result) {
        successCount++;
        await supabase
          .from('alice_distributions')
          .update({ status: 'success', tx_hash: result.hash })
          .eq('round_id', roundId)
          .eq('bsc_address', distributions[i].bscAddress);
      } else {
        failCount++;
        await supabase
          .from('alice_distributions')
          .update({ status: 'failed', error_msg: result && 'error' in result ? result.error : 'unknown' })
          .eq('round_id', roundId)
          .eq('bsc_address', distributions[i].bscAddress);
      }
    }

    // 9. Update round status
    await supabase
      .from('alice_distribution_rounds')
      .update({ status: 'completed', success_count: successCount, fail_count: failCount, completed_at: new Date().toISOString() })
      .eq('round_id', roundId);

    return NextResponse.json({
      ok: true,
      roundId,
      poolBalance: formatAlice(poolBalance),
      distributed: formatAlice(totalPool),
      recipients: distributions.length,
      success: successCount,
      failed: failCount,
    });
  } catch (e) {
    console.error('alice-distribute error:', e);
    // Mark round as failed if it was created
    await supabase
      .from('alice_distribution_rounds')
      .update({ status: 'failed' })
      .eq('round_id', roundId);
    return NextResponse.json({ error: 'distribution failed' }, { status: 500 });
  }
}
