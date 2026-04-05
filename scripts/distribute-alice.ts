/**
 * ALICE 奖励分发脚本
 *
 * 逻辑：
 *   1. 读取 BSC 质押合约，获取所有质押者的 stakeInfo（金额 + 乘数）
 *   2. 从 Supabase alice_bindings 表读取 BSC→Alice 地址映射
 *   3. 计算每个绑定用户的加权份额
 *   4. 按比例分配总奖励池，批量转账到 Alice 链
 *
 * 用法：
 *   npx tsx scripts/distribute-alice.ts --total 1000 --dry-run
 *   npx tsx scripts/distribute-alice.ts --total 1000
 *
 * 环境变量（.env.local）：
 *   MORALIS_API_KEY          — Moralis API key
 *   SUPABASE_URL             — Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key（或 SUPABASE_SERVICE_KEY）
 *   ALICE_SENDER_MNEMONIC    — Alice 链发送方钱包助记词
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createPublicClient, http, formatUnits } from 'viem';
import { bsc } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

// ─── Config ────────────────────────────────────────────────────────────────

const STAKING_CONTRACT = '0xCDf39d6c55997f3F937287bA45c33d76bB98fE03' as const;
const MORALIS_API_KEY = process.env.MORALIS_API_KEY ?? '';
const ALICE_RPC_WS = process.env.ALICE_RPC_WS || 'wss://rpc.aliceprotocol.org';
const ALICE_RPC_HTTP = 'https://rpc.aliceprotocol.org';
const ALICE_DECIMALS = 12;
const ALICE_SS58_PREFIX = 300;

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

function parseArgs() {
  const args = process.argv.slice(2);
  let total = 0;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--total' && args[i + 1]) {
      total = parseFloat(args[i + 1]);
      i++;
    }
    if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  if (total <= 0) {
    console.error('Usage: npx tsx scripts/distribute-alice.ts --total <amount> [--dry-run]');
    console.error('  --total    Total ALICE to distribute (e.g. 1000)');
    console.error('  --dry-run  Preview only, do not send transactions');
    process.exit(1);
  }

  return { total, dryRun };
}

// ─── Step 1: Fetch staker addresses via Moralis ────────────────────────────

async function fetchStakerAddresses(): Promise<string[]> {
  if (!MORALIS_API_KEY) throw new Error('MORALIS_API_KEY not set');

  const STAKE_SELECTOR = '0xa694fc3a';
  const stakers = new Set<string>();
  let cursor: string | null = null;

  // Paginate through all transactions
  do {
    const params = new URLSearchParams({ chain: '0x38', limit: '100' });
    if (cursor) params.set('cursor', cursor);

    const url = `https://deep-index.moralis.io/api/v2.2/${STAKING_CONTRACT}?${params}`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': MORALIS_API_KEY },
    });

    if (!res.ok) throw new Error(`Moralis API error: ${res.status}`);
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

// ─── Step 2: Read on-chain stake info ──────────────────────────────────────

interface StakeInfo {
  address: string;
  stakedAmount: bigint;
  multiplier: bigint;
  weight: bigint; // stakedAmount * multiplier
}

async function fetchStakeInfos(addresses: string[]): Promise<StakeInfo[]> {
  const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

  const results: StakeInfo[] = [];

  // Batch in groups of 50 to avoid RPC limits
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
          results.push({
            address: batch[j],
            stakedAmount,
            multiplier,
            weight: stakedAmount * multiplier,
          });
        }
      }
    }
  }

  return results;
}

// ─── Step 3: Load alice bindings from Supabase ─────────────────────────────

async function loadAliceBindings(): Promise<Map<string, string>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('alice_bindings').select('bsc_address, alice_address');
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.bsc_address.toLowerCase(), row.alice_address);
  }
  return map;
}

// ─── Step 4: Calculate distribution ────────────────────────────────────────

interface Distribution {
  bscAddress: string;
  aliceAddress: string;
  weight: bigint;
  share: number;        // 0-1
  aliceAmount: bigint;  // raw amount (12 decimals)
  aliceReadable: string;
}

function calculateDistribution(
  stakeInfos: StakeInfo[],
  bindings: Map<string, string>,
  totalAlice: number,
): Distribution[] {
  // Only include stakers who have bound an Alice address
  const eligible = stakeInfos.filter((s) => bindings.has(s.address));

  if (eligible.length === 0) {
    console.warn('No eligible stakers with Alice bindings found.');
    return [];
  }

  const totalWeight = eligible.reduce((sum, s) => sum + s.weight, 0n);
  if (totalWeight === 0n) return [];

  const totalRaw = BigInt(Math.floor(totalAlice * 10 ** ALICE_DECIMALS));

  return eligible.map((s) => {
    // Use high precision: multiply first, then divide
    const aliceAmount = (totalRaw * s.weight) / totalWeight;
    const share = Number(s.weight * 10000n / totalWeight) / 10000;

    return {
      bscAddress: s.address,
      aliceAddress: bindings.get(s.address)!,
      weight: s.weight,
      share,
      aliceAmount,
      aliceReadable: formatAlice(aliceAmount),
    };
  });
}

function formatAlice(raw: bigint): string {
  const divisor = BigInt(10 ** ALICE_DECIMALS);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(ALICE_DECIMALS, '0').slice(0, 4);
  return `${whole}.${frac}`;
}

// ─── Step 5: Send ALICE tokens ─────────────────────────────────────────────

async function sendAliceTokens(distributions: Distribution[]) {
  const mnemonic = process.env.ALICE_SENDER_MNEMONIC;
  if (!mnemonic) throw new Error('ALICE_SENDER_MNEMONIC not set');

  await cryptoWaitReady();

  // Try WebSocket first, fall back to HTTP
  let api: ApiPromise;
  try {
    const wsProvider = new WsProvider(ALICE_RPC_WS);
    api = await ApiPromise.create({ provider: wsProvider });
  } catch {
    console.log('WebSocket failed, trying HTTP...');
    const { HttpProvider } = await import('@polkadot/rpc-provider');
    const httpProvider = new HttpProvider(ALICE_RPC_HTTP);
    api = await ApiPromise.create({ provider: httpProvider });
  }

  const keyring = new Keyring({ type: 'sr25519', ss58Format: ALICE_SS58_PREFIX });
  const sender = keyring.addFromMnemonic(mnemonic);

  console.log(`\nSender: ${sender.address}`);

  // Check sender balance
  const { data: senderBalance } = await api.query.system.account(sender.address) as any;
  const free = BigInt(senderBalance.free.toString());
  const totalNeeded = distributions.reduce((sum, d) => sum + d.aliceAmount, 0n);

  console.log(`Sender balance: ${formatAlice(free)} ALICE`);
  console.log(`Total to send:  ${formatAlice(totalNeeded)} ALICE`);

  if (free < totalNeeded) {
    throw new Error(`Insufficient balance: have ${formatAlice(free)}, need ${formatAlice(totalNeeded)}`);
  }

  // Send transfers one by one
  let successCount = 0;
  let failCount = 0;

  for (const dist of distributions) {
    try {
      console.log(`  Sending ${dist.aliceReadable} ALICE → ${dist.aliceAddress} (BSC: ${dist.bscAddress})`);

      const tx = api.tx.balances.transferKeepAlive(dist.aliceAddress, dist.aliceAmount);
      const hash = await tx.signAndSend(sender);

      console.log(`    ✅ tx: ${hash.toHex()}`);
      successCount++;

      // Small delay between transactions
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      console.error(`    ❌ Failed: ${e}`);
      failCount++;
    }
  }

  console.log(`\nDone: ${successCount} success, ${failCount} failed`);

  await api.disconnect();
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { total, dryRun } = parseArgs();

  console.log('='.repeat(60));
  console.log(`ALICE Reward Distribution${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`Total pool: ${total} ALICE`);
  console.log('='.repeat(60));

  // Step 1: Get staker addresses
  console.log('\n[1/4] Fetching staker addresses...');
  const addresses = await fetchStakerAddresses();
  console.log(`  Found ${addresses.length} staker addresses`);

  // Step 2: Read on-chain stake info
  console.log('\n[2/4] Reading on-chain stake info...');
  const stakeInfos = await fetchStakeInfos(addresses);
  console.log(`  ${stakeInfos.length} active stakers`);

  // Step 3: Load Alice bindings
  console.log('\n[3/4] Loading Alice bindings...');
  const bindings = await loadAliceBindings();
  console.log(`  ${bindings.size} bindings found`);

  // Calculate distribution
  const distributions = calculateDistribution(stakeInfos, bindings, total);

  if (distributions.length === 0) {
    console.log('\nNo eligible recipients. Exiting.');
    process.exit(0);
  }

  // Print distribution table
  console.log('\n' + '─'.repeat(60));
  console.log('Distribution:');
  console.log('─'.repeat(60));

  for (const d of distributions) {
    const stakeAmt = formatUnits(d.weight / d.weight * stakeInfos.find(s => s.address === d.bscAddress)!.stakedAmount, 18);
    console.log(`  BSC: ${d.bscAddress}`);
    console.log(`  Alice: ${d.aliceAddress}`);
    console.log(`  Staked: ${stakeAmt} SYNTH | Weight: ${d.weight.toString()} | Share: ${(d.share * 100).toFixed(2)}%`);
    console.log(`  → ${d.aliceReadable} ALICE`);
    console.log('');
  }

  console.log(`Total recipients: ${distributions.length}`);
  console.log(`Total ALICE: ${formatAlice(distributions.reduce((s, d) => s + d.aliceAmount, 0n))}`);

  // Step 4: Send (or dry run)
  if (dryRun) {
    console.log('\n🔍 DRY RUN — no transactions sent.');
  } else {
    console.log('\n[4/4] Sending ALICE tokens...');
    await sendAliceTokens(distributions);
  }
}

main().catch((e) => {
  console.error('\nFatal error:', e);
  process.exit(1);
});
