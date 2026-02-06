const hre = require("hardhat");
async function main() {
  const { ethers } = hre;
  const custody = await ethers.getContractAt(
    [
      "function totalRecorded() view returns (uint256)",
      "function platformFeeBalance() view returns (uint256)",
    ],
    "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7"
  );
  const balance = await ethers.provider.getBalance("0x3Fa33A0fb85f11A901e3616E10876d10018f43B7");
  const totalRecorded = await custody.totalRecorded();
  const platformFee = await custody.platformFeeBalance();
  console.log("合约余额:", ethers.formatEther(balance), "BNB");
  console.log("总记录税收:", ethers.formatEther(totalRecorded), "BNB");
  console.log("待提平台费:", ethers.formatEther(platformFee), "BNB");
}
main().catch(console.error);
