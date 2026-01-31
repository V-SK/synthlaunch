export interface Token {
  address: string;
  name: string;
  symbol: string;
  image: string;
  description: string;
  creator: string;
  taxRate: number;
  beneficiary: string;
  agentName: string;
  createdAt: string;
  marketCap: string;
  volume24h: string;
  price: string;
  priceChange24h: number;
}

export const MOCK_TOKENS: Token[] = [
  {
    address: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    name: 'Neural Net Token',
    symbol: 'NNT',
    image: '',
    description: 'AI-powered neural network governance token with autonomous decision making capabilities.',
    creator: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
    taxRate: 2,
    beneficiary: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
    agentName: 'NeuralBot',
    createdAt: '2h ago',
    marketCap: '$1.2M',
    volume24h: '$245K',
    price: '$0.042',
    priceChange24h: 12.5,
  },
  {
    address: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
    name: 'Synapse AI',
    symbol: 'SYN',
    image: '',
    description: 'Decentralized AI agent communication protocol enabling multi-agent collaboration.',
    creator: '0x1234567890AbCdEf1234567890AbCdEf12345678',
    taxRate: 3,
    beneficiary: '0x1234567890AbCdEf1234567890AbCdEf12345678',
    agentName: 'SynapseAgent',
    createdAt: '5h ago',
    marketCap: '$890K',
    volume24h: '$178K',
    price: '$0.089',
    priceChange24h: 8.3,
  },
  {
    address: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
    name: 'Cortex Protocol',
    symbol: 'CTX',
    image: '',
    description: 'Self-evolving AI agent framework token powering on-chain intelligence.',
    creator: '0x567890AbCdEf1234567890AbCdEf1234567890Ab',
    taxRate: 1,
    beneficiary: '0x567890AbCdEf1234567890AbCdEf1234567890Ab',
    agentName: 'CortexAI',
    createdAt: '12h ago',
    marketCap: '$2.1M',
    volume24h: '$512K',
    price: '$0.21',
    priceChange24h: -3.2,
  },
  {
    address: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
    name: 'Hivemind',
    symbol: 'HIVE',
    image: '',
    description: 'Collective intelligence token for AI swarms coordinating autonomous tasks.',
    creator: '0x890AbCdEf1234567890AbCdEf1234567890AbCdEf',
    taxRate: 5,
    beneficiary: '0x890AbCdEf1234567890AbCdEf1234567890AbCdEf',
    agentName: 'HiveQueen',
    createdAt: '1d ago',
    marketCap: '$456K',
    volume24h: '$89K',
    price: '$0.0045',
    priceChange24h: 28.7,
  },
  {
    address: '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
    name: 'AliceBTC Agent',
    symbol: 'ALICE',
    image: '',
    description: 'Token powering AliceBTC, a Bitcoin-focused AI trading agent on Moltbook.',
    creator: '0xDeF1234567890AbCdEf1234567890AbCdEf123456',
    taxRate: 2.5,
    beneficiary: '0xDeF1234567890AbCdEf1234567890AbCdEf123456',
    agentName: 'AliceBTC',
    createdAt: '3h ago',
    marketCap: '$3.4M',
    volume24h: '$720K',
    price: '$0.34',
    priceChange24h: 45.2,
  },
];

export function getTokenByAddress(address: string): Token | undefined {
  return MOCK_TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
}

export function getTokensSorted(sort: 'hot' | 'new' | 'top'): Token[] {
  const tokens = [...MOCK_TOKENS];
  switch (sort) {
    case 'hot':
      return tokens.sort((a, b) => parseVolume(b.volume24h) - parseVolume(a.volume24h));
    case 'new':
      return tokens; // already sorted by recency in mock
    case 'top':
      return tokens.sort((a, b) => parseMcap(b.marketCap) - parseMcap(a.marketCap));
    default:
      return tokens;
  }
}

function parseVolume(v: string): number {
  const n = parseFloat(v.replace(/[$,KMB]/g, ''));
  if (v.includes('M')) return n * 1e6;
  if (v.includes('K')) return n * 1e3;
  return n;
}

function parseMcap(v: string): number {
  return parseVolume(v);
}
