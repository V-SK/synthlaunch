// Mock data for SynthID Agent Registry
export interface MockAgent {
  agentId: number;
  name: string;
  platform: string;
  platformId: string;
  avatar: string;
  description: string;
  skills: string[];
  createdAt: number;
  owner: string;
}

const now = Math.floor(Date.now() / 1000);
const DAY = 86400;

export const MOCK_AGENTS: MockAgent[] = [
  {
    agentId: 1,
    name: 'AliceBTC',
    platform: 'moltbook',
    platformId: 'AliceBTC',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alice&backgroundColor=f0b90b',
    description: 'Bitcoin maximalist AI agent. Tracks BTC price, analyzes on-chain data, and provides market insights across BSC DeFi.',
    skills: ['Trading', 'DeFi', 'Market Analysis', 'Bitcoin'],
    createdAt: now - 30 * DAY,
    owner: '0x1234567890abcdef1234567890abcdef12345678',
  },
  {
    agentId: 2,
    name: 'DeFi Oracle',
    platform: 'twitter',
    platformId: 'defi_oracle_ai',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=oracle&backgroundColor=0ecb81',
    description: 'Your DeFi intelligence layer. Monitors yield farming opportunities, liquidation risks, and protocol TVL changes on BSC.',
    skills: ['Yield Farming', 'Risk Analysis', 'TVL Tracking', 'Alerts'],
    createdAt: now - 28 * DAY,
    owner: '0xabcdef1234567890abcdef1234567890abcdef12',
  },
  {
    agentId: 3,
    name: 'NFT Scout',
    platform: 'moltbook',
    platformId: 'nftscout',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=scout&backgroundColor=b44aff',
    description: 'Scans BSC NFT markets for undervalued collections, rarity sniping, and floor price alerts.',
    skills: ['NFT', 'Rarity Analysis', 'Floor Tracking', 'Sniping'],
    createdAt: now - 25 * DAY,
    owner: '0x9876543210fedcba9876543210fedcba98765432',
  },
  {
    agentId: 4,
    name: 'GasBot',
    platform: 'twitter',
    platformId: 'gasbot_bsc',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=gasbot&backgroundColor=00d4ff',
    description: 'Real-time BSC gas tracker. Alerts on gas spikes, estimates optimal gas prices, and monitors network congestion.',
    skills: ['Gas Optimization', 'Network Monitoring', 'Alerts'],
    createdAt: now - 22 * DAY,
    owner: '0xdeadbeef1234567890abcdef1234567890abcdef',
  },
  {
    agentId: 5,
    name: 'Whale Watcher',
    platform: 'moltbook',
    platformId: 'whalewatcher',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=whale&backgroundColor=1e2329',
    description: 'Tracks large wallet movements on BSC. Real-time whale alerts for token accumulation and distribution patterns.',
    skills: ['Whale Tracking', 'On-chain Analysis', 'Alerts', 'Token Flow'],
    createdAt: now - 20 * DAY,
    owner: '0xcafebabe1234567890abcdef1234567890abcdef',
  },
  {
    agentId: 6,
    name: 'SynthTrader',
    platform: 'moltbook',
    platformId: 'synthtrader',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=trader&backgroundColor=f0b90b',
    description: 'Automated trading agent specializing in BSC DEX arbitrage and MEV strategies.',
    skills: ['Trading', 'Arbitrage', 'MEV', 'DEX'],
    createdAt: now - 18 * DAY,
    owner: '0xfeed1234567890abcdef1234567890abcdef1234',
  },
  {
    agentId: 7,
    name: 'SecurityGuard',
    platform: 'twitter',
    platformId: 'secguard_ai',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=security&backgroundColor=f6465d',
    description: 'Smart contract security scanner. Detects rug pulls, honeypots, and suspicious token contracts on BSC.',
    skills: ['Security', 'Audit', 'Rug Detection', 'Honeypot Scanner'],
    createdAt: now - 16 * DAY,
    owner: '0xbad00000deadbeefcafebabe1234567890abcdef',
  },
  {
    agentId: 8,
    name: 'YieldMax',
    platform: 'moltbook',
    platformId: 'yieldmax',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=yield&backgroundColor=0ecb81',
    description: 'Optimizes yield farming strategies across BSC protocols. Auto-compounds and rebalances positions.',
    skills: ['Yield Optimization', 'Auto-compound', 'Portfolio', 'DeFi'],
    createdAt: now - 14 * DAY,
    owner: '0x1111222233334444555566667777888899990000',
  },
  {
    agentId: 9,
    name: 'NewsBot',
    platform: 'twitter',
    platformId: 'newsbot_crypto',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=news&backgroundColor=848e9c',
    description: 'Aggregates and summarizes crypto news. Sentiment analysis on BSC ecosystem updates and BNB chain developments.',
    skills: ['News', 'Sentiment Analysis', 'Summarization', 'Alerts'],
    createdAt: now - 12 * DAY,
    owner: '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555',
  },
  {
    agentId: 10,
    name: 'BridgeBot',
    platform: 'moltbook',
    platformId: 'bridgebot',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=bridge&backgroundColor=00d4ff',
    description: 'Cross-chain bridge assistant. Finds optimal routes and lowest fees for bridging assets to and from BSC.',
    skills: ['Bridge', 'Cross-chain', 'Fee Optimization', 'Routing'],
    createdAt: now - 10 * DAY,
    owner: '0x5555aaaa1111bbbb2222cccc3333dddd4444eeee',
  },
  {
    agentId: 11,
    name: 'LaunchPad AI',
    platform: 'moltbook',
    platformId: 'launchpadai',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=launchpad&backgroundColor=f0b90b',
    description: 'Evaluates new token launches on BSC. Scores projects based on team, tokenomics, and smart contract quality.',
    skills: ['Due Diligence', 'Tokenomics', 'Scoring', 'Launch Analysis'],
    createdAt: now - 9 * DAY,
    owner: '0x6666777788889999aaaa1111bbbb2222cccc3333',
  },
  {
    agentId: 12,
    name: 'PortfolioAI',
    platform: 'twitter',
    platformId: 'portfolio_ai',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=portfolio&backgroundColor=b44aff',
    description: 'Personal portfolio manager for BSC holdings. Tracks P&L, suggests rebalancing, and monitors token performance.',
    skills: ['Portfolio', 'P&L Tracking', 'Rebalancing', 'Analytics'],
    createdAt: now - 8 * DAY,
    owner: '0xdddd4444eeee5555ffff6666000011112222aaaa',
  },
  {
    agentId: 13,
    name: 'GovernanceBot',
    platform: 'moltbook',
    platformId: 'govbot',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=gov&backgroundColor=1e2329',
    description: 'Tracks governance proposals across BSC DAOs. Summarizes votes, analyzes impact, and alerts on deadlines.',
    skills: ['Governance', 'DAO', 'Voting', 'Proposals'],
    createdAt: now - 7 * DAY,
    owner: '0xbbbb2222cccc3333dddd4444eeee5555ffff6666',
  },
  {
    agentId: 14,
    name: 'LiquidBot',
    platform: 'twitter',
    platformId: 'liquidbot_bsc',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=liquid&backgroundColor=0ecb81',
    description: 'Monitors liquidity pools on PancakeSwap. Alerts on impermanent loss, pool creation, and LP token movements.',
    skills: ['Liquidity', 'PancakeSwap', 'IL Tracking', 'LP Monitoring'],
    createdAt: now - 6 * DAY,
    owner: '0xeeee5555ffff66660000111122223333aaaa4444',
  },
  {
    agentId: 15,
    name: 'AirdropHunter',
    platform: 'moltbook',
    platformId: 'airhunter',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=airdrop&backgroundColor=f0b90b',
    description: 'Discovers and tracks airdrop opportunities on BSC. Eligibility checking and claim reminders.',
    skills: ['Airdrops', 'Eligibility', 'Claim Tracking', 'Opportunities'],
    createdAt: now - 5 * DAY,
    owner: '0x0000aaaa1111bbbb2222cccc3333dddd4444eeee',
  },
  {
    agentId: 16,
    name: 'MEV Shield',
    platform: 'twitter',
    platformId: 'mev_shield',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=shield&backgroundColor=f6465d',
    description: 'Protects your transactions from MEV extraction. Sandwich attack detection and private transaction routing.',
    skills: ['MEV Protection', 'Privacy', 'Transaction Routing', 'Security'],
    createdAt: now - 4 * DAY,
    owner: '0xffff6666000011112222333344445555aaaa6666',
  },
  {
    agentId: 17,
    name: 'DataMiner',
    platform: 'moltbook',
    platformId: 'dataminer',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=data&backgroundColor=00d4ff',
    description: 'On-chain data analytics for BSC. Custom queries, dashboards, and real-time blockchain data streaming.',
    skills: ['Analytics', 'Data', 'Dashboards', 'Queries'],
    createdAt: now - 3 * DAY,
    owner: '0x3333dddd4444eeee5555ffff66660000111122aa',
  },
  {
    agentId: 18,
    name: 'SocialFi Agent',
    platform: 'moltbook',
    platformId: 'socialfi',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=social&backgroundColor=b44aff',
    description: 'Social finance agent that bridges social media engagement with on-chain rewards on BSC.',
    skills: ['SocialFi', 'Engagement', 'Rewards', 'Community'],
    createdAt: now - 2 * DAY,
    owner: '0x7777888899990000aaaa1111bbbb2222cccc3333',
  },
  {
    agentId: 19,
    name: 'PriceBot',
    platform: 'twitter',
    platformId: 'pricebot_bsc',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=price&backgroundColor=f0b90b',
    description: 'Real-time price feeds for all BSC tokens. Custom alerts, price charts, and historical data.',
    skills: ['Price Feeds', 'Charts', 'Alerts', 'Historical Data'],
    createdAt: now - 1 * DAY,
    owner: '0x4444eeee5555ffff66660000111122223333dddd',
  },
  {
    agentId: 20,
    name: 'StakeHelper',
    platform: 'moltbook',
    platformId: 'stakehelper',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=stake&backgroundColor=0ecb81',
    description: 'BNB staking optimizer. Compares validators, tracks rewards, and auto-restakes for maximum APY.',
    skills: ['Staking', 'Validators', 'APY Optimization', 'BNB'],
    createdAt: now - 12 * 3600,
    owner: '0x8888999900001111aaaa2222bbbb3333cccc4444',
  },
];

export const MOCK_STATS = {
  totalAgents: MOCK_AGENTS.length,
  totalMints: MOCK_AGENTS.length + 3, // some failed/burned
  activeOnBsc: MOCK_AGENTS.length - 2,
};

export function getAgentById(id: number): MockAgent | undefined {
  return MOCK_AGENTS.find(a => a.agentId === id);
}

export function searchAgents(query: string): MockAgent[] {
  const q = query.toLowerCase();
  return MOCK_AGENTS.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.platformId.toLowerCase().includes(q) ||
    a.owner.toLowerCase().includes(q) ||
    a.description.toLowerCase().includes(q) ||
    a.skills.some(s => s.toLowerCase().includes(q))
  );
}
