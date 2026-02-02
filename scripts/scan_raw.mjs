import { createPublicClient, http, keccak256, toHex, formatEther, getAddress, parseAbi, decodeEventLog } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({ 
  chain: bsc, 
  transport: http('https://bsc-dataseed1.defibit.io') 
});

const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const topic0 = keccak256(toHex('TokenRegistered(address,string)'));
console.log('Topic0:', topic0);

const ABI = parseAbi([
  'event TokenRegistered(address indexed token, string agentName)',
  'function tokenFees(address token) external view returns (uint256)',
]);

const currentBlock = await client.getBlockNumber();
console.log('Current block:', currentBlock);

const tokens = new Map();
// Try 500-block chunks for last 60000 blocks
const start = currentBlock - 60000n;
let scanned = 0;

for (let from = start; from <= currentBlock; from += 500n) {
  const to = from + 499n > currentBlock ? currentBlock : from + 499n;
  scanned++;
  try {
    const logs = await client.request({
      method: 'eth_getLogs',
      params: [{
        address: CUSTODY,
        topics: [topic0],
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
      }]
    });
    if (logs.length > 0) {
      console.log(`Block ${from}: ${logs.length} events`);
      for (const log of logs) {
        const addr = '0x' + log.topics[1].slice(-40);
        tokens.set(addr.toLowerCase(), true);
      }
    }
  } catch(e) {
    // skip
  }
  if (scanned % 20 === 0) process.stdout.write(`\r${scanned}/120 chunks, ${tokens.size} tokens found`);
}

console.log(`\nTotal: ${tokens.size} tokens`);

// Check fees
for (const token of tokens.keys()) {
  const fees = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenFees', args: [getAddress(token)] });
  const feesStr = formatEther(fees);
  if (parseFloat(feesStr) > 0) {
    console.log(`FEES|${token}|${feesStr}`);
  }
}
