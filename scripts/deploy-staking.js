const hre = require("hardhat");

async function main() {
  const SYNTH_TOKEN = "0x83c8c815bbf6a239816aa0b14ba9d9222b817777";
  const REWARD_TOKEN = hre.ethers.ZeroAddress;

  const signers = await hre.ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No deployer signer available. Set DEPLOYER_PRIVATE_KEY in .env.local before deploying.");
  }

  const [deployer] = signers;

  console.log("Deploying SynthStaking to", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("SYNTH Token:", SYNTH_TOKEN);
  console.log("Reward Token:", REWARD_TOKEN);

  const SynthStaking = await hre.ethers.getContractFactory("SynthStaking");
  const staking = await SynthStaking.deploy(SYNTH_TOKEN, REWARD_TOKEN);
  await staking.waitForDeployment();

  const address = await staking.getAddress();
  const deploymentTx = staking.deploymentTransaction();

  console.log("\nSynthStaking deployed to:", address);
  console.log("Deployment tx hash:", deploymentTx ? deploymentTx.hash : "unknown");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
