const hre = require("hardhat");

const CUSTODY = "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7";
const SYNTH_TOKEN = "0x83c8c815bbf6a239816aa0b14ba9d9222b817777";
const NFA_TOKEN = "0xed50388a82582cb58e6b00cb93e29f0e69b27777";

async function main() {
  const { ethers } = hre;
  const custody = await ethers.getContractAt(
    [
      "function tokenFees(address) view returns (uint256)",
      "function tokenClaimed(address) view returns (uint256)",
      "function tokenAgent(address) view returns (string)",
      "function agentWallet(string) view returns (address)",
      "function platformFeeRate() view returns (uint256)",
      "function claimable(address) view returns (uint256)",
    ],
    CUSTODY
  );

  for (const [name, addr] of [["SYNTH", SYNTH_TOKEN], ["NFA", NFA_TOKEN]]) {
    console.log(`\n=== ${name} ===`);
    const fees = await custody.tokenFees(addr);
    const claimed = await custody.tokenClaimed(addr);
    const agent = await custody.tokenAgent(addr);
    const wallet = await custody.agentWallet(agent);
    console.log(`Agent: ${agent}`);
    console.log(`Bound wallet: ${wallet}`);
    console.log(`Total fees: ${ethers.formatEther(fees)} BNB`);
    console.log(`Already claimed: ${ethers.formatEther(claimed)} BNB`);
    
    try {
      const canClaim = await custody.claimable(addr);
      console.log(`Claimable (contract): ${ethers.formatEther(canClaim)} BNB`);
    } catch (e) {
      // Calculate manually
      const rate = await custody.platformFeeRate();
      const agentShare = fees * (10000n - rate) / 10000n;
      const remaining = agentShare > claimed ? agentShare - claimed : 0n;
      console.log(`Claimable (calc): ${ethers.formatEther(remaining)} BNB`);
      if (agentShare <= claimed) {
        console.log(`⚠️ Over-claimed by ${ethers.formatEther(claimed - agentShare)} BNB`);
      }
    }
  }
}

main().catch(console.error);
