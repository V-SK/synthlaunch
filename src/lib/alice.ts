// Alice chain constants and RPC helpers

export const ALICE_RPC = 'https://rpc.aliceprotocol.org';
export const ALICE_SS58_PREFIX = 300;
export const ALICE_DECIMALS = 12;
export const ALICE_SYMBOL = 'ALICE';

export function formatAlice(raw: bigint): string {
  const divisor = BigInt(10 ** ALICE_DECIMALS);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(ALICE_DECIMALS, '0').slice(0, 4);
  return `${whole.toLocaleString()}.${fracStr}`;
}

// Validate that a string is a valid Alice SS58 address (prefix 300)
export async function isValidAliceAddress(address: string): Promise<boolean> {
  try {
    const { decodeAddress, encodeAddress } = await import('@polkadot/util-crypto');
    const pubKey = decodeAddress(address, false, ALICE_SS58_PREFIX);
    const reencoded = encodeAddress(pubKey, ALICE_SS58_PREFIX);
    return reencoded === address;
  } catch {
    return false;
  }
}

// Query account balance via system.account storage key
export async function fetchAliceBalance(address: string): Promise<bigint> {
  return fetchBalanceViaStorage(address);
}

async function fetchBalanceViaStorage(address: string): Promise<bigint> {
  const { decodeAddress, xxhashAsHex, blake2AsHex } = await import('@polkadot/util-crypto');
  const { u8aToHex } = await import('@polkadot/util');

  const pubKey = decodeAddress(address, false, ALICE_SS58_PREFIX);

  // system.account storage key = xxhash128("System") + xxhash128("Account") + blake2_128_concat(pubkey)
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

  // AccountInfo SCALE layout:
  // nonce(u32=4B) + consumers(u32=4B) + providers(u32=4B) + sufficients(u32=4B) = 16B header
  // then AccountData: free(u128=16B) + reserved + misc_frozen + fee_frozen
  const hex = data.result.slice(2); // remove 0x
  if (hex.length < 64) return 0n;
  const freeBalanceHex = hex.slice(32, 64); // bytes 16–31
  return hexToU128LE(freeBalanceHex);
}

function hexToU128LE(hex: string): bigint {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!h || h.length < 2) return 0n;
  const bytes = h.match(/.{2}/g) ?? [];
  const beHex = [...bytes].reverse().join('');
  return BigInt('0x' + (beHex || '0'));
}
