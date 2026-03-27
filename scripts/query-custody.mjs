import { createPublicClient, http, formatEther, parseAbiItem } from 'viem';
import { bsc } from 'viem/chains';

const custodyAddress = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org/')
});

const custodyAbi = [
  {
    "inputs": [],
    "name": "totalRecorded",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalClaimedAmount",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platformFeeBalance",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platformFeeRate",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main() {
  // 获取余额
  const balance = await client.getBalance({ address: custodyAddress });
  
  // 获取合约数据
  const [totalRecorded, totalClaimed, platformFeeBalance, platformFeeRate] = await Promise.all([
    client.readContract({ address: custodyAddress, abi: custodyAbi, functionName: 'totalRecorded' }),
    client.readContract({ address: custodyAddress, abi: custodyAbi, functionName: 'totalClaimedAmount' }),
    client.readContract({ address: custodyAddress, abi: custodyAbi, functionName: 'platformFeeBalance' }),
    client.readContract({ address: custodyAddress, abi: custodyAbi, functionName: 'platformFeeRate' })
  ]);
  
  console.log("═══════════════════════════════════════");
  console.log("  SynthLaunch Custody 详细数据");
  console.log("  " + new Date().toLocaleString());
  console.log("═══════════════════════════════════════\n");
  
  console.log("💰 合约余额:", formatEther(balance), "BNB");
  console.log("📊 总记录 Fee:", formatEther(totalRecorded), "BNB");
  console.log("💸 已领取:", formatEther(totalClaimed), "BNB");
  console.log("🏦 平台费余额:", formatEther(platformFeeBalance), "BNB");
  console.log("⚙️  平台费率:", Number(platformFeeRate) / 100 + "%");
  
  const unclaimed = totalRecorded - totalClaimed;
  const agentAvailable = balance - platformFeeBalance;
  
  console.log("\n📈 可提取:");
  console.log("  🏦 平台可提:", formatEther(platformFeeBalance), "BNB (~$" + Math.round(Number(formatEther(platformFeeBalance)) * 770) + ")");
  console.log("  🤖 Agent 未领:", formatEther(unclaimed), "BNB (~$" + Math.round(Number(formatEther(unclaimed)) * 770) + ")");
  console.log("  💧 合约余额 (扣平台费):", formatEther(agentAvailable), "BNB");
  
  // 查询最近的 FeeRecorded 事件
  const latestBlock = await client.getBlockNumber();
  const fromBlock = latestBlock - 10000n;
  
  console.log(`\n📋 查询最近 fee 记录 (区块 ${fromBlock} - ${latestBlock})...`);
  
  const events = await client.getLogs({
    address: custodyAddress,
    event: parseAbiItem('event FeeRecorded(address indexed token, uint256 amount)'),
    fromBlock: fromBlock,
    toBlock: 'latest'
  });
  
  console.log(`\n找到 ${events.length} 笔记录，显示最近 10 笔:\n`);
  const recentEvents = events.slice(-10);
  
  let totalRecent = 0n;
  for (const event of recentEvents) {
    const amount = formatEther(event.args.amount);
    totalRecent += event.args.amount;
    const block = await client.getBlock({ blockNumber: event.blockNumber });
    const date = new Date(Number(block.timestamp) * 1000).toLocaleString();
    const token = event.args.token;
    console.log(`  💰 ${amount} BNB - ${token.slice(0, 8)}... (${date})`);
  }
  
  console.log(`\n💎 最近 10 笔总计: ${formatEther(totalRecent)} BNB`);
  
  // 统计
  const total24h = events.filter(e => {
    return e.blockNumber > latestBlock - BigInt(28800); // ~24h (3s/block)
  }).reduce((sum, e) => sum + e.args.amount, 0n);
  
  const total7d = events.filter(e => {
    return e.blockNumber > latestBlock - BigInt(201600); // ~7d
  }).reduce((sum, e) => sum + e.args.amount, 0n);
  
  console.log(`\n📊 时间段统计:`);
  console.log(`  24h 新增: ${formatEther(total24h)} BNB (~$${Math.round(Number(formatEther(total24h)) * 770)})`);
  console.log(`  7d 新增: ${formatEther(total7d)} BNB (~$${Math.round(Number(formatEther(total7d)) * 770)})`);
}

main().catch(console.error);
