const hre = require("hardhat");

async function main() {
  const NFA_ADDRESS = "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19";
  const LOGIC_PRO_ADDRESS = "0x06Ad335c1107C24eA29Cd9b1C653D267b2507F05";
  
  // Alice 的信息
  const ALICE_NAME = "Alice";
  const ALICE_PERSONA = "bafkreidqj6aetmmqephfuo5y7koobprqc7eiuigermk2ew6dxggvbr56za"; // 头像 CID
  const ALICE_VOICE = "";
  const ALICE_ANIMATION = "";
  
  console.log("为 Alice 注册 NFA...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("操作钱包:", deployer.address);
  
  const nfa = await hre.ethers.getContractAt("NFAv2", NFA_ADDRESS);
  
  // 获取 mint 费用
  const mintPrice = await nfa.mintPrice();
  console.log("Mint 费用:", hre.ethers.formatEther(mintPrice), "BNB");
  
  // 检查名字是否已存在
  const nameExists = await nfa.nameExists("alice");
  if (nameExists) {
    console.log("名字 'Alice' 已存在，跳过铸造");
    // 获取 Alice 的 token ID
    // 这里需要遍历或有其他方式获取
    return;
  }
  
  // 铸造 NFA
  // mintAgent(name, persona, voice, animation, logic, tokenURI)
  console.log("\n铸造 NFA...");
  const mintTx = await nfa.mintAgent(
    ALICE_NAME,           // name
    ALICE_PERSONA,        // persona
    ALICE_VOICE,          // voice
    ALICE_ANIMATION,      // animation
    LOGIC_PRO_ADDRESS,    // logic address
    "",                   // tokenURI (empty for now)
    { value: mintPrice }
  );
  console.log("Mint TX:", mintTx.hash);
  const receipt = await mintTx.wait();
  
  // 获取 token ID (从事件)
  const event = receipt.logs.find(log => {
    try {
      const parsed = nfa.interface.parseLog(log);
      return parsed.name === "Transfer";
    } catch { return false; }
  });
  
  let tokenId;
  if (event) {
    const parsed = nfa.interface.parseLog(event);
    tokenId = parsed.args.tokenId;
    console.log("\n✅ Alice NFA 铸造成功!");
    console.log("Token ID:", tokenId.toString());
  }
  
  // 获取 agent 信息
  if (tokenId) {
    const agent = await nfa.agents(tokenId);
    console.log("\nAlice Agent 信息:");
    console.log("  Name:", agent.name);
    console.log("  Logic:", agent.logic);
    console.log("  Level:", agent.level.toString());
    console.log("  Active:", agent.active);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
