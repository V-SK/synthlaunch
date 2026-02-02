// SynthLaunchCustody contract constants

export const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7' as const;

export const CUSTODY_ABI = [
  {
    inputs: [{ name: 'token', type: 'address' }, { name: 'agentName', type: 'string' }],
    name: 'registerToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentName', type: 'string' },
      { name: 'wallet', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'bindWallet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokens', type: 'address[]' }],
    name: 'claimBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'claimable',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'getTokenInfo',
    outputs: [
      { name: 'agentName', type: 'string' },
      { name: 'totalFees', type: 'uint256' },
      { name: 'claimed', type: 'uint256' },
      { name: 'pendingClaim', type: 'uint256' },
      { name: 'wallet', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentName', type: 'string' }],
    name: 'isWalletBound',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentName', type: 'string' }],
    name: 'getAgentWallet',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'tokenAgent',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'tokenFees',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'tokenClaimed',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokens', type: 'address[]' },
      { name: 'agentNames', type: 'string[]' },
    ],
    name: 'registerTokenBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'receiveFee',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'agentName', type: 'string' },
    ],
    name: 'TokenRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'FeeRecorded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'agentName', type: 'string' },
      { indexed: false, name: 'wallet', type: 'address' },
    ],
    name: 'WalletBound',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'agentName', type: 'string' },
      { indexed: false, name: 'wallet', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'FeeClaimed',
    type: 'event',
  },
  {
    inputs: [],
    name: 'platformFeeBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'to', type: 'address' }],
    name: 'withdrawPlatformFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokens', type: 'address[]' }],
    name: 'collectPlatformFeeBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
