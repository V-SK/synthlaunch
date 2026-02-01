const hre = require("hardhat");

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  const signerAddress = process.env.SIGNER_ADDRESS || deployer.address;
  const platformFeeRate = parseInt(process.env.PLATFORM_FEE_RATE || "2000"); // 20% default
  console.log("Signer address:", signerAddress);
  console.log("Platform fee rate:", platformFeeRate, `(${platformFeeRate / 100}%)`);

  const SynthLaunchCustody = await ethers.getContractFactory("SynthLaunchCustody");
  const custody = await SynthLaunchCustody.deploy(signerAddress, platformFeeRate);
  await custody.waitForDeployment();

  const contractAddress = await custody.getAddress();
  console.log("\n✅ SynthLaunchCustody deployed to:", contractAddress);
  console.log("\nTo verify on BscScan:");
  console.log(`BSC_SCAN_API_KEY=TJIFZ5BY3I67TQ4VW7FQ5R92RTGPYVZ1A3 npx hardhat verify --network bscMainnet --constructor-args constructorArgs.js ${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
