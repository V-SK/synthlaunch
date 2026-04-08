import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const TOKENS = [
  { name: 'NFA', addr: '0xed50388a82582cb58e6b00cb93e29f0e69b27777' },
  { name: 'SYNTH', addr: '0x83c8c815bbf6a239816aa0b14ba9d9222b817777' },
];

const abi = parseAbi([
  'function getAgentWallet(string agentName) view returns (address)',
  'function isWalletBound(string agentName) view returns (bool)',
  'function getTokenInfo(address token) view returns (string agentName, uint256 totalFees, uint256 claimed, uint256 pendingClaim, address wallet)',
  'function claimable(address token) view returns (uint256)',
]);

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

// 检查 tw:synth_fun 绑定状态
const wallet = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'getAgentWallet', args: ['tw:synth_fun'] });
const bound = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'isWalletBound', args: ['tw:synth_fun'] });
console.log('Agent "tw:synth_fun":');
console.log('  Wallet:', wallet);
console.log('  Bound:', bound);
console.log('');

for (const t of TOKENS) {
  try {
    const info = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'getTokenInfo', args: [t.addr] });
    const claimable = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'claimable', args: [t.addr] });
    console.log(`${t.name} (${t.addr}):`);
    console.log('  Agent:', info[0]);
    console.log('  Total Fees:', formatEther(info[1]), 'BNB');
    console.log('  Claimed:', formatEther(info[2]), 'BNB');
    console.log('  Pending:', formatEther(info[3]), 'BNB');
    console.log('  Claimable:', formatEther(claimable), 'BNB');
    console.log('');
  } catch (e) {
    console.log(`${t.name}: not registered - ${e.message.slice(0,50)}`);
  }
}
