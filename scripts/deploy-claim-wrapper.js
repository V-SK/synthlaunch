const hre = require("hardhat");

async function main() {
  // Contract addresses on BSC mainnet
  const SYNTH_TOKEN = "0x83c8c815bbf6a239816aa0b14ba9d9222b817777";
  const CUSTODY = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7"; // Custody v11
  const TREASURY = "0x8028227C43947F41bB431571002D512815D77C4F";

  console.log("Deploying ClaimWrapper...");
  console.log("  SYNTH Token:", SYNTH_TOKEN);
  console.log("  Custody:", CUSTODY);
  console.log("  Treasury:", TREASURY);

  const ClaimWrapper = await hre.ethers.getContractFactory("ClaimWrapper");
  const wrapper = await ClaimWrapper.deploy(SYNTH_TOKEN, CUSTODY, TREASURY);

  await wrapper.waitForDeployment();
  const address = await wrapper.getAddress();

  console.log("\n✅ ClaimWrapper deployed to:", address);
  console.log("\nDefault settings:");
  console.log("  Required SYNTH: 50,000 SYNTH (~$10-15)");
  console.log("  Min fee threshold: 0.01 BNB");

  console.log("\n📝 Next steps:");
  console.log("1. Verify on BscScan:");
  console.log(`   npx hardhat verify --network bscMainnet ${address} ${SYNTH_TOKEN} ${CUSTODY} ${TREASURY}`);
  console.log("\n2. Update frontend to use ClaimWrapper instead of direct Custody.claim()");
  console.log("\n3. Users need to approve SYNTH before claiming:");
  console.log(`   SYNTH.approve(${address}, amount)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
