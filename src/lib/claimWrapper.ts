export const CLAIM_WRAPPER_ABI = [
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'requiredSynthAmount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'minFeeThreshold',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }],
    name: 'canClaim',
    outputs: [
      { name: 'eligible', type: 'bool' },
      { name: 'synthRequired', type: 'uint256' },
      { name: 'claimableAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
