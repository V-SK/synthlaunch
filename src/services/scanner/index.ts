import { createPublicClient, createWalletClient, http, parseAbiItem, formatEther } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ============ 配置 ============

const FLAP_PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0';
const CUSTODY_CONTRACT = process.env.CUSTODY_CONTRACT_ADDRESS!;
const SCANNER_PRIVATE_KEY = process.env.SCANNER_PRIVATE_KEY!;

// Flap Trade 事件签名
// event Trade(address indexed token, address indexed trader, bool isBuy, uint256 tokenAmount, uint256 ethAmount, uint256 fee)
const TRADE_EVENT = parseAbiItem('event Trade(address indexed token, address indexed trader, bool isBuy, uint256 tokenAmount, uint256 ethAmount, uint256 fee)');

// 托管合约 ABI（只需要 recordFee）
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
] as const;

// ============ 客户端 ============

const publicClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org'),
});

const account = privateKeyToAccount(SCANNER_PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org'),
});

// ============ 状态 ============

let lastProcessedBlock = 0;
const processedTxs = new Set<string>(); // 防止重复处理

// ============ 核心逻辑 ============

async function isTokenRegistered(tokenAddress: string): Promise<boolean> {
  try {
    const agentName = await publicClient.readContract({
      address: CUSTODY_CONTRACT as `0x${string}`,
      abi: CUSTODY_ABI,
      functionName: 'tokenAgent',
      args: [tokenAddress as `0x${string}`],
    });
    return agentName.length > 0;
  } catch {
    return false;
  }
}

async function recordFee(tokenAddress: string, amount: bigint): Promise<string | null> {
  try {
    const hash = await walletClient.writeContract({
      address: CUSTODY_CONTRACT as `0x${string}`,
      abi: CUSTODY_ABI,
      functionName: 'recordFee',
      args: [tokenAddress as `0x${string}`, amount],
    });

    console.log(`[Scanner] Recorded fee: ${formatEther(amount)} BNB for token ${tokenAddress}`);
    console.log(`[Scanner] Tx: ${hash}`);

    return hash;
  } catch (err) {
    console.error(`[Scanner] Failed to record fee:`, err);
    return null;
  }
}

async function processBlock(blockNumber: bigint): Promise<void> {
  console.log(`[Scanner] Processing block ${blockNumber}...`);

  try {
    // 获取 Trade 事件
    const logs = await publicClient.getLogs({
      address: FLAP_PORTAL,
      event: TRADE_EVENT,
      fromBlock: blockNumber,
      toBlock: blockNumber,
    });

    if (logs.length === 0) {
      return;
    }

    console.log(`[Scanner] Found ${logs.length} trade events`);

    // 按 token 聚合 fee
    const feeByToken = new Map<string, bigint>();

    for (const log of logs) {
      const txHash = log.transactionHash;

      // 跳过已处理的交易
      if (processedTxs.has(txHash)) {
        continue;
      }
      processedTxs.add(txHash);

      const token = log.args.token!;
      const fee = log.args.fee!;

      // 只处理我们注册的 token
      const isRegistered = await isTokenRegistered(token);
      if (!isRegistered) {
        continue;
      }

      const current = feeByToken.get(token) || BigInt(0);
      feeByToken.set(token, current + fee);
    }

    // 批量记账
    for (const [token, totalFee] of Array.from(feeByToken.entries())) {
      if (totalFee > BigInt(0)) {
        await recordFee(token, totalFee);
      }
    }

    // 清理旧的 processedTxs（保留最近 1000 条）
    if (processedTxs.size > 1000) {
      const arr = Array.from(processedTxs);
      arr.slice(0, arr.length - 1000).forEach(tx => processedTxs.delete(tx));
    }

  } catch (err) {
    console.error(`[Scanner] Error processing block ${blockNumber}:`, err);
  }
}

async function startScanner(): Promise<void> {
  console.log('[Scanner] Starting...');
  console.log(`[Scanner] Custody contract: ${CUSTODY_CONTRACT}`);
  console.log(`[Scanner] Scanner wallet: ${account.address}`);

  // 获取当前区块
  const currentBlock = await publicClient.getBlockNumber();
  lastProcessedBlock = Number(currentBlock);
  console.log(`[Scanner] Current block: ${lastProcessedBlock}`);

  // 监听新区块
  publicClient.watchBlockNumber({
    onBlockNumber: async (blockNumber) => {
      const blockNum = Number(blockNumber);

      // 处理所有未处理的区块
      for (let b = lastProcessedBlock + 1; b <= blockNum; b++) {
        await processBlock(BigInt(b));
      }

      lastProcessedBlock = blockNum;
    },
    onError: (err) => {
      console.error('[Scanner] Block watcher error:', err);
    },
  });

  console.log('[Scanner] Watching for new blocks...');
}

// ============ 启动 ============

startScanner().catch(console.error);
