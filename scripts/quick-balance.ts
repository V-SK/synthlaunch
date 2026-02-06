const hre = require("hardhat");
async function main() {
  const { ethers } = hre;
  const balance = await ethers.provider.getBalance("0x3Fa33A0fb85f11A901e3616E10876d10018f43B7");
  console.log(ethers.formatEther(balance), "BNB");
}
main().catch(console.error);
