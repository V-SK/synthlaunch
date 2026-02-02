import { createPublicClient, http, parseAbi, formatEther, getAddress } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed1.defibit.io') });
const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
  'function tokenAgent(address token) external view returns (string)',
]);

// Contract created at block 78784454, scan from there
const START = 78784454n;
const currentBlock = await client.getBlockNumber();
console.log(`Scanning blocks ${START} to ${currentBlock} (${currentBlock - START} blocks)`);

const tokens = new Map();
for (let from = START; from <= currentBlock; from += 1000n) {
  const to = from + 999n > currentBlock ? currentBlock : from + 999n;
  try {
    const logs = await client.request({
      method: 'eth_getLogs',
      params: [{
        address: CUSTODY,
        topics: ['0xaaed15520cc86e95b7c2522d968096283afbef7858bdf194b2f60d28a1a8d63e'],
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
      }]
    });
    if (logs.length > 0) {
      for (const log of logs) {
        const addr = '0x' + log.topics[1].slice(-40);
        tokens.set(addr.toLowerCase(), true);
      }
    }
  } catch(e) {
    // try smaller
    for (let f2 = from; f2 <= to; f2 += 200n) {
      const t2 = f2 + 199n > to ? to : f2 + 199n;
      try {
        const logs2 = await client.request({
          method: 'eth_getLogs',
          params: [{
            address: CUSTODY,
            topics: ['0xaaed15520cc86e95b7c2522d968096283afbef7858bdf194b2f60d28a1a8d63e'],
            fromBlock: `0x${f2.toString(16)}`,
            toBlock: `0x${t2.toString(16)}`,
          }]
        });
        for (const log of logs2) {
          const addr = '0x' + log.topics[1].slice(-40);
          tokens.set(addr.toLowerCase(), true);
        }
      } catch(e2) {}
    }
  }
}

console.log(`\nFound ${tokens.size} registered tokens`);

// Check fees
let total = 0n;
const withFees = [];
for (const token of tokens.keys()) {
  try {
    const fees = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenFees', args: [getAddress(token)] });
    const agent = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenAgent', args: [getAddress(token)] });
    if (fees > 0n) {
      total += fees;
      withFees.push({ token, agent, fees: formatEther(fees) });
      console.log(`FEES|${token}|${agent}|${formatEther(fees)}`);
    }
  } catch(e) {}
}
console.log(`\nTotal fees: ${formatEther(total)} BNB`);
console.log(`Tokens with fees: ${withFees.length}`);
console.log(`\nALL_ADDRESSES:`);
for (const token of tokens.keys()) {
  console.log(token);
}
