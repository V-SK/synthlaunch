import { createPublicClient, http, parseAbi, formatEther, getAddress } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed1.defibit.io') });

const ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
  'function tokenAgent(address token) external view returns (string)',
]);

const currentBlock = await client.getBlockNumber();
// Contract deployed ~24-48h ago, scan last 60000 blocks (~50h)
const startBlock = currentBlock - 60000n;
const tokens = new Map();

// Scan in 5000-block chunks
for (let from = startBlock; from <= currentBlock; from += 5000n) {
  const to = from + 4999n > currentBlock ? currentBlock : from + 4999n;
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
    for (const log of logs) {
      tokens.set(log.args.token.toLowerCase(), log.args.agentName);
    }
  } catch(e) {
    // Try smaller chunks
    for (let f2 = from; f2 <= to; f2 += 1000n) {
      const t2 = f2 + 999n > to ? to : f2 + 999n;
      try {
        const logs = await client.getLogs({
          address: CUSTODY,
          event: { type: 'event', name: 'TokenRegistered', inputs: [
            { indexed: true, name: 'token', type: 'address' },
            { indexed: false, name: 'agentName', type: 'string' },
          ]},
          fromBlock: f2,
          toBlock: t2,
        });
        for (const log of logs) {
          tokens.set(log.args.token.toLowerCase(), log.args.agentName);
        }
      } catch(e2) {}
    }
  }
}

console.log(`Found ${tokens.size} registered tokens`);

// Check fees for each
const withFees = [];
for (const [token, agent] of tokens) {
  try {
    const fees = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenFees', args: [getAddress(token)] });
    const feesStr = formatEther(fees);
    console.log(`${parseFloat(feesStr) > 0 ? 'FEES' : 'ZERO'}|${token}|${agent}|${feesStr}`);
    if (parseFloat(feesStr) > 0) withFees.push({ token, agent, fees: feesStr });
  } catch(e) {}
}

console.log(`\nTokens with fees: ${withFees.length}`);
