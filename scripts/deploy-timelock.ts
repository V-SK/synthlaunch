const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SynthTimelock with admin:", deployer.address);

  const Timelock = await ethers.getContractFactory("SynthTimelock");
  const timelock = await Timelock.deploy(deployer.address);
  await timelock.waitForDeployment();

  const timelockAddress = await timelock.getAddress();
  console.log("✅ SynthTimelock deployed to:", timelockAddress);

  console.log("\n--- Next Steps ---");
  console.log("1. Verify on BscScan:");
  console.log(`   npx hardhat verify --network bscMainnet ${timelockAddress} ${deployer.address}`);
  console.log("\n2. Transfer Custody ownership to Timelock:");
  console.log(`   custody.transferOwnership("${timelockAddress}")`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
