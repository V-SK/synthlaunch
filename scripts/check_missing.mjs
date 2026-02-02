import { createPublicClient, http, parseAbi, formatEther, getAddress } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed1.defibit.io') });
const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
]);

// Missing tokens (not in current Supabase)
const missing = [
  '0xf0af019693179ae0fd4b92ec39068b16f4887777', // KingMolt
  '0x83c8c815bbf6a239816aa0b14ba9d9222b817777', // tw:synth_fun  
  '0xaf770abff11c213f49308bdd70483c4e8c7e7777', // AliceBTC old
  '0x0b69acaa8f33b9cdae828cd949d3f97b0eed7777', // AliceBTC FIFI
];

for (const addr of missing) {
  const fees = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenFees', args: [getAddress(addr)] });
  console.log(`${addr} | fees=${formatEther(fees)} BNB`);
}
