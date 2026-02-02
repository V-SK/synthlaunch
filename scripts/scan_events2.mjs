import { createPublicClient, http, parseAbi, formatEther, getAddress } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({ 
  chain: bsc, 
  transport: http('https://bsc-dataseed.bnbchain.org') 
});

const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
  'function tokenAgent(address token) external view returns (string)',
]);

const currentBlock = await client.getBlockNumber();
console.log(`Block: ${currentBlock}`);

// Scan 10000 blocks at a time, last 60000 blocks
const tokens = new Map();
const start = currentBlock - 60000n;

for (let from = start; from <= currentBlock; from += 10000n) {
  const to = from + 9999n > currentBlock ? currentBlock : from + 9999n;
  console.log(`Scanning ${from}-${to}...`);
  try {
    const logs = await client.getLogs({
      address: CUSTODY,
      event: { type: 'event', name: 'TokenRegistered', inputs: [
        { indexed: true, name: 'token', type: 'address' },
        { indexed: false, name: 'agentName', type: 'string' },
      ]},
      fromBlock: from,
      toBlock: to,
    });
    console.log(`  Found ${logs.length} events`);
    for (const log of logs) {
      tokens.set(log.args.token.toLowerCase(), log.args.agentName);
    }
  } catch(e) {
    console.log(`  Error: ${e.shortMessage || e.message?.substring(0,80)}`);
  }
}

console.log(`\nTotal unique tokens: ${tokens.size}`);

for (const [token, agent] of tokens) {
  try {
    const fees = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenFees', args: [getAddress(token)] });
    const feesStr = formatEther(fees);
    console.log(`${parseFloat(feesStr) > 0 ? 'FEES' : 'ZERO'}|${token}|${agent}|${feesStr}`);
  } catch(e) {}
}
