// NFA Contract - Non-Fungible Agents
// Deploy first, then update this address (prefer env var in app code)
export const NFA_ADDRESS = "0x396333F75f4e4CE0d9b614BE04b692496C6C18b3" as const;

export const NFA_ABI = [
  // Read functions
  "function totalMinted() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "function nameExists(string) view returns (bool)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function getAgentDetails(uint256) view returns (string name, address logic, string persona, string voice, string animation, uint256 balance, uint256 experience, uint256 level, uint256 createdAt, bool active)",
  "function agents(uint256) view returns (string name, address logic, string persona, string voice, string animation, uint256 balance, uint256 experience, uint256 level, uint256 createdAt, bool active)",
  "function treasury() view returns (address)",
  "function platformFeeBps() view returns (uint256)",

  // Write functions
  "function mintAgent(string name, string persona, string voice, string animation, address logic, string _tokenURI) payable returns (uint256)",
  "function fundAgent(uint256 tokenId) payable",
  "function withdrawFromAgent(uint256 tokenId, uint256 amount)",
  "function evolve(uint256 tokenId, uint256 xp)",
  "function updateMetadata(uint256 tokenId, string persona, string voice, string animation, string _tokenURI)",
  "function setLogicAddress(uint256 tokenId, address logic)",
  "function setActive(uint256 tokenId, bool active)",

  // Events
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, string name)",
  "event AgentFunded(uint256 indexed tokenId, address indexed funder, uint256 amountNet, uint256 fee)",
  "event AgentWithdraw(uint256 indexed tokenId, address indexed to, uint256 amount)",
  "event AgentEvolved(uint256 indexed tokenId, uint256 xpGained, uint256 newLevel)",
  "event AgentMetadataUpdated(uint256 indexed tokenId, string persona, string voice, string animation, string tokenURI)",
  "event AgentLogicUpdated(uint256 indexed tokenId, address newLogic)",
  "event AgentStatusChanged(uint256 indexed tokenId, bool active)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
] as const;

export interface NFAgent {
  id: number;
  name: string;
  logic: string;
  persona: string;
  voice: string;
  animation: string;
  balance: bigint;
  experience: bigint;
  level: bigint;
  createdAt: bigint;
  active: boolean;
  owner?: string;
}

export interface MintAgentParams {
  name: string;
  persona: string;
  voice?: string;
  animation?: string;
  logic?: string;
  tokenURI: string;
}

export const XP_PER_LEVEL = 500n;

export function calculateLevel(experience: bigint): bigint {
  return (experience / XP_PER_LEVEL) + 1n;
}

export function calculateXPProgress(experience: bigint): number {
  const mod = experience % XP_PER_LEVEL;
  // 0..100
  return Number((mod * 10000n) / XP_PER_LEVEL) / 100;
}
