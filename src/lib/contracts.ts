export const FLAP_ADDRESS = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as const;

export const FLAP_ABI = [
  {
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'meta', type: 'string' },
          { name: 'dexThresh', type: 'uint8' },
          { name: 'salt', type: 'bytes32' },
          { name: 'taxRate', type: 'uint16' },
          { name: 'migratorType', type: 'uint8' },
          { name: 'quoteToken', type: 'address' },
          { name: 'quoteAmt', type: 'uint256' },
          { name: 'beneficiary', type: 'address' },
          { name: 'permitData', type: 'bytes' },
        ],
      },
    ],
    name: 'newTokenV2',
    outputs: [{ name: 'token', type: 'address' }],
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
