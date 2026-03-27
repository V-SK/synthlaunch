import { createPublicClient, http, formatEther } from 'viem';
import { bsc } from 'viem/chains';

const custodyAddress = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";
const synthToken = "0x83c8c815bbf6a239816aa0b14ba9d9222b817777";

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
  },
  {
    "inputs": [{"type": "address", "name": "token"}],
    "name": "claimableAfterFee",
    "outputs": [
      {"type": "uint256", "name": "payout"},
      {"type": "uint256", "name": "fee"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main() {
  const [tokenInfo, afterFee] = await Promise.all([
    client.readContract({ 
      address: custodyAddress, 
      abi: custodyAbi, 
      functionName: 'getTokenInfo',
      args: [synthToken]
    }),
    client.readContract({ 
      address: custodyAddress, 
      abi: custodyAbi, 
      functionName: 'claimableAfterFee',
      args: [synthToken]
    })
  ]);
  
  const [agentName, totalFees, claimed, pendingClaim, wallet] = tokenInfo;
  const [payout, fee] = afterFee;
  
  console.log("═══════════════════════════════════════");
  console.log("  $SYNTH Token Fee 数据");
  console.log("═══════════════════════════════════════\n");
  
  console.log("🪙 Token:", synthToken);
  console.log("🤖 Agent:", agentName || "(未注册)");
  console.log("💼 绑定钱包:", wallet);
  
  console.log("\n💰 Fee 数据:");
  console.log("  总收入:", formatEther(totalFees), "BNB");
  console.log("  已领取:", formatEther(claimed), "BNB");
  console.log("  待领取:", formatEther(pendingClaim), "BNB");
  
  console.log("\n📊 可提取 (扣 20% 平台费):");
  console.log("  实际到手:", formatEther(payout), "BNB (~$" + Math.round(Number(formatEther(payout)) * 770) + ")");
  console.log("  平台费:", formatEther(fee), "BNB");
}

main().catch(console.error);
