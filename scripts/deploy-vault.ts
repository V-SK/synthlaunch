import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying SynthVault system with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Configuration
  const TREASURY = "0x8028227C43947F41bB431571002D512815D77C4F";
  const PLATFORM_FEE_BPS = 1000; // 10%

  // ============================================
  // Step 1: Deploy SynthVault implementation
  // ============================================
  console.log("\n1. Deploying SynthVault implementation...");
  const SynthVault = await ethers.getContractFactory("SynthVault");
  const vaultImpl = await SynthVault.deploy();
  await vaultImpl.waitForDeployment();
  const vaultImplAddress = await vaultImpl.getAddress();
  console.log("   SynthVault implementation:", vaultImplAddress);

  // ============================================
  // Step 2: Deploy NFALite with deployer as temporary factory
  // (To break circular dependency: NFALite needs Factory, Factory needs NFALite)
  // ============================================
  console.log("\n2. Deploying NFALite (temporary factory = deployer)...");
  const NFALite = await ethers.getContractFactory("NFALite");
  const nfaLite = await NFALite.deploy(deployer.address); // Temp factory
  await nfaLite.waitForDeployment();
  const nfaLiteAddress = await nfaLite.getAddress();
  console.log("   NFALite:", nfaLiteAddress);

  // ============================================
  // Step 3: Deploy SynthVaultFactory
  // ============================================
  console.log("\n3. Deploying SynthVaultFactory...");
  const SynthVaultFactory = await ethers.getContractFactory("SynthVaultFactory");
  const factory = await SynthVaultFactory.deploy(
    TREASURY,
    vaultImplAddress,
    PLATFORM_FEE_BPS
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("   SynthVaultFactory:", factoryAddress);

  // ============================================
  // Step 4: Wire them together
  // ============================================
  console.log("\n4. Wiring contracts...");
  
  // Set NFALite on Factory
  console.log("   Factory.setNFALite(", nfaLiteAddress, ")");
  const tx1 = await factory.setNFALite(nfaLiteAddress);
  await tx1.wait();
  
  // Set real Factory on NFALite
  console.log("   NFALite.setFactory(", factoryAddress, ")");
  const tx2 = await nfaLite.setFactory(factoryAddress);
  await tx2.wait();

  // ============================================
  // Summary
  // ============================================
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("SynthVault Implementation:", vaultImplAddress);
  console.log("NFALite:                  ", nfaLiteAddress);
  console.log("SynthVaultFactory:        ", factoryAddress);
  console.log("----------------------------------------");
  console.log("Treasury:                 ", TREASURY);
  console.log("Platform Fee:             ", PLATFORM_FEE_BPS / 100, "%");
  console.log("========================================");
  
  console.log("\n📋 Next steps:");
  console.log("1. Verify contracts on BscScan (commands below)");
  console.log("2. Submit factory to Flap for audit/verification");
  console.log("3. Integrate into SynthLaunch frontend");
  
  console.log("\n🔍 Verify commands:");
  console.log(`npx hardhat verify --network bscMainnet ${vaultImplAddress}`);
  console.log(`npx hardhat verify --network bscMainnet ${nfaLiteAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network bscMainnet ${factoryAddress} "${TREASURY}" "${vaultImplAddress}" ${PLATFORM_FEE_BPS}`);
  
  console.log("\n⚠️  Note: NFALite was deployed with deployer as temporary factory,");
  console.log("    then updated to real factory. Verify might need manual source submission.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
