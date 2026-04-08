/**
 * One-shot X Layer deployment for OKX Build X Hackathon.
 *
 * Deploys in order:
 *   1. SynthLaunchCustody  (signer=deployer, operator=deployer, fee=2000bps)
 *   2. SynthID             (no args)
 *   3. NFAv2               (treasury=deployer)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-xlayer.ts --network xlayer
 *
 * Result is written to deployments/xlayer.json so other scripts / README
 * generators can pick up the addresses.
 */
import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function verify(address: string, args: unknown[], label: string) {
  console.log(`\n📋 Verifying ${label} on OKLink...`);
  try {
    await run("verify:verify", { address, constructorArguments: args });
    console.log(`✅ ${label} verified`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Already Verified") || msg.includes("already verified")) {
      console.log(`✅ ${label} already verified`);
    } else {
      console.warn(`⚠️  ${label} verification failed: ${msg}`);
    }
  }
}

async function main() {
  if (network.name !== "xlayer") {
    throw new Error(`Expected --network xlayer, got ${network.name}`);
  }

  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("🚀 X Layer deployment");
  console.log("   Deployer:", deployer.address);
  console.log("   Balance :", ethers.formatEther(bal), "OKB\n");

  if (bal < ethers.parseEther("0.05")) {
    throw new Error("Insufficient OKB balance (< 0.05). Fund deployer first.");
  }

  const signer = process.env.SIGNER_ADDRESS || deployer.address;
  const operator = process.env.OPERATOR_ADDRESS || deployer.address;
  const platformFeeRate = process.env.PLATFORM_FEE_RATE || "2000"; // 20%
  const treasury = process.env.NFA_TREASURY || deployer.address;

  console.log("Params:");
  console.log("  signer          :", signer);
  console.log("  operator        :", operator);
  console.log("  platformFeeRate :", platformFeeRate);
  console.log("  nfaTreasury     :", treasury);
  console.log("");

  // 1. Custody
  console.log("1/3 Deploying SynthLaunchCustody...");
  const Custody = await ethers.getContractFactory("SynthLaunchCustody");
  const custody = await Custody.deploy(signer, operator, platformFeeRate);
  await custody.waitForDeployment();
  const custodyAddr = await custody.getAddress();
  console.log("    ✅", custodyAddr);

  // 2. SynthID
  console.log("\n2/3 Deploying SynthID...");
  const SynthID = await ethers.getContractFactory("SynthID");
  const synthid = await SynthID.deploy();
  await synthid.waitForDeployment();
  const synthidAddr = await synthid.getAddress();
  console.log("    ✅", synthidAddr);

  // 3. NFAv2
  console.log("\n3/3 Deploying NFAv2...");
  const NFAv2 = await ethers.getContractFactory("NFAv2");
  const nfa = await NFAv2.deploy(treasury);
  await nfa.waitForDeployment();
  const nfaAddr = await nfa.getAddress();
  console.log("    ✅", nfaAddr);

  // Save result before verification so addresses are persisted even if verify fails
  const out = {
    network: "xlayer",
    chainId: 196,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SynthLaunchCustody: {
        address: custodyAddr,
        constructorArgs: [signer, operator, platformFeeRate],
      },
      SynthID: {
        address: synthidAddr,
        constructorArgs: [],
      },
      NFAv2: {
        address: nfaAddr,
        constructorArgs: [treasury],
      },
    },
  };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "xlayer.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n💾 Wrote ${outPath}`);

  // Wait a few blocks for verification
  console.log("\n⏳ Waiting for confirmations before verify...");
  await custody.deploymentTransaction()?.wait(3);
  await synthid.deploymentTransaction()?.wait(3);
  await nfa.deploymentTransaction()?.wait(3);

  await verify(custodyAddr, [signer, operator, platformFeeRate], "SynthLaunchCustody");
  await verify(synthidAddr, [], "SynthID");
  await verify(nfaAddr, [treasury], "NFAv2");

  console.log("\n🎉 Done. Summary:");
  console.log("   SynthLaunchCustody:", custodyAddr);
  console.log("   SynthID           :", synthidAddr);
  console.log("   NFAv2             :", nfaAddr);
  console.log("\nNext:");
  console.log("  - update src/lib/contracts.ts chain 196 custodyAddress");
  console.log("  - update src/lib/synthid.ts X Layer address");
  console.log("  - update src/lib/nfa.ts X Layer address");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
