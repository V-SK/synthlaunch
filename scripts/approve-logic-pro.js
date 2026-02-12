const hre = require("hardhat");

async function main() {
  const NFA_ADDRESS = "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19";
  const LOGIC_PRO_ADDRESS = "0x06Ad335c1107C24eA29Cd9b1C653D267b2507F05";
  
  console.log("在 NFAv2 中添加 AgentLogicPro 到白名单...");
  
  const nfa = await hre.ethers.getContractAt("NFAv2", NFA_ADDRESS);
  
  const isApproved = await nfa.approvedLogic(LOGIC_PRO_ADDRESS);
  if (isApproved) {
    console.log("已经在白名单中 ✅");
    return;
  }
  
  const tx = await nfa.approveLogic(
    LOGIC_PRO_ADDRESS, 
    "BAP-578 AgentLogicPro - Learning/Memory/MultiAgent/OpenClaw"
  );
  console.log("TX:", tx.hash);
  await tx.wait();
  
  console.log("✅ AgentLogicPro 已添加到 NFAv2 白名单!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
