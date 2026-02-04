const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  const network = await ethers.provider.getNetwork();
  const isTestnet = network.chainId === 97n;
  console.log("Network:", isTestnet ? "BSC Testnet" : "BSC Mainnet", `(chainId: ${network.chainId})`);

  // PancakeSwap V2 Router addresses
  const ROUTER = isTestnet
    ? "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"  // BSC Testnet
    : "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // BSC Mainnet

  // Platform fee wallet
  const PLATFORM = "0x8028227C43947F41bB431571002D512815D77C4F";

  // SynthID contract
  const SYNTH_ID = isTestnet
    ? ethers.ZeroAddress  // no SynthID on testnet
    : "0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb";

  // Creation fee
  const CREATION_FEE = isTestnet
    ? ethers.parseEther("0.01")
    : ethers.parseEther("0.02");

  // Raise limits
  const MIN_RAISE = ethers.parseEther("20");
  const MAX_RAISE = ethers.parseEther("85");

  // Mint fee rate: 2.5% = 250 bps
  const MINT_FEE_RATE = 250;

  console.log("\nDeploying FairMintFactory...");
  console.log("  Router:", ROUTER);
  console.log("  Platform:", PLATFORM);
  console.log("  SynthID:", SYNTH_ID);
  console.log("  Creation Fee:", ethers.formatEther(CREATION_FEE), "BNB");
  console.log("  Min Raise:", ethers.formatEther(MIN_RAISE), "BNB");
  console.log("  Max Raise:", ethers.formatEther(MAX_RAISE), "BNB");
  console.log("  Mint Fee Rate:", MINT_FEE_RATE / 100, "%");

  const Factory = await ethers.getContractFactory("FairMintFactory");
  const factory = await Factory.deploy(
    PLATFORM,
    ROUTER,
    SYNTH_ID,
    CREATION_FEE,
    MIN_RAISE,
    MAX_RAISE,
    MINT_FEE_RATE
  );

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("\n✅ FairMintFactory deployed:", factoryAddress);

  console.log("\nTo verify on BscScan:");
  console.log(`npx hardhat verify --network ${isTestnet ? "bscTestnet" : "bscMainnet"} ${factoryAddress} ${PLATFORM} ${ROUTER} ${SYNTH_ID} ${CREATION_FEE} ${MIN_RAISE} ${MAX_RAISE} ${MINT_FEE_RATE}`);

  // Test on testnet
  if (isTestnet) {
    console.log("\n--- Creating test token ---");

    // Lower raise limits for testnet testing
    console.log("Setting testnet raise limits (0.001 - 1 BNB)...");
    await (await factory.setRaiseLimits(
      ethers.parseEther("0.001"),
      ethers.parseEther("1")
    )).wait();

    const tx = await factory.createToken({
      name: "TestFairMint",
      symbol: "TFM",
      totalSupply: 1_000_000,
      mintPrice: ethers.parseEther("0.0000001"), // tiny price for testnet
      perWalletLimit: 10_000,
      lpRatioBps: 2000,
      duration: 3600,
      beneficiary: deployer.address,
      agentOnly: false,
    }, { value: ethers.parseEther("0.01") });

    const receipt = await tx.wait();
    const totalTokens = await factory.totalTokens();
    const tokenAddress = await factory.allTokens(totalTokens - 1n);
    console.log("✅ Test token deployed:", tokenAddress);

    // Mint
    console.log("\n--- Minting 100 tokens ---");
    const token = await ethers.getContractAt("FairMintToken", tokenAddress);
    const mintAmount = ethers.parseEther("100");
    const mintCost = await token.mintCost(mintAmount);
    console.log("   Cost:", ethers.formatEther(mintCost), "BNB");

    const mintTx = await token.mint(mintAmount, { value: mintCost });
    await mintTx.wait();
    console.log("✅ Minted 100 tokens!");

    const progress = await token.mintProgress();
    console.log("   Minted:", ethers.formatEther(progress[0]), "/", ethers.formatEther(progress[1]));
    console.log("   Balance:", ethers.formatEther(await token.balanceOf(deployer.address)));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
