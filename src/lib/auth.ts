import { verifyMessage } from 'viem';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

// NFALite ABI (minimal for ownerOf)
const NFALITE_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Verify a signed message and return the signer address
 */
export async function verifySignature(
  message: string,
  signature: `0x${string}`
): Promise<string> {
  const address = await verifyMessage({
    message,
    signature,
  });
  return address.toLowerCase();
}

/**
 * Check if an address owns a specific NFALite token
 */
export async function isNFALiteOwner(
  nfaLiteContract: `0x${string}`,
  nfaId: number,
  address: string
): Promise<boolean> {
  const client = createPublicClient({
    chain: bsc,
    transport: http('https://bsc-dataseed.binance.org/'),
  });

  try {
    const owner = await client.readContract({
      address: nfaLiteContract,
      abi: NFALITE_ABI,
      functionName: 'ownerOf',
      args: [BigInt(nfaId)],
    });
    
    return owner.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Error checking NFALite ownership:', error);
    return false;
  }
}

/**
 * Create a message to sign for agent config operations
 */
export function createConfigMessage(nfaId: number, action: string, timestamp: number): string {
  return `SynthLaunch Agent Config\n\nAction: ${action}\nNFA ID: ${nfaId}\nTimestamp: ${timestamp}`;
}

/**
 * Verify timestamp is within acceptable range (5 minutes)
 */
export function isTimestampValid(timestamp: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now();
  return timestamp > now - maxAgeMs && timestamp <= now + 60000; // Allow 1 min future for clock skew
}
