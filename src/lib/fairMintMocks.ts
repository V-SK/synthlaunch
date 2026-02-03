export type TokenType = 'curve' | 'fairMint' | 'agentOnly';

export interface FairMintToken {
  id: string;
  name: string;
  symbol: string;
  image: string;
  description: string;
  creator: string;
  tokenType: TokenType;
  totalSupply: number;
  minted: number;
  mintPrice: number; // in BNB
  perWalletLimit: number;
  mintDuration: string;
  lpRatio: number; // e.g. 0.20 = 20%
  startTime: number; // unix timestamp
  endTime: number; // unix timestamp
  createdAt: number;
  contractAddress?: string;
  lpPairAddress?: string;
}

const now = Math.floor(Date.now() / 1000);

// Mock data removed — will be replaced with on-chain data from FairMintFactory
export const FAIR_MINT_TOKENS: FairMintToken[] = [
  /* No mock tokens — connect to contract for real data */
];

// ── Keep below for reference, removed from production ──
const _REMOVED_MOCKS = [
  {
    id: 'fm-synth-ai',
    name: 'SynthAI',
    symbol: 'SAI',
    image: '',
    description: 'Decentralized AI compute network powered by community fair mint.',
    creator: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    tokenType: 'fairMint',
    totalSupply: 1_000_000,
    minted: 723_500,
    mintPrice: 0.001,
    perWalletLimit: 2000,
    mintDuration: '72h',
    lpRatio: 0.20,
    startTime: now - 48 * 3600,
    endTime: now + 24 * 3600,
    createdAt: now - 48 * 3600,
    contractAddress: '0x2345678901abcdef2345678901abcdef23456789',
  },
  {
    id: 'fm-lobster-dao',
    name: 'LobsterDAO',
    symbol: 'LOBS',
    image: '',
    description: 'Community-governed agent coordination layer. Agent-only mint — SynthID required 🦞',
    creator: '0xaabbccdd11223344556677889900aabbccddeeff',
    tokenType: 'agentOnly',
    totalSupply: 500_000,
    minted: 187_000,
    mintPrice: 0.002,
    perWalletLimit: 1000,
    mintDuration: '7d',
    lpRatio: 0.25,
    startTime: now - 2 * 86400,
    endTime: now + 5 * 86400,
    createdAt: now - 2 * 86400,
    contractAddress: '0x3456789012abcdef3456789012abcdef34567890',
  },
  {
    id: 'fm-neural-net',
    name: 'NeuralSwarm',
    symbol: 'NSWM',
    image: '',
    description: 'Swarm intelligence protocol for on-chain AI agents.',
    creator: '0x9988776655443322110099887766554433221100',
    tokenType: 'fairMint',
    totalSupply: 2_000_000,
    minted: 1_960_000,
    mintPrice: 0.0005,
    perWalletLimit: 5000,
    mintDuration: '48h',
    lpRatio: 0.18,
    startTime: now - 46 * 3600,
    endTime: now + 2 * 3600,
    createdAt: now - 46 * 3600,
    contractAddress: '0x4567890123abcdef4567890123abcdef45678901',
  },
  {
    id: 'fm-deep-shell',
    name: 'DeepShell',
    symbol: 'DSHELL',
    image: '',
    description: 'Privacy-first agent communication protocol. Only verified AI agents can participate 🦞',
    creator: '0xdeadbeefcafebabe1234567890abcdef12345678',
    tokenType: 'agentOnly',
    totalSupply: 750_000,
    minted: 42_000,
    mintPrice: 0.0015,
    perWalletLimit: 1500,
    mintDuration: '72h',
    lpRatio: 0.22,
    startTime: now - 12 * 3600,
    endTime: now + 60 * 3600,
    createdAt: now - 12 * 3600,
    contractAddress: '0x5678901234abcdef5678901234abcdef56789012',
  },
  // Completed tokens
  {
    id: 'fm-quantum-core',
    name: 'QuantumCore',
    symbol: 'QCORE',
    image: '',
    description: 'Quantum-resistant cryptography layer for AI agents. Fair minted and fully distributed.',
    creator: '0x1111222233334444555566667777888899990000',
    tokenType: 'fairMint',
    totalSupply: 500_000,
    minted: 500_000,
    mintPrice: 0.001,
    perWalletLimit: 2500,
    mintDuration: '48h',
    lpRatio: 0.20,
    startTime: now - 5 * 86400,
    endTime: now - 3 * 86400,
    createdAt: now - 5 * 86400,
    contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    lpPairAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
  },
  {
    id: 'fm-synth-swarm',
    name: 'SynthSwarm',
    symbol: 'SWARM',
    image: '',
    description: 'Collaborative AI swarm protocol. Mint ended — all tokens distributed.',
    creator: '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555',
    tokenType: 'agentOnly',
    totalSupply: 300_000,
    minted: 300_000,
    mintPrice: 0.003,
    perWalletLimit: 500,
    mintDuration: '24h',
    lpRatio: 0.30,
    startTime: now - 4 * 86400,
    endTime: now - 3 * 86400,
    createdAt: now - 4 * 86400,
    contractAddress: '0x9876543210fedcba9876543210fedcba98765432',
    lpPairAddress: '0xfedcba9876543210fedcba9876543210fedcba98',
  },
] as FairMintToken[];

export function isCompleted(token: FairMintToken): boolean {
  const nowTs = Math.floor(Date.now() / 1000);
  return token.minted >= token.totalSupply || token.endTime <= nowTs;
}

export function getFairMintProgress(token: FairMintToken): number {
  return token.minted / token.totalSupply;
}

export function getTimeRemaining(token: FairMintToken): string {
  const remaining = token.endTime - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return 'Ended';
  if (remaining < 3600) return `${Math.floor(remaining / 60)}m left`;
  if (remaining < 86400) return `${Math.floor(remaining / 3600)}h left`;
  return `${Math.floor(remaining / 86400)}d ${Math.floor((remaining % 86400) / 3600)}h left`;
}

export function formatSupply(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
