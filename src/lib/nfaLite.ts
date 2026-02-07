import type { Address } from 'viem';

export const NFALITE_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'agents',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'avatarURI', type: 'string' },
      { name: 'vault', type: 'address' },
      { name: 'wallet', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'token', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

export function getNfaLiteAddress(): Address {
  const env = (process.env.NEXT_PUBLIC_NFALITE_CONTRACT || '').trim();
  if (!env) return ZERO_ADDRESS;
  return env as Address;
}
