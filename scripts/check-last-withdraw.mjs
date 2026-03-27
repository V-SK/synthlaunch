import { createPublicClient, http, parseAbiItem } from 'viem';
import { bsc } from 'viem/chains';

const custodyAddress = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org/')
});

async function main() {
  const latestBlock = await client.getBlockNumber();
  
  // 查询最近的 PlatformFeeWithdrawn 事件
  const events = await client.getLogs({
    address: custodyAddress,
    event: parseAbiItem('event PlatformFeeWithdrawn(address to, uint256 amount)'),
    fromBlock: latestBlock - 100000n,
    toBlock: 'latest'
  });
  
  console.log(`找到 ${events.length} 次提现记录:\n`);
  
  for (const event of events.slice(-5)) {
    const block = await client.getBlock({ blockNumber: event.blockNumber });
    const date = new Date(Number(block.timestamp) * 1000);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);
    
    console.log(`区块: ${event.blockNumber}`);
    console.log(`时间: ${date.toLocaleString('zh-CN', { timeZone: 'America/New_York' })} EST`);
    console.log(`距今: ${diffHours.toFixed(1)} 小时`);
    console.log(`48h 倒计时: ${diffHours >= 48 ? '✅ 已过 48h' : `⏳ 还需 ${(48 - diffHours).toFixed(1)} 小时`}\n`);
  }
}

main().catch(console.error);
