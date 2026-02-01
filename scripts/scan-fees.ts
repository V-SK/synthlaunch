/**
 * Fee Scanner Script
 * Monitors BNB transfers to SynthLaunchCustody contract and records fees via API.
 * 
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... ADMIN_SECRET=... node scripts/scan-fees.js
 * 
 * Or run as a cron job every few minutes.
 */

const { createPublicClient, http, formatEther, parseEther } = require('viem');
const { bsc } = require('viem/chains');

const CUSTODY_ADDRESS = '0x6da0b79D66AF28a62371745739C5d346dDdA4b82';
const API_BASE = process.env.API_BASE || 'https://synthlaunch.fun';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const SCAN_BLOCKS = 1000; // ~50 minutes on BSC (3s blocks)

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org'),
});

async function main() {
  if (!ADMIN_SECRET) {
    console.error('ADMIN_SECRET required');
    process.exit(1);
  }

  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock - BigInt(SCAN_BLOCKS);

  console.log(`Scanning blocks ${fromBlock} to ${currentBlock}...`);

  // Get internal transactions (BNB transfers) to custody contract
  // BSC RPC doesn't support trace, so we check the balance change approach
  // For now, scan for direct transfers by checking transaction receipts
  
  const balance = await client.getBalance({ address: CUSTODY_ADDRESS });
  console.log(`Custody contract balance: ${formatEther(balance)} BNB`);

  // For a production scanner, you'd use BscScan API to get internal txns:
  // https://api.bscscan.com/api?module=account&action=txlistinternal&address=CUSTODY&startblock=X
  // 
  // For now, just report the balance
  console.log('');
  console.log('To record fees manually:');
  console.log(`curl -X POST ${API_BASE}/api/record-fee \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"token":"TOKEN_ADDRESS","amount":"AMOUNT_IN_WEI","secret":"${ADMIN_SECRET}"}'`);
}

main().catch(console.error);
