const hre = require("hardhat");
async function main() {
  const { ethers } = hre;
  const custody = await ethers.getContractAt(
    ["function owner() view returns (address)", "function pendingOwner() view returns (address)"],
    "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7"
  );
  console.log("Owner:", await custody.owner());
  try { console.log("Pending owner:", await custody.pendingOwner()); } catch { console.log("No pendingOwner function"); }
}
main().catch(console.error);
