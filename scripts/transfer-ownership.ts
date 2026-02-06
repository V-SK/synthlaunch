const hre = require("hardhat");

const CUSTODY = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";
const TIMELOCK = "0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D";

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();

  const custody = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function transferOwnership(address newOwner) external",
    ],
    CUSTODY
  );

  const currentOwner = await custody.owner();
  console.log("Current owner:", currentOwner);
  console.log("Caller:", deployer.address);
  console.log("New owner (Timelock):", TIMELOCK);

  console.log("\nTransferring ownership...");
  const tx = await custody.transferOwnership(TIMELOCK);
  console.log("TX:", tx.hash);
  await tx.wait();

  const newOwner = await custody.owner();
  console.log("\n✅ Ownership transferred!");
  console.log("New owner:", newOwner);
  console.log("Match Timelock:", newOwner.toLowerCase() === TIMELOCK.toLowerCase() ? "✅ YES" : "❌ NO");
}

main().catch(console.error);
