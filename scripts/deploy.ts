const hre = require("hardhat");

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // Use SIGNER_ADDRESS env var, or default to deployer address
  const signerAddress = process.env.SIGNER_ADDRESS || deployer.address;
  console.log("Signer address:", signerAddress);

  const operatorAddress = process.env.OPERATOR_ADDRESS || deployer.address;
  const platformFeeRate = process.env.PLATFORM_FEE_RATE || "2000"; // 20% default
  console.log("Operator address:", operatorAddress);
  console.log("Platform fee rate:", platformFeeRate, "basis points");

  const SynthLaunchCustody = await ethers.getContractFactory("SynthLaunchCustody");
  const custody = await SynthLaunchCustody.deploy(signerAddress, operatorAddress, platformFeeRate);
  await custody.waitForDeployment();

  const contractAddress = await custody.getAddress();
  console.log("SynthLaunchCustody deployed to:", contractAddress);
  console.log("");
  console.log("To verify on BscScan:");
  console.log(`npx hardhat verify --network bscMainnet ${contractAddress} "${signerAddress}" "${operatorAddress}" "${platformFeeRate}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
