import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const TOKEN = '0x1d5711cbcead740def8a2cc9dab7d24883497777';

const abi = parseAbi([
  'function getTokenInfo(address token) view returns (string agentName, uint256 totalFees, uint256 claimed, uint256 pendingClaim, address wallet)',
  'function claimable(address token) view returns (uint256)',
]);

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

const info = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'getTokenInfo', args: [TOKEN] });
const claimable = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'claimable', args: [TOKEN] });

console.log('Token: ALICE (0x1d57...7777)');
console.log('Agent:', info[0]);
console.log('Total Fees:', formatEther(info[1]), 'BNB');
console.log('Already Claimed:', formatEther(info[2]), 'BNB');
console.log('Pending Claim:', formatEther(info[3]), 'BNB');
console.log('Claimable Now:', formatEther(claimable), 'BNB');
console.log('Bound Wallet:', info[4]);
