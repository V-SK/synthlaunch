import { ethers, run } from "hardhat";

async function main() {
  console.log("🚀 Deploying SynthID to BSC mainnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB\n");

  const SynthID = await ethers.getContractFactory("SynthID");
  const synthid = await SynthID.deploy();
  await synthid.waitForDeployment();

  const address = await synthid.getAddress();
  console.log("✅ SynthID deployed to:", address);
  console.log("   Mint fee:", ethers.formatEther(await synthid.mintFee()), "BNB");
  console.log("   Owner:", await synthid.owner());

  // Wait for block confirmations before verifying
  console.log("\n⏳ Waiting for 5 block confirmations...");
  const deployTx = synthid.deploymentTransaction();
  if (deployTx) {
    await deployTx.wait(5);
  }

  // Verify on BscScan
  console.log("\n📋 Verifying on BscScan...");
  try {
    await run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("✅ Verified on BscScan!");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Already Verified")) {
      console.log("✅ Already verified on BscScan");
    } else {
      console.error("❌ Verification failed:", msg);
    }
  }

  console.log("\n🎉 Done! Update SYNTHID_ADDRESS in src/lib/synthid.ts with:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
