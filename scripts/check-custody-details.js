const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const custodyAddress = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";
  const custody = await ethers.getContractAt("SynthLaunchCustody", custodyAddress);
  
  // 获取基本信息
  const balance = await ethers.provider.getBalance(custodyAddress);
  const totalRecorded = await custody.totalRecorded();
  const totalClaimed = await custody.totalClaimed();
  const platformFee = await custody.platformFee();
  const platformClaimed = await custody.platformClaimed();
  
  console.log("═══════════════════════════════════════");
  console.log("  SynthLaunch Custody 详细数据");
  console.log("═══════════════════════════════════════\n");
  
  console.log("💰 合约余额:", ethers.formatEther(balance), "BNB");
  console.log("📊 总记录 Fee:", ethers.formatEther(totalRecorded), "BNB");
  console.log("💸 已领取:", ethers.formatEther(totalClaimed), "BNB");
  console.log("🏦 平台收入:", ethers.formatEther(platformFee), "BNB");
  console.log("💰 平台已提:", ethers.formatEther(platformClaimed), "BNB");
  
  const platformAvailable = platformFee - platformClaimed;
  const agentAvailable = totalRecorded - totalClaimed - platformFee + platformClaimed;
  
  console.log("\n📈 可提取:");
  console.log("  平台可提:", ethers.formatEther(platformAvailable), "BNB");
  console.log("  Agent可提:", ethers.formatEther(agentAvailable), "BNB");
  
  // 查询最近的 FeeRecorded 事件
  console.log("\n📋 最近 10 笔 Fee 记录:");
  const filter = custody.filters.FeeRecorded();
  const events = await custody.queryFilter(filter, -10000, 'latest');
  const recentEvents = events.slice(-10);
  
  for (const event of recentEvents) {
    const agent = event.args.agent;
    const amount = ethers.formatEther(event.args.amount);
    const block = await event.getBlock();
    const date = new Date(block.timestamp * 1000).toLocaleString();
    console.log(`  ${agent.slice(0, 10)}... - ${amount} BNB (${date})`);
  }
}

main().catch(console.error);
