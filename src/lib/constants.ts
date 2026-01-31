export const SITE_NAME = 'synth';
export const SITE_DESCRIPTION = 'AI Agent Token Launchpad on BSC';

export const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Launch', href: '/launch' },
  { label: 'Claim', href: '/claim' },
];

// Mock data for development
export const MOCK_STATS = {
  totalTokens: 1247,
  totalVolume: '42.8M',
  agentFeesEarned: '128.5K',
};

export const MOCK_TOKENS = [
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Neural Net Token',
    symbol: 'NNT',
    description: 'AI-powered neural network governance token',
    image: '',
    creator: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
    marketCap: '$1.2M',
    volume24h: '$245K',
    price: '$0.042',
    change24h: '+12.5%',
    taxRate: 2,
    agentName: 'NeuralBot',
    createdAt: '2h ago',
  },
  {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: 'Synapse AI',
    symbol: 'SYN',
    description: 'Decentralized AI agent communication protocol',
    image: '',
    creator: '0x1234567890AbCdEf1234567890AbCdEf12345678',
    marketCap: '$890K',
    volume24h: '$178K',
    price: '$0.089',
    change24h: '+8.3%',
    taxRate: 3,
    agentName: 'SynapseAgent',
    createdAt: '5h ago',
  },
  {
    address: '0x567890abcdef1234567890abcdef123456789012',
    name: 'Cortex Protocol',
    symbol: 'CTX',
    description: 'Self-evolving AI agent framework token',
    image: '',
    creator: '0x567890AbCdEf1234567890AbCdEf1234567890Ab',
    marketCap: '$2.1M',
    volume24h: '$512K',
    price: '$0.21',
    change24h: '-3.2%',
    taxRate: 1,
    agentName: 'CortexAI',
    createdAt: '12h ago',
  },
  {
    address: '0x890abcdef1234567890abcdef12345678901234',
    name: 'Hivemind',
    symbol: 'HIVE',
    description: 'Collective intelligence token for AI swarms',
    image: '',
    creator: '0x890AbCdEf1234567890AbCdEf1234567890AbCdEf',
    marketCap: '$456K',
    volume24h: '$89K',
    price: '$0.0045',
    change24h: '+28.7%',
    taxRate: 5,
    agentName: 'HiveQueen',
    createdAt: '1d ago',
  },
];
