const hre = require("hardhat");
const CUSTODY = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";
const RECIPIENT = "0x5c9E31B8E3fDc7356D7398165457423854C72C8e";

async function main() {
  const { ethers } = hre;
  const custody = await ethers.getContractAt(
    [
      "function platformFeeBalance() view returns (uint256)",
      "function withdrawPlatformFee(address to) external",
      "function tokenFees(address) view returns (uint256)",
      "function tokenClaimed(address) view returns (uint256)",
      "function tokenAgent(address) view returns (string)",
      "function claimable(address) view returns (uint256)",
    ],
    CUSTODY
  );

  // 1. Withdraw platform fee
  const fee = await custody.platformFeeBalance();
  console.log("Withdrawing platform fee:", ethers.formatEther(fee), "BNB");
  const tx = await custody.withdrawPlatformFee(RECIPIENT);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✅ Done\n");

  // 2. Check all tokens with remaining claimable
  const response = await fetch("https://synthlaunch.fun/api/leaderboard");
  const data = await response.json();
  
  console.log("=== 用户待 claim 明细 ===\n");
  for (const entry of data.entries) {
    try {
      const canClaim = await custody.claimable(entry.tokenAddress);
      if (canClaim > 0n) {
        const agent = await custody.tokenAgent(entry.tokenAddress);
        console.log(`${entry.tokenSymbol} | agent: ${agent} | 待claim: ${ethers.formatEther(canClaim)} BNB`);
      }
    } catch {}
  }
}
main().catch(console.error);
