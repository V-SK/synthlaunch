import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying SynthVault system with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Configuration
  const TREASURY = "0x8028227C43947F41bB431571002D512815D77C4F";
  const PLATFORM_FEE_BPS = 1000; // 10%

  // Step 1: Deploy SynthVault implementation (template for cloning)
  console.log("\n1. Deploying SynthVault implementation...");
  const SynthVault = await ethers.getContractFactory("SynthVault");
  const vaultImpl = await SynthVault.deploy();
  await vaultImpl.waitForDeployment();
  const vaultImplAddress = await vaultImpl.getAddress();
  console.log("   SynthVault implementation deployed to:", vaultImplAddress);

  // Step 2: Deploy SynthVaultFactory
  console.log("\n2. Deploying SynthVaultFactory...");
  const SynthVaultFactory = await ethers.getContractFactory("SynthVaultFactory");
  const factory = await SynthVaultFactory.deploy(
    TREASURY,
    vaultImplAddress,
    PLATFORM_FEE_BPS
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("   SynthVaultFactory deployed to:", factoryAddress);

  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("SynthVault Implementation:", vaultImplAddress);
  console.log("SynthVaultFactory:", factoryAddress);
  console.log("Treasury:", TREASURY);
  console.log("Platform Fee:", PLATFORM_FEE_BPS / 100, "%");
  console.log("========================================");
  console.log("\nNext steps:");
  console.log("1. Verify contracts on BscScan");
  console.log("2. Submit factory to Flap for audit/verification");
  console.log("3. Integrate into SynthLaunch frontend");
  console.log("\nVerify commands:");
  console.log(`npx hardhat verify --network bscMainnet ${vaultImplAddress}`);
  console.log(`npx hardhat verify --network bscMainnet ${factoryAddress} "${TREASURY}" "${vaultImplAddress}" ${PLATFORM_FEE_BPS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
