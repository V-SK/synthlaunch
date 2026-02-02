import { createPublicClient, http, parseAbiItem, formatEther } from 'viem';
import { bsc } from 'viem/chains';

const FLAP_PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0';

const TRADE_EVENT = parseAbiItem('event Trade(address indexed token, address indexed trader, bool isBuy, uint256 tokenAmount, uint256 ethAmount, uint256 fee)');

const publicClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org'),
});

async function backfill(fromBlock: number, toBlock: number, tokenFilter?: string): Promise<void> {
  console.log(`[Backfill] Scanning blocks ${fromBlock} to ${toBlock}...`);

  const BATCH_SIZE = 2000;
  const feeByToken = new Map<string, bigint>();

  for (let start = fromBlock; start <= toBlock; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, toBlock);
    console.log(`[Backfill] Batch ${start} - ${end}...`);

    try {
      const logs = await publicClient.getLogs({
        address: FLAP_PORTAL,
        event: TRADE_EVENT,
        fromBlock: BigInt(start),
        toBlock: BigInt(end),
      });

      for (const log of logs) {
        const token = log.args.token!.toLowerCase();
        const fee = log.args.fee!;

        if (tokenFilter && token !== tokenFilter.toLowerCase()) {
          continue;
        }

        const current = feeByToken.get(token) || BigInt(0);
        feeByToken.set(token, current + fee);
      }

    } catch (err) {
      console.error(`[Backfill] Error at batch ${start}:`, err);
    }

    // 避免 rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  // 输出结果
  console.log('\n[Backfill] Results:');
  for (const [token, totalFee] of Array.from(feeByToken.entries())) {
    console.log(`  ${token}: ${formatEther(totalFee)} BNB`);
  }
}

// 使用：传入区块范围和可选的 token 过滤
const args = process.argv.slice(2);
const fromBlock = parseInt(args[0]) || 45000000;
const toBlock = parseInt(args[1]) || 45100000;
const tokenFilter = args[2];

backfill(fromBlock, toBlock, tokenFilter).catch(console.error);
