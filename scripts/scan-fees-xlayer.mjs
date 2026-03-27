/**
 * X Layer Fee Scanner
 * 扫描 X Layer Flap Portal 的 Trade 事件，记录税费到 SynthLaunchCustody
 *
 * 使用方式:
 *   DEPLOYER_PRIVATE_KEY=0x... node scripts/scan-fees-xlayer.mjs
 */

import { createPublicClient, createWalletClient, http, parseAbiItem, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ============ 配置 ============

const XLAYER_RPC = 'https://xlayerrpc.okx.com';
const FLAP_PORTAL_XLAYER = '0xb30D8c4216E1f21F27444D2FfAee3ad577808678';
const CUSTODY_ADDRESS = '0xC27a0e45d4C95c40Ea1c6376E8824e6f56f2eB5A';

// X Layer chain
const xlayer = {
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: [XLAYER_RPC] } },
};

// Flap Trade 事件（和 BSC 一样）
const TRADE_EVENT = parseAbiItem(
  'event Trade(address indexed token, address indexed trader, bool isBuy, uint256 tokenAmount, uint256 ethAmount, uint256 fee)'
);

// Custody ABI
const CUSTODY_ABI = [
  {
    type: 'function',
    name: 'recordFee',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'tokenAgent',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view'
  }
];

// ============ 初始化 ============

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_KEY) {
  console.error('DEPLOYER_PRIVATE_KEY required');
  process.exit(1);
}

const account = privateKeyToAccount(DEPLOYER_KEY);
const publicClient = createPublicClient({ chain: xlayer, transport: http(XLAYER_RPC) });
const walletClient = createWalletClient({ chain: xlayer, transport: http(XLAYER_RPC), account });

let lastProcessedBlock = 0;
const processedTxs = new Set();

// ============ 核心函数 ============

async function isTokenRegistered(token) {
  try {
    const agentName = await publicClient.readContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'tokenAgent',
      args: [token],
    });
    return agentName.length > 0;
  } catch {
    return false;
  }
}

async function recordFee(token, amount) {
  try {
    const hash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'recordFee',
      args: [token, amount],
    });
    console.log(`[Scanner] ✅ Recorded ${formatEther(amount)} OKB for ${token} | tx: ${hash}`);
    return hash;
  } catch (err) {
    console.error(`[Scanner] ❌ Failed to record fee:`, err.message);
    return null;
  }
}

async function processBlock(blockNumber) {
  try {
    const logs = await publicClient.getLogs({
      address: FLAP_PORTAL_XLAYER,
      event: TRADE_EVENT,
      fromBlock: blockNumber,
      toBlock: blockNumber,
    });

    if (logs.length === 0) return;
    console.log(`[Scanner] Block ${blockNumber}: ${logs.length} trades`);

    const feeByToken = new Map();

    for (const log of logs) {
      const txHash = log.transactionHash;
      if (processedTxs.has(txHash)) continue;
      processedTxs.add(txHash);

      const token = log.args.token;
      const fee = log.args.fee;

      if (!await isTokenRegistered(token)) continue;

      feeByToken.set(token, (feeByToken.get(token) || 0n) + fee);
    }

    for (const [token, totalFee] of feeByToken) {
      if (totalFee > 0n) await recordFee(token, totalFee);
    }

    if (processedTxs.size > 1000) {
      const arr = Array.from(processedTxs);
      arr.slice(0, arr.length - 1000).forEach(tx => processedTxs.delete(tx));
    }
  } catch (err) {
    console.error(`[Scanner] Error on block ${blockNumber}:`, err.message);
  }
}

async function startScanner() {
  console.log('=== X Layer Fee Scanner ===');
  console.log(`Flap Portal: ${FLAP_PORTAL_XLAYER}`);
  console.log(`Custody:     ${CUSTODY_ADDRESS}`);
  console.log(`Operator:    ${account.address}`);

  const currentBlock = await publicClient.getBlockNumber();
  lastProcessedBlock = Number(currentBlock);
  console.log(`Starting from block: ${lastProcessedBlock}`);

  publicClient.watchBlockNumber({
    onBlockNumber: async (blockNumber) => {
      const blockNum = Number(blockNumber);
      for (let b = lastProcessedBlock + 1; b <= blockNum; b++) {
        await processBlock(BigInt(b));
      }
      lastProcessedBlock = blockNum;
    },
    onError: (err) => console.error('[Scanner] Watcher error:', err),
  });

  console.log('[Scanner] Watching X Layer blocks...');
}

startScanner().catch(console.error);
