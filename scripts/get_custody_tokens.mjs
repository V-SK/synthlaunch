import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed1.defibit.io') });

const ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
  'function tokenAgent(address token) external view returns (string)',
]);

// Get the current Supabase tokens first
const SUPA_URL = 'https://aetpzlvzjnkxgblpgbru.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

// Read all token addresses from the full Flap portal token list (on-chain)
// Actually, let's check all addresses in chunks from the logs
const currentBlock = await client.getBlockNumber();
console.log(`Current block: ${currentBlock}`);

// Try scanning from much earlier - 200k blocks (~7 days)  
const tokens = new Map();
const startBlock = currentBlock - 200000n;

for (let from = startBlock; from < currentBlock; from += 2000n) {
  const to = from + 1999n > currentBlock ? currentBlock : from + 1999n;
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
    if (tokens.size > 0 && from === startBlock + 2000n) {
      console.log(`Found tokens starting, continuing scan...`);
    }
  } catch(e) {
    // reduce range on error
  }
}

console.log(`Found ${tokens.size} unique registered tokens`);

// Check fees for each
for (const [token, agent] of tokens) {
  try {
    const fees = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenFees', args: [token] });
    const feesStr = formatEther(fees);
    console.log(`${parseFloat(feesStr) > 0 ? 'HAS_FEES' : 'NO_FEES'}|${token}|${agent}|${feesStr}`);
  } catch(e) {
    console.log(`ERROR|${token}|${agent}`);
  }
}
