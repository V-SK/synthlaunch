const hre = require("hardhat");

async function main() {
  const NFA_ADDRESS = "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19";
  const LOGIC_ADDRESS = "0x7a08ff7ab3EF202F7B499648a25FCD94Fb5a8857";
  
  console.log("在 NFAv2 中添加 AgentLogic 到白名单...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("操作钱包:", deployer.address);
  
  // 连接 NFAv2
  const nfa = await hre.ethers.getContractAt("NFAv2", NFA_ADDRESS);
  
  // 检查是否已批准
  const isApproved = await nfa.approvedLogic(LOGIC_ADDRESS);
  if (isApproved) {
    console.log("已经在白名单中 ✅");
    return;
  }
  
  // 添加白名单
  const tx = await nfa.approveLogic(LOGIC_ADDRESS, "BAP-578 AgentLogic for BNB Agents Army");
  console.log("TX:", tx.hash);
  await tx.wait();
  
  console.log("\n✅ AgentLogic 已添加到 NFAv2 白名单!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
