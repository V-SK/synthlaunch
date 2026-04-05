import { NextRequest, NextResponse } from 'next/server';
import { Keyring } from '@polkadot/keyring';
import { mnemonicGenerate, cryptoWaitReady, decodeAddress, xxhashAsHex, blake2AsHex } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';

const SS58_PREFIX = 300;
const ALICE_RPC = 'https://rpc.aliceprotocol.org';

// GET /api/alice-wallet?action=balance&address=...
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  const address = req.nextUrl.searchParams.get('address');

  if (action === 'balance' && address) {
    try {
      const balance = await fetchBalanceViaStorage(address);
      return NextResponse.json({ balance: balance.toString() });
    } catch (e) {
      console.error('balance fetch error:', e);
      return NextResponse.json({ error: 'balance fetch failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'invalid request' }, { status: 400 });
}

// POST /api/alice-wallet
// Body: { action: 'generate' } or { action: 'import', mnemonic: '...' }
export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { action } = body;

  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519', ss58Format: SS58_PREFIX });

  if (action === 'generate') {
    const mnemonic = mnemonicGenerate(12);
    const pair = keyring.addFromMnemonic(mnemonic);
    return NextResponse.json({ mnemonic, address: pair.address });
  }

  if (action === 'import') {
    const { mnemonic } = body;
    if (!mnemonic || typeof mnemonic !== 'string') {
      return NextResponse.json({ error: 'mnemonic required' }, { status: 400 });
    }
    try {
      const pair = keyring.addFromMnemonic(mnemonic.trim());
      return NextResponse.json({ address: pair.address });
    } catch {
      return NextResponse.json({ error: 'invalid mnemonic' }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}

// --- Balance query via Substrate storage key ---

async function fetchBalanceViaStorage(address: string): Promise<bigint> {
  await cryptoWaitReady();
  const pubKey = decodeAddress(address, false, SS58_PREFIX);

  const moduleHash = xxhashAsHex('System', 128).slice(2);
  const storageHash = xxhashAsHex('Account', 128).slice(2);
  const keyHash = blake2AsHex(pubKey, 128).slice(2) + u8aToHex(pubKey).slice(2);
  const storageKey = '0x' + moduleHash + storageHash + keyHash;

  const res = await fetch(ALICE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'state_getStorage',
      params: [storageKey],
    }),
  });

  const data = await res.json();
  if (!data.result || data.result === '0x') return 0n;

  const hex = data.result.slice(2);
  if (hex.length < 64) return 0n;
  const freeBalanceHex = hex.slice(32, 64);
  return hexToU128LE(freeBalanceHex);
}

function hexToU128LE(hex: string): bigint {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!h || h.length < 2) return 0n;
  const bytes = h.match(/.{2}/g) ?? [];
  const beHex = [...bytes].reverse().join('');
  return BigInt('0x' + (beHex || '0'));
}
