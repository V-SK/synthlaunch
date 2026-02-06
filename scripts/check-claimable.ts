const hre = require("hardhat");

const CUSTODY_ADDRESS = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";
const V_WALLET = "0x5c9E31B8E3fDc7356D7398165457423854C72C8e".toLowerCase();
const DEPLOYER = "0x8028227C43947F41bB431571002D512815D77C4F".toLowerCase();

async function main() {
  const { ethers } = hre;

  const custody = await ethers.getContractAt(
    [
      "function tokenFees(address) view returns (uint256)",
      "function tokenClaimed(address) view returns (uint256)",
      "function tokenAgent(address) view returns (string)",
      "function agentWallet(string) view returns (address)",
      "function platformFeeRate() view returns (uint256)",
      "function platformFeeBalance() view returns (uint256)",
      "function totalRecorded() view returns (uint256)",
    ],
    CUSTODY_ADDRESS
  );

  const platformFeeRate = await custody.platformFeeRate();
  const balance = await ethers.provider.getBalance(CUSTODY_ADDRESS);
  console.log("Contract BNB balance:", ethers.formatEther(balance), "BNB");
  console.log("Platform fee rate:", Number(platformFeeRate) / 100, "%\n");

  // Fetch token list from leaderboard API
  const response = await fetch("https://synthlaunch.fun/api/leaderboard");
  const data = await response.json();

  console.log("=== Tokens with fees ===\n");
  let totalClaimableOurs = 0n;
  let totalClaimableOthers = 0n;

  for (const entry of data.entries) {
    const addr = entry.tokenAddress;
    try {
      const fees = await custody.tokenFees(addr);
      const claimed = await custody.tokenClaimed(addr);
      const agentName = await custody.tokenAgent(addr);
      let wallet = "0x0000000000000000000000000000000000000000";
      if (agentName) {
        try { wallet = await custody.agentWallet(agentName); } catch {}
      }

      if (fees > 0n) {
        const agentShare = fees * (10000n - platformFeeRate) / 10000n;
        const claimable = agentShare - claimed;
        const isOurs = wallet.toLowerCase() === V_WALLET || wallet.toLowerCase() === DEPLOYER;

        console.log(`${entry.tokenSymbol} | agent: ${agentName}`);
        console.log(`  Fees: ${ethers.formatEther(fees)} BNB | Claimable: ${ethers.formatEther(claimable)} BNB | Wallet: ${wallet.slice(0,10)}... ${isOurs ? "✅ OURS" : ""}`);

        if (claimable > 0n) {
          if (isOurs) totalClaimableOurs += claimable;
          else totalClaimableOthers += claimable;
        }
      }
    } catch (e) {}
  }

  console.log("\n========================================");
  console.log("Our claimable:", ethers.formatEther(totalClaimableOurs), "BNB");
  console.log("Others claimable:", ethers.formatEther(totalClaimableOthers), "BNB");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
