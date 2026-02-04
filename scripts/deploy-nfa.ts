const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Deploying NFA with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // Treasury address (SynthLaunch platform wallet)
  const TREASURY = "0x8028227C43947F41bB431571002D512815D77C4F";

  // Deploy NFA
  const NFA = await ethers.getContractFactory("NFA");
  const nfa = await NFA.deploy(TREASURY);
  await nfa.waitForDeployment();

  const address = await nfa.getAddress();
  console.log("\n✅ NFA deployed to:", address);
  console.log("Treasury:", TREASURY);
  console.log("Mint price:", ethers.formatEther(await nfa.mintPrice()), "BNB");
  console.log("Max supply:", (await nfa.maxSupply()).toString());
  console.log("Platform fee:", (await nfa.platformFeeBps()).toString(), "bps (2.5%)");

  console.log("\n📋 Verification command:");
  console.log(`npx hardhat verify --network bscMainnet ${address} "${TREASURY}"`);

  console.log("\n📝 Update src/lib/nfa.ts with:");
  console.log(`export const NFA_ADDRESS = "${address}" as const;`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
