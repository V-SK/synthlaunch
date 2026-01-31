export const FLAP_ADDRESS = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as const;

export const FLAP_ABI = [
  {
    inputs: [
      { name: '_name', type: 'string' },
      { name: '_symbol', type: 'string' },
      { name: '_description', type: 'string' },
      { name: '_image', type: 'string' },
      { name: '_website', type: 'string' },
      { name: '_twitter', type: 'string' },
      { name: '_telegram', type: 'string' },
      { name: '_taxRate', type: 'uint256' },
      { name: '_taxRecipient', type: 'address' },
    ],
    name: 'newTokenV5',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'getTokenInfo',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'image', type: 'string' },
      { name: 'creator', type: 'address' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'taxRate', type: 'uint256' },
      { name: 'taxRecipient', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'token', type: 'address' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'symbol', type: 'string' },
    ],
    name: 'TokenCreated',
    type: 'event',
  },
] as const;
