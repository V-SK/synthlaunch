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
    name: 'requiredUsdValue',
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
    inputs: [],
    name: 'getRequiredSynthAmount',
    outputs: [{ name: 'synthAmount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSynthPriceUsd',
    outputs: [{ name: 'priceUsd', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getRequirementInfo',
    outputs: [
      { name: 'usdValue', type: 'uint256' },
      { name: 'synthAmount', type: 'uint256' },
      { name: 'synthPriceUsd', type: 'uint256' },
    ],
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
