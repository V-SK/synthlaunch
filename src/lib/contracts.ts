// Multi-chain contract addresses
export const CHAIN_CONFIG = {
  // BSC Mainnet
  56: {
    flapAddress: '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as const,
    custodyAddress: '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7' as const,
    rpc: 'https://bsc-dataseed.binance.org',
    nativeSymbol: 'BNB',
    explorer: 'https://bscscan.com',
    flapUrl: 'https://flap.sh',
    vanitySuffix: { standard: '8888', tax: '7777' },
  },
  // X Layer Mainnet
  196: {
    flapAddress: '0xb30D8c4216E1f21F27444D2FfAee3ad577808678' as const,
    custodyAddress: '0xC27a0e45d4C95c40Ea1c6376E8824e6f56f2eB5A' as const,
    rpc: 'https://xlayerrpc.okx.com',
    nativeSymbol: 'OKB',
    explorer: 'https://www.oklink.com/x-layer',
    flapUrl: 'https://flap.sh',
    vanitySuffix: { standard: '1111', tax: '7777' },
  },
} as const;

export type SupportedChainId = keyof typeof CHAIN_CONFIG;
export const DEFAULT_CHAIN_ID: SupportedChainId = 56;

// Legacy BSC exports (backward compat)
export const FLAP_ADDRESS = CHAIN_CONFIG[56].flapAddress;

export const CLAIM_WRAPPER_ADDRESS = '0x5E0E823D56f3DB90c86dfccff935670595e92047' as const;
export const SYNTH_TOKEN_ADDRESS = '0x83c8c815bbf6a239816aa0b14ba9d9222b817777' as const;

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
