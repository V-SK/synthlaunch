import { createPublicClient, http, formatEther } from 'viem';
import { bsc } from 'viem/chains';

const custodyAddress = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org/')
});

const custodyAbi = [
  {
    "inputs": [{"type": "address", "name": "token"}],
    "name": "getTokenInfo",
    "outputs": [
      {"type": "string", "name": "agentName"},
      {"type": "uint256", "name": "totalFees"},
      {"type": "uint256", "name": "claimed"},
      {"type": "uint256", "name": "pendingClaim"},
      {"type": "address", "name": "wallet"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main() {
  // 从 API 获取所有 token 地址
  const response = await fetch('https://synthlaunch.fun/api/tokens?limit=200');
  const tokens = await response.json();
  
  console.log("═══════════════════════════════════════");
  console.log(`  所有 Token 的 Fee 统计 (${tokens.length} tokens)`);
  console.log("═══════════════════════════════════════\n");
  
  let totalPending = 0n;
  const tokensWithFees = [];
  
  for (const token of tokens) {
    try {
      const info = await client.readContract({
        address: custodyAddress,
        abi: custodyAbi,
        functionName: 'getTokenInfo',
        args: [token.address]
      });
      
      const [agentName, totalFees, claimed, pendingClaim, wallet] = info;
      
      if (pendingClaim > 0n) {
        tokensWithFees.push({
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          agentName,
          totalFees,
          claimed,
          pendingClaim,
          wallet
        });
        totalPending += pendingClaim;
      }
    } catch (e) {
      // Token 未注册到 custody，跳过
    }
  }
  
  // 按待领取金额排序
  tokensWithFees.sort((a, b) => Number(b.pendingClaim - a.pendingClaim));
  
  console.log(`找到 ${tokensWithFees.length} 个有待领取 fee 的 token:\n`);
  
  for (const t of tokensWithFees.slice(0, 10)) {
    console.log(`💰 ${t.symbol} (${t.name})`);
    console.log(`   地址: ${t.address}`);
    console.log(`   Agent: ${t.agentName}`);
    console.log(`   待领取: ${formatEther(t.pendingClaim)} BNB (~$${Math.round(Number(formatEther(t.pendingClaim)) * 770)})`);
    console.log(`   钱包: ${t.wallet || '未绑定'}\n`);
  }
  
  console.log("═══════════════════════════════════════");
  console.log(`📊 总计待领取: ${formatEther(totalPending)} BNB (~$${Math.round(Number(formatEther(totalPending)) * 770)})`);
}

main().catch(console.error);
