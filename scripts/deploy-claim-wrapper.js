const hre = require("hardhat");

async function main() {
  // Contract addresses on BSC mainnet
  const SYNTH_TOKEN = "0x83c8c815bbf6a239816aa0b14ba9d9222b817777";
  const FLAP_PORTAL = "0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0";
  const BNB_PRICE_FEED = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE"; // Chainlink BNB/USD
  const CUSTODY = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7"; // Custody v11
  const TREASURY = "0x8028227C43947F41bB431571002D512815D77C4F";

  console.log("Deploying ClaimWrapper v2 (with Chainlink)...");
  console.log("  SYNTH Token:", SYNTH_TOKEN);
  console.log("  Flap Portal:", FLAP_PORTAL);
  console.log("  BNB Price Feed:", BNB_PRICE_FEED);
  console.log("  Custody:", CUSTODY);
  console.log("  Treasury:", TREASURY);

  const ClaimWrapper = await hre.ethers.getContractFactory("ClaimWrapper");
  const wrapper = await ClaimWrapper.deploy(SYNTH_TOKEN, FLAP_PORTAL, BNB_PRICE_FEED, CUSTODY, TREASURY);

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
