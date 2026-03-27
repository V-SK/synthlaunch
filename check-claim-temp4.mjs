import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const TOKEN = '0x1d5711cbcead740def8a2cc9dab7d24883497777';
const WALLET = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e';

const abi = parseAbi([
  'function claim(address token)',
]);

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

// 模拟 claim 调用
try {
  const result = await client.simulateContract({
    address: CUSTODY_ADDRESS,
    abi,
    functionName: 'claim',
    args: [TOKEN],
    account: WALLET,
  });
  console.log('✅ Claim simulation SUCCESS');
  console.log('Result:', result);
} catch (e) {
  console.log('❌ Claim simulation FAILED');
  console.log('Error:', e.message);
}
