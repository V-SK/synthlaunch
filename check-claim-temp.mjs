import { createPublicClient, http, parseAbi } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const WALLET = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e';

const abi = parseAbi([
  'function getAgentWallet(string agentName) view returns (address)',
  'function isWalletBound(string agentName) view returns (bool)',
]);

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

// 检查一些已知的 agent name
const agents = ['AliceBTC', 'synth_fun', 'SynthLaunch', 'alice', 'Alice'];
for (const name of agents) {
  try {
    const wallet = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'getAgentWallet', args: [name] });
    const bound = await client.readContract({ address: CUSTODY_ADDRESS, abi, functionName: 'isWalletBound', args: [name] });
    console.log(`Agent "${name}": wallet=${wallet}, bound=${bound}`);
    if (wallet.toLowerCase() === WALLET.toLowerCase()) {
      console.log(`  ✅ This is YOUR agent!`);
    }
  } catch (e) {
    console.log(`Agent "${name}": error - ${e.message?.slice(0,50)}`);
  }
}
