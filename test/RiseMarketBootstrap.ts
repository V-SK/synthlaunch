import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Rise market bootstrap", function () {
  async function deployFixture() {
    const [owner, creator, treasuryVault, pauseGuardian, timelock] =
      await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const backingAsset = await MockERC20.deploy("Mock USDT", "mUSDT");
    await backingAsset.waitForDeployment();

    const creationFee = ethers.parseEther("0.1");

    const RiseProtocolConfig = await ethers.getContractFactory("RiseProtocolConfig");
    const config = await RiseProtocolConfig.deploy(
      owner.address,
      treasuryVault.address,
      timelock.address,
      pauseGuardian.address,
      creationFee
    );
    await config.waitForDeployment();

    await config.setBackingAssetAllowed(await backingAsset.getAddress(), true);

    const RiseMarketCore = await ethers.getContractFactory("RiseMarketCore");
    const core = await RiseMarketCore.deploy(owner.address);
    await core.waitForDeployment();

    const RiseMarketFactory = await ethers.getContractFactory("RiseMarketFactory");
    const factory = await RiseMarketFactory.deploy(
      owner.address,
      await config.getAddress(),
      await core.getAddress()
    );
    await factory.waitForDeployment();
    await core.setMarketFactory(await factory.getAddress());

    return {
      owner,
      creator,
      treasuryVault,
      pauseGuardian,
      timelock,
      backingAsset,
      creationFee,
      config,
      core,
      factory,
    };
  }

  it("creates a market, deploys a token, and registers it in core", async function () {
    const { creator, backingAsset, creationFee, factory, core, treasuryVault } =
      await loadFixture(deployFixture);

    const startTime = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

    const params = {
      name: "Rise BSC Clone",
      symbol: "RBC",
      description: "clone market",
      metadataURI: "ipfs://metadata",
      logoURI: "ipfs://logo",
      socialLinks: ["x", "tg", "site", "docs"],
      backingAsset: await backingAsset.getAddress(),
      creator: creator.address,
      curve: {
        x2: 1000n,
        m1: 2n,
        m2: 1n,
        b2: 1000n,
      },
      fees: {
        tradingFeeBps: 125,
        borrowOriginationFeeBps: 300,
        creatorShareBps: 1000,
        treasuryShareBps: 2000,
        floorShareBps: 7000,
      },
      floorConfig: {
        initialFloorPrice: ethers.parseEther("0.01"),
        threshold1: 100_000n,
        threshold2: 200_000n,
        threshold3: 300_000n,
        threshold4: 400_000n,
        cooldown0: 0,
        cooldown1: 30,
        cooldown2: 60,
        cooldown3: 90,
        cooldown4: 120,
      },
      initialFloorPrice: ethers.parseEther("0.01"),
      startTime,
      disableSellAtLaunch: true,
      disableSellUntil: startTime + 1800n,
    };

    const treasuryBalanceBefore = await ethers.provider.getBalance(treasuryVault.address);

    await expect(factory.connect(creator).createMarket(params, { value: creationFee })).to.emit(
      factory,
      "MarketCreated"
    );

    const tokenAddress = await factory.marketToken(1n);
    expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

    const market = await core.getMarket(1n);
    expect(market.marketId).to.equal(1n);
    expect(market.token).to.equal(tokenAddress);
    expect(market.backingAsset).to.equal(await backingAsset.getAddress());
    expect(market.creator).to.equal(creator.address);
    expect(market.currentFloorPrice).to.equal(params.initialFloorPrice);
    expect(market.currentPrice).to.equal(params.initialFloorPrice);
    expect(market.status).to.equal(0n);

    const treasuryBalanceAfter = await ethers.provider.getBalance(treasuryVault.address);
    expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(creationFee);
  });

  it("rejects createMarket for non-whitelisted backing assets", async function () {
    const { creator, factory, creationFee } = await loadFixture(deployFixture);
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const unknownAsset = await MockERC20.deploy("Unknown", "UNKWN");
    await unknownAsset.waitForDeployment();
    const startTime = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 10n;

    const params = {
      name: "Bad Asset",
      symbol: "BAD",
      description: "bad asset market",
      metadataURI: "ipfs://metadata",
      logoURI: "ipfs://logo",
      socialLinks: ["x", "tg", "site", "docs"],
      backingAsset: await unknownAsset.getAddress(),
      creator: creator.address,
      curve: {
        x2: 1000n,
        m1: 2n,
        m2: 1n,
        b2: 1000n,
      },
      fees: {
        tradingFeeBps: 125,
        borrowOriginationFeeBps: 300,
        creatorShareBps: 1000,
        treasuryShareBps: 2000,
        floorShareBps: 7000,
      },
      floorConfig: {
        initialFloorPrice: ethers.parseEther("0.01"),
        threshold1: 100_000n,
        threshold2: 200_000n,
        threshold3: 300_000n,
        threshold4: 400_000n,
        cooldown0: 0,
        cooldown1: 30,
        cooldown2: 60,
        cooldown3: 90,
        cooldown4: 120,
      },
      initialFloorPrice: ethers.parseEther("0.01"),
      startTime,
      disableSellAtLaunch: false,
      disableSellUntil: 0n,
    };

    await expect(factory.connect(creator).createMarket(params, { value: creationFee })).to.be.revertedWithCustomError(
      factory,
      "BackingAssetNotAllowed"
    );
  });
});
