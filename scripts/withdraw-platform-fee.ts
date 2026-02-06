const hre = require("hardhat");

const CUSTODY_ADDRESS = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";
const RECIPIENT = "0x5c9E31B8E3fDc7356D7398165457423854C72C8e"; // V's receiving wallet

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Caller:", deployer.address);

  const custody = await ethers.getContractAt(
    [
      "function platformFeeBalance() view returns (uint256)",
      "function withdrawPlatformFee(address to) external",
      "function owner() view returns (address)",
    ],
    CUSTODY_ADDRESS
  );

  const owner = await custody.owner();
  console.log("Contract owner:", owner);

  const feeBalance = await custody.platformFeeBalance();
  console.log("Platform fee balance:", ethers.formatEther(feeBalance), "BNB");

  if (feeBalance === 0n) {
    console.log("No fees to withdraw.");
    return;
  }

  console.log(`\nWithdrawing to ${RECIPIENT}...`);
  const tx = await custody.withdrawPlatformFee(RECIPIENT);
  console.log("TX hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt?.blockNumber);
  console.log("Gas used:", receipt?.gasUsed.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
