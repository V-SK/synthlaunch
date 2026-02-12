const hre = require("hardhat");

async function main() {
  // NFAv2 合约地址
  const NFA_CONTRACT = "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19";
  
  console.log("部署 AgentLogic (BAP-578 逻辑合约)...");
  console.log("NFA 合约:", NFA_CONTRACT);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署钱包:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("余额:", hre.ethers.formatEther(balance), "BNB");
  
  // 部署
  const AgentLogic = await hre.ethers.getContractFactory("AgentLogic");
  const logic = await AgentLogic.deploy(NFA_CONTRACT);
  await logic.waitForDeployment();
  
  const address = await logic.getAddress();
  
  console.log("\n✅ AgentLogic 部署成功!");
  console.log("合约地址:", address);
  console.log("Owner:", deployer.address);
  console.log("NFA Contract:", NFA_CONTRACT);
  
  console.log("\n下一步:");
  console.log("1. 在 NFAv2 调用 approveLogic(" + address + ")");
  console.log("2. 提交到 BNB Agents Army");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
