// FairMint Contract Addresses and ABIs
import { parseAbi } from 'viem';

export const FAIR_MINT_FACTORY_ADDRESS = '0xC86A1f66693f4F308b7d468186F160842eADdC42' as const;

// Blacklist for hiding test tokens from frontend
// Add token addresses here to hide them (lowercase)
export const FAIR_MINT_BLACKLIST: string[] = [
  '0xc97033e2e5b830acb5afc67809a5dce80a63ebd6', // test token (Fair Mint)
  '0x3f08cea28a07acbd20793547def4ccf7fd5c6726', // test token (Agent-Only)
];

export const FAIR_MINT_FACTORY_ABI = parseAbi([
  // Views
  'function owner() view returns (address)',
  'function platform() view returns (address)',
  'function router() view returns (address)',
  'function synthID() view returns (address)',
  'function creationFee() view returns (uint256)',
  'function minRaiseBnb() view returns (uint256)',
  'function maxRaiseBnb() view returns (uint256)',
  'function mintFeeRate() view returns (uint256)',
  'function totalTokens() view returns (uint256)',
  'function allTokens(uint256) view returns (address)',
  'function isToken(address) view returns (bool)',
  'function getTokens(uint256 offset, uint256 limit) view returns (address[])',
  'function getTokensByCreator(address) view returns (address[])',
  
  // Write
  'function createToken((string name, string symbol, uint256 totalSupply, uint256 mintPrice, uint256 perWalletLimit, uint256 lpRatioBps, uint256 duration, address beneficiary, bool agentOnly) params) payable returns (address)',
  
  // Events
  'event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint256 totalSupply, uint256 mintPrice, bool agentOnly)',
]);

export const FAIR_MINT_TOKEN_ABI = parseAbi([
  // Views
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function creator() view returns (address)',
  'function beneficiary() view returns (address)',
  'function platform() view returns (address)',
  'function mintPrice() view returns (uint256)',
  'function perWalletLimit() view returns (uint256)',
  'function mintableSupply() view returns (uint256)',
  'function lpSupply() view returns (uint256)',
  'function startTime() view returns (uint256)',
  'function endTime() view returns (uint256)',
  'function agentOnly() view returns (bool)',
  'function mintFeeRate() view returns (uint256)',
  'function totalMinted() view returns (uint256)',
  'function mintedBy(address) view returns (uint256)',
  'function finalized() view returns (bool)',
  'function lpPair() view returns (address)',
  'function emergencyMode() view returns (bool)',
  'function mintProgress() view returns (uint256 minted, uint256 total, bool isSoldOut, bool isEnded)',
  'function remaining() view returns (uint256)',
  'function mintCost(uint256 amountWei) view returns (uint256)',
  'function canFinalize() view returns (bool)',
  'function mintersCount() view returns (uint256)',
  
  // Write
  'function mint(uint256 amountWei) payable',
  'function finalize()',
  'function claimRefund()',
  'function enableEmergency()',
  
  // Events
  'event Minted(address indexed user, uint256 amount, uint256 cost)',
  'event Finalized(address indexed lpPair, uint256 lpTokens, uint256 agentFee, uint256 platformFee)',
  'event Refunded(address indexed user, uint256 amount)',
]);
