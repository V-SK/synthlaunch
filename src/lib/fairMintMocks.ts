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
}

const now = Math.floor(Date.now() / 1000);

export const FAIR_MINT_TOKENS: FairMintToken[] = [
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
  },
];

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
