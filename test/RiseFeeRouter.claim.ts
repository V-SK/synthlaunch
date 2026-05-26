import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Rise fee routing and creator claim", function () {
  async function deployFixture() {
    const [owner, creator, user, treasuryVault, pauseGuardian, timelock, receiver] =
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

    const RiseFeeRouter = await ethers.getContractFactory("RiseFeeRouter");
    const feeRouter = await RiseFeeRouter.deploy(owner.address);
    await feeRouter.waitForDeployment();
    await feeRouter.setCore(await core.getAddress());
    await core.setFeeRouter(await feeRouter.getAddress());

    const RiseMarketFactory = await ethers.getContractFactory("RiseMarketFactory");
    const factory = await RiseMarketFactory.deploy(
      owner.address,
      await config.getAddress(),
      await core.getAddress()
    );
    await factory.waitForDeployment();
    await core.setMarketFactory(await factory.getAddress());

    const RisePositionManager = await ethers.getContractFactory("RisePositionManager");
    const positionManager = await RisePositionManager.deploy(owner.address, await core.getAddress());
    await positionManager.waitForDeployment();
    await core.setPositionManager(await positionManager.getAddress());

    const startTime = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 5n;
    const params = {
      name: "Fee Market",
      symbol: "FEE",
      description: "fee market",
      metadataURI: "ipfs://metadata",
      logoURI: "ipfs://logo",
      socialLinks: ["x", "tg", "site", "docs"],
      backingAsset: await backingAsset.getAddress(),
      creator: creator.address,
      curve: {
        x2: ethers.parseEther("1000"),
        m1: 0n,
        m2: 0n,
        b2: 0n,
      },
      fees: {
        tradingFeeBps: 125,
        borrowOriginationFeeBps: 300,
        creatorShareBps: 1000,
        treasuryShareBps: 2000,
        floorShareBps: 7000,
      },
      floorConfig: {
        initialFloorPrice: ethers.parseEther("1"),
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
      initialFloorPrice: ethers.parseEther("1"),
      startTime,
      disableSellAtLaunch: false,
      disableSellUntil: 0n,
    };

    await factory.connect(creator).createMarket(params, { value: creationFee });
    await time.increaseTo(startTime);

    const tokenAddress = await factory.marketToken(1n);
    const marketToken = await ethers.getContractAt("RiseMarketToken", tokenAddress);

    await backingAsset.mint(user.address, ethers.parseEther("1000"));
    await backingAsset.connect(user).approve(await core.getAddress(), ethers.MaxUint256);
    await backingAsset.connect(user).approve(await positionManager.getAddress(), ethers.MaxUint256);

    return { creator, user, receiver, backingAsset, core, feeRouter, positionManager, marketToken };
  }

  it("routes trading and borrow fees and lets creator claim", async function () {
    const { creator, user, receiver, backingAsset, core, feeRouter, positionManager, marketToken } =
      await loadFixture(deployFixture);

    const buyBackingIn = ethers.parseEther("10");
    const tradeFee = (buyBackingIn * 125n) / 10_000n;
    const expectedCreatorTradeShare = (tradeFee * 1000n) / 10_000n;

    const buyQuote = await core.quoteBuy(1n, buyBackingIn);
    await core.connect(user).buy(1n, buyBackingIn, buyQuote.tokenInOrOut, user.address);

    expect(await feeRouter.creatorClaimable(1n)).to.equal(expectedCreatorTradeShare);

    const depositAmount = ethers.parseEther("5");
    await marketToken.connect(user).approve(await positionManager.getAddress(), ethers.MaxUint256);
    await positionManager.connect(user).depositCollateral(1n, depositAmount, user.address);

    const borrowAmount = ethers.parseEther("2");
    const borrowFee = (borrowAmount * 300n) / 10_000n;
    const expectedCreatorBorrowShare = (borrowFee * 1000n) / 10_000n;

    await positionManager.connect(user).borrow(1n, borrowAmount, user.address);

    const totalCreatorClaimable =
      expectedCreatorTradeShare + expectedCreatorBorrowShare;
    expect(await feeRouter.creatorClaimable(1n)).to.equal(totalCreatorClaimable);

    const receiverBalanceBefore = await backingAsset.balanceOf(receiver.address);
    await core.connect(creator).claimCreatorFees(1n, receiver.address);
    const receiverBalanceAfter = await backingAsset.balanceOf(receiver.address);

    expect(receiverBalanceAfter - receiverBalanceBefore).to.equal(totalCreatorClaimable);
    expect(await feeRouter.creatorClaimable(1n)).to.equal(0n);

    const market = await core.getMarket(1n);
    expect(market.creatorFeeAccrued).to.equal(0n);
  });

  it("blocks non-creator claims", async function () {
    const { user, receiver, core, feeRouter } = await loadFixture(deployFixture);
    const buyBackingIn = ethers.parseEther("10");
    const buyQuote = await core.quoteBuy(1n, buyBackingIn);
    await core.connect(user).buy(1n, buyBackingIn, buyQuote.tokenInOrOut, user.address);

    expect(await feeRouter.creatorClaimable(1n)).to.be.gt(0n);
    await expect(core.connect(user).claimCreatorFees(1n, receiver.address)).to.be.revertedWithCustomError(
      core,
      "NotAuthorized"
    );
  });
});
