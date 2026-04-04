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

// Encode Alice address from public key bytes using SS58 prefix 300
// Uses the polkadot ss58 encoding standard
export async function encodeAliceAddress(pubKey: Uint8Array): Promise<string> {
  const { encodeAddress } = await import('@polkadot/util-crypto');
  return encodeAddress(pubKey, ALICE_SS58_PREFIX);
}

// Query account balance via system_account RPC
export async function fetchAliceBalance(address: string): Promise<bigint> {
  // Encode storage key for system.account map
  // For Substrate we use the raw JSON-RPC method with encoded key
  const res = await fetch(ALICE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'state_call',
      params: ['AccountBalanceApi_account_balance', encodeAddressForRpc(address)],
    }),
  });
  const data = await res.json();
  if (data.error) {
    // Fallback: use system_account via storage key
    return fetchBalanceViaStorage(address);
  }
  // Parse SCALE-encoded u128
  const hex: string = data.result;
  if (!hex || hex === '0x') return 0n;
  return hexToU128LE(hex);
}

// Build SS58 decoded bytes for RPC param
function encodeAddressForRpc(address: string): string {
  // We'll pass address directly and let the node decode
  // Actually use pub key hex via decodeAddress
  return address; // placeholder, real impl below
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

  // AccountInfo: nonce(u32) + consumers(u32) + providers(u32) + sufficients(u32) + data.free(u128) + ...
  // offset = 4+4+4+4 = 16 bytes = 32 hex chars
  const hex = data.result.slice(2); // remove 0x
  const freeBalanceHex = hex.slice(32, 64); // bytes 16-32
  return hexToU128LE('0x' + freeBalanceHex);
}

function hexToU128LE(hex: string): bigint {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!h || h.length < 2) return 0n;
  // Reverse bytes (little-endian)
  const bytes = h.match(/.{2}/g) ?? [];
  const beHex = bytes.reverse().join('');
  return BigInt('0x' + beHex);
}
