const hre = require("hardhat");

async function main() {
  const NFA_CONTRACT = "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19";
  const OPENCLAW_OPERATOR = "0x8028227C43947F41bB431571002D512815D77C4F"; // Alice (OpenClaw)
  
  console.log("部署 AgentLogicPro (BAP-578 Pro 版本)...");
  console.log("NFA 合约:", NFA_CONTRACT);
  console.log("OpenClaw Operator:", OPENCLAW_OPERATOR);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署钱包:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("余额:", hre.ethers.formatEther(balance), "BNB");
  
  // 部署
  const AgentLogicPro = await hre.ethers.getContractFactory("AgentLogicPro");
  const logic = await AgentLogicPro.deploy(NFA_CONTRACT, OPENCLAW_OPERATOR);
  await logic.waitForDeployment();
  
  const address = await logic.getAddress();
  
  console.log("\n✅ AgentLogicPro 部署成功!");
  console.log("合约地址:", address);
  console.log("\n功能:");
  console.log("  - Learning Module (Merkle Tree)");
  console.log("  - Memory Module (On-chain KV)");
  console.log("  - Multi-Agent Delegation");
  console.log("  - OpenClaw AI Integration");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
