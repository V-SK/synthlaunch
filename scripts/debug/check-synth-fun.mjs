import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';

const abi = parseAbi([
  'function getAgentWallet(string agentName) view returns (address)',
  'function isWalletBound(string agentName) view returns (bool)',
]);

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

// 尝试各种可能的名称格式
const names = ['synth_fun', '@synth_fun', 'Synth_fun', 'synthfun', 'synth'];
for (const name of names) {
  try {
    const wallet = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'getAgentWallet', args: [name] });
    const bound = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'isWalletBound', args: [name] });
    console.log(`"${name}": wallet=${wallet}, bound=${bound}`);
  } catch (e) {
    console.log(`"${name}": error`);
  }
}
