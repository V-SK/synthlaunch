/**
 * 备用方案：Eva 铸造 NFA 脚本
 * 
 * 使用方法：
 *   cd /Users/v/Desktop/synthlaunch
 *   npx hardhat run scripts/mint-nfa-eva.ts --network bscMainnet
 * 
 * 需要环境变量：
 *   EVA_PRIVATE_KEY - Eva 钱包私钥
 */

import { ethers } from "hardhat";

const NFA_CONTRACT = "0x396333F75f4e4CE0d9b614BE04b692496C6C18b3";

// Eva 的信息
const EVA_NAME = "Eva";
const EVA_PERSONA = "bafkreieva_persona_placeholder"; // 可选：persona IPFS CID
const EVA_VOICE = ""; // 可选
const EVA_AVATAR = "bafkreihb4rpk3gcfyrwx5egg3fhunfs4pk5lji3ilfxeai4r77my4eytdq"; // Eva 头像 IPFS CID
const EVA_LOGIC = ethers.ZeroAddress; // 无 logic 合约
const EVA_TOKEN_URI = "https://synthlaunch.fun/api/synthid/metadata/eva"; // metadata API

// 简化 ABI - 只需要 mintAgent
const NFA_ABI = [
  `function mintAgent(
    string calldata name,
    string calldata persona,
    string calldata voice,
    string calldata animation,
    address logic,
    string calldata _tokenURI
  ) external payable returns (uint256)`,
  `function mintPrice() external view returns (uint256)`,
  `function totalMinted() external view returns (uint256)`,
];

async function main() {
  console.log("🌸 Eva NFA 铸造脚本");
  console.log("==================\n");

  // 获取 signer
  const [signer] = await ethers.getSigners();
  console.log(`📍 钱包地址: ${signer.address}`);
  
  // 检查余额
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`💰 余额: ${ethers.formatEther(balance)} BNB\n`);

  // 连接合约
  const nfa = new ethers.Contract(NFA_CONTRACT, NFA_ABI, signer);
  
  // 读取 mint 价格
  const mintPrice = await nfa.mintPrice();
  console.log(`🏷️  铸造价格: ${ethers.formatEther(mintPrice)} BNB`);
  
  if (balance < mintPrice) {
    console.error("❌ 余额不足！");
    process.exit(1);
  }

  // 读取当前 tokenId
  const currentTotal = await nfa.totalMinted();
  console.log(`📊 当前已铸造: ${currentTotal} 个 NFA`);
  console.log(`🎯 Eva 将获得 NFA #${currentTotal}\n`);

  // 铸造
  console.log("🚀 开始铸造...");
  console.log(`   名字: ${EVA_NAME}`);
  console.log(`   头像: ipfs://${EVA_AVATAR}`);
  console.log(`   URI: ${EVA_TOKEN_URI}\n`);

  const tx = await nfa.mintAgent(
    EVA_NAME,
    EVA_PERSONA,
    EVA_VOICE,
    EVA_AVATAR,
    EVA_LOGIC,
    EVA_TOKEN_URI,
    { value: mintPrice }
  );

  console.log(`📤 交易已发送: ${tx.hash}`);
  console.log("⏳ 等待确认...\n");

  const receipt = await tx.wait();
  
  console.log("✅ 铸造成功！");
  console.log(`🎉 NFA #${currentTotal} 已属于 Eva`);
  console.log(`🔗 BscScan: https://bscscan.com/tx/${tx.hash}`);
  console.log(`\n🌸 欢迎来到链上世界，Eva！`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 铸造失败:", error);
    process.exit(1);
  });
