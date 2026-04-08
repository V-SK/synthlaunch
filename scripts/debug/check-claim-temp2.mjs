import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';

const abi = parseAbi([
  'function getTokensByAgent(string agentName) view returns (address[])',
  'function getTokenInfo(address token) view returns (string agentName, uint256 totalFees, uint256 claimed, uint256 pendingClaim, address wallet)',
  'function claimable(address token) view returns (uint256)',
]);

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

try {
  // 获取 AliceBTC 的 tokens
  const tokens = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'getTokensByAgent', args: ['AliceBTC'] });
  console.log('AliceBTC tokens:', tokens);
  
  for (const token of tokens) {
    const info = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'getTokenInfo', args: [token] });
    const claimable = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'claimable', args: [token] });
    console.log(`\nToken ${token}:`);
    console.log(`  agentName: ${info[0]}`);
    console.log(`  totalFees: ${formatEther(info[1])} BNB`);
    console.log(`  claimed: ${formatEther(info[2])} BNB`);
    console.log(`  pendingClaim: ${formatEther(info[3])} BNB`);
    console.log(`  claimable: ${formatEther(claimable)} BNB`);
  }
} catch (e) {
  console.log('Error:', e.message);
}
