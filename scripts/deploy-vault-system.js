/**
 * SynthLaunch Vault System 部署脚本
 * 
 * 部署三个合约：
 * 1. SynthVault (实现合约，作为 Clone 模板)
 * 2. NFALite (Agent 身份 NFT)
 * 3. SynthVaultFactory (工厂，被 Flap VaultPortal 调用)
 * 
 * 工作原理：
 * - 当用户在 Flap 发 tax token 时，VaultPortal 会调用我们的 Factory
 * - Factory 自动部署一个 SynthVault Clone + 铸造一个 NFALite NFT
 * - SynthVault 接收该 token 的税收 BNB，90% 给 Agent，10% 给平台
 * - NFALite 是 Agent 的链上身份证，记录名字、头像、钱包地址等
 * 
 * 权限模型（完全去中心化）：
 * - Factory: 所有参数 immutable，部署后无人能改
 * - NFALite: factory immutable，无 admin 函数
 * - SynthVault: 只有 Flap Guardian 能调用紧急函数
 * 
 * 使用方法：
 * npx hardhat run scripts/deploy-vault-system.js --network bscMainnet
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // ============ 配置参数 ============
  
  // SynthLaunch 平台 Treasury（收取 10% 平台费）
  const TREASURY = "0x8028227C43947F41bB431571002D512815D77C4F";
  
  // 平台费率：1000 = 10%（符合 Flap 要求 ≤10%）
  const PLATFORM_FEE_BPS = 1000;
  
  // NFT Metadata Base URI（IPFS 或 API）
  // 格式：baseURI + tokenId，例如 "ipfs://Qm.../1" 或 "https://api.synthlaunch.fun/nfa/1"
  const BASE_METADATA_URI = "https://synthlaunch.fun/api/nfa/metadata?id=";
  // 未来可换成 IPFS: "ipfs://QmYourCID/"

  // ============ 预计算 Factory 地址 ============
  // 因为 NFALite 需要知道 Factory 地址（immutable）
  // 我们需要先算出 Factory 将会部署在哪个地址
  
  const deployerNonce = await ethers.provider.getTransactionCount(deployer.address);
  console.log("\nDeployer nonce:", deployerNonce);
  
  // 部署顺序：SynthVault (nonce) → NFALite (nonce+1) → Factory (nonce+2)
  const factoryFutureAddress = ethers.getCreateAddress({
    from: deployer.address,
    nonce: deployerNonce + 2
  });
  console.log("Pre-computed Factory address:", factoryFutureAddress);

  // ============ Step 1: 部署 SynthVault 实现合约 ============
  console.log("\n[1/3] Deploying SynthVault implementation...");
  
  const SynthVault = await ethers.getContractFactory("SynthVault");
  const vaultImpl = await SynthVault.deploy();
  await vaultImpl.waitForDeployment();
  
  const vaultImplAddress = await vaultImpl.getAddress();
  console.log("✅ SynthVault implementation:", vaultImplAddress);

  // ============ Step 2: 部署 NFALite ============
  console.log("\n[2/3] Deploying NFALite...");
  
  const NFALite = await ethers.getContractFactory("NFALite");
  const nfaLite = await NFALite.deploy(factoryFutureAddress, BASE_METADATA_URI);
  await nfaLite.waitForDeployment();
  
  const nfaLiteAddress = await nfaLite.getAddress();
  console.log("✅ NFALite:", nfaLiteAddress);

  // ============ Step 3: 部署 SynthVaultFactory ============
  console.log("\n[3/3] Deploying SynthVaultFactory...");
  
  const SynthVaultFactory = await ethers.getContractFactory("SynthVaultFactory");
  const factory = await SynthVaultFactory.deploy(
    TREASURY,
    vaultImplAddress,
    nfaLiteAddress,
    PLATFORM_FEE_BPS
  );
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("✅ SynthVaultFactory:", factoryAddress);
  
  // 验证地址匹配
  if (factoryAddress.toLowerCase() !== factoryFutureAddress.toLowerCase()) {
    console.error("❌ ERROR: Factory address mismatch!");
    console.error("Expected:", factoryFutureAddress);
    console.error("Got:", factoryAddress);
    process.exit(1);
  }
  console.log("✅ Factory address matches pre-computed address");

  // ============ 部署摘要 ============
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("");
  console.log("Contracts:");
  console.log("  SynthVault (impl):", vaultImplAddress);
  console.log("  NFALite:          ", nfaLiteAddress);
  console.log("  SynthVaultFactory:", factoryAddress);
  console.log("");
  console.log("Configuration:");
  console.log("  Treasury:         ", TREASURY);
  console.log("  Platform Fee:     ", PLATFORM_FEE_BPS / 100, "%");
  console.log("  Metadata Base URI:", BASE_METADATA_URI);
  console.log("");
  console.log("=".repeat(60));
  console.log("NEXT STEPS:");
  console.log("=".repeat(60));
  console.log("1. Verify contracts on BscScan:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${vaultImplAddress}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${nfaLiteAddress} "${factoryAddress}" "${BASE_METADATA_URI}"`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${factoryAddress} "${TREASURY}" "${vaultImplAddress}" "${nfaLiteAddress}" "${PLATFORM_FEE_BPS}"`);
  console.log("");
  console.log("2. Register Factory with Flap VaultPortal:");
  console.log("   Tell Flap team to whitelist:", factoryAddress);
  console.log("=".repeat(60));

  // 保存部署信息到文件
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SynthVault: vaultImplAddress,
      NFALite: nfaLiteAddress,
      SynthVaultFactory: factoryAddress
    },
    config: {
      treasury: TREASURY,
      platformFeeBps: PLATFORM_FEE_BPS,
      baseMetadataURI: BASE_METADATA_URI
    }
  };
  
  const filename = `deployments/vault-system-${hre.network.name}-${Date.now()}.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", filename);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
