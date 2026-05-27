import { ethers, network } from "hardhat";

function envAddress(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`Missing or invalid ${name}`);
  }
  return value;
}

function envUint(name: string, fallback?: string): bigint {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return BigInt(value);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log("Network:", network.name);
  console.log("Deploying with account:", deployerAddress);
  console.log("Account balance:", ethers.formatEther(balance), "native");

  const treasuryVault = envAddress("RISE_TREASURY_VAULT", deployerAddress);
  const timelock = envAddress("RISE_TIMELOCK", deployerAddress);
  const pauseGuardian = envAddress("RISE_PAUSE_GUARDIAN", deployerAddress);
  const creationFee = envUint("RISE_CREATION_FEE_WEI", ethers.parseEther("0.01").toString());
  const allowlist = (process.env.RISE_BACKING_ASSETS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  console.log("Treasury vault:", treasuryVault);
  console.log("Timelock:", timelock);
  console.log("Pause guardian:", pauseGuardian);
  console.log("Creation fee (wei):", creationFee.toString());
  console.log("Backing asset allowlist:", allowlist.length ? allowlist.join(", ") : "(none)");

  console.log("\n1. Deploying RiseProtocolConfig...");
  const ProtocolConfig = await ethers.getContractFactory("RiseProtocolConfig");
  const protocolConfig = await ProtocolConfig.deploy(
    deployerAddress,
    treasuryVault,
    timelock,
    pauseGuardian,
    creationFee
  );
  await protocolConfig.waitForDeployment();
  const protocolConfigAddress = await protocolConfig.getAddress();
  console.log("   RiseProtocolConfig:", protocolConfigAddress);

  console.log("\n2. Deploying RiseMarketCore...");
  const MarketCore = await ethers.getContractFactory("RiseMarketCore");
  const marketCore = await MarketCore.deploy(deployerAddress);
  await marketCore.waitForDeployment();
  const marketCoreAddress = await marketCore.getAddress();
  console.log("   RiseMarketCore:", marketCoreAddress);

  console.log("\n3. Deploying RiseFeeRouter...");
  const FeeRouter = await ethers.getContractFactory("RiseFeeRouter");
  const feeRouter = await FeeRouter.deploy(deployerAddress);
  await feeRouter.waitForDeployment();
  const feeRouterAddress = await feeRouter.getAddress();
  console.log("   RiseFeeRouter:", feeRouterAddress);

  console.log("\n4. Deploying RisePositionManager...");
  const PositionManager = await ethers.getContractFactory("RisePositionManager");
  const positionManager = await PositionManager.deploy(deployerAddress, marketCoreAddress);
  await positionManager.waitForDeployment();
  const positionManagerAddress = await positionManager.getAddress();
  console.log("   RisePositionManager:", positionManagerAddress);

  console.log("\n5. Deploying RiseMarketFactory...");
  const MarketFactory = await ethers.getContractFactory("RiseMarketFactory");
  const marketFactory = await MarketFactory.deploy(
    deployerAddress,
    protocolConfigAddress,
    marketCoreAddress
  );
  await marketFactory.waitForDeployment();
  const marketFactoryAddress = await marketFactory.getAddress();
  console.log("   RiseMarketFactory:", marketFactoryAddress);

  console.log("\n6. Wiring contracts...");
  await (await feeRouter.setCore(marketCoreAddress)).wait();
  await (await marketCore.setFeeRouter(feeRouterAddress)).wait();
  await (await marketCore.setPositionManager(positionManagerAddress)).wait();
  await (await marketCore.setMarketFactory(marketFactoryAddress)).wait();
  await (await marketCore.setTreasuryVault(treasuryVault)).wait();

  for (const asset of allowlist) {
    if (!ethers.isAddress(asset)) {
      throw new Error(`Invalid address in RISE_BACKING_ASSETS: ${asset}`);
    }
    console.log(`   Allowlisting backing asset: ${asset}`);
    await (await protocolConfig.setBackingAssetAllowed(asset, true)).wait();
  }

  console.log("\n========================================");
  console.log("RISE BSC PROTOTYPE DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("RiseProtocolConfig:  ", protocolConfigAddress);
  console.log("RiseMarketCore:      ", marketCoreAddress);
  console.log("RiseFeeRouter:       ", feeRouterAddress);
  console.log("RisePositionManager: ", positionManagerAddress);
  console.log("RiseMarketFactory:   ", marketFactoryAddress);
  console.log("TreasuryVault:       ", treasuryVault);
  console.log("Timelock:            ", timelock);
  console.log("PauseGuardian:       ", pauseGuardian);
  console.log("CreationFee:         ", creationFee.toString());
  console.log("========================================");

  console.log("\nSuggested verify commands:");
  console.log(`npx hardhat verify --network ${network.name} ${protocolConfigAddress} "${deployerAddress}" "${treasuryVault}" "${timelock}" "${pauseGuardian}" "${creationFee}"`);
  console.log(`npx hardhat verify --network ${network.name} ${marketCoreAddress} "${deployerAddress}"`);
  console.log(`npx hardhat verify --network ${network.name} ${feeRouterAddress} "${deployerAddress}"`);
  console.log(`npx hardhat verify --network ${network.name} ${positionManagerAddress} "${deployerAddress}" "${marketCoreAddress}"`);
  console.log(`npx hardhat verify --network ${network.name} ${marketFactoryAddress} "${deployerAddress}" "${protocolConfigAddress}" "${marketCoreAddress}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
