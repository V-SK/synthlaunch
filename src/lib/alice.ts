// Alice chain constants and helpers (client-safe — no polkadot imports)

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

// Fetch balance via server-side API (polkadot runs on server only)
export async function fetchAliceBalance(address: string): Promise<bigint> {
  const res = await fetch(`/api/alice-wallet?action=balance&address=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error('balance fetch failed');
  const data = await res.json();
  return BigInt(data.balance);
}
