import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Rise market pause boundaries", function () {
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
      name: "Pause Market",
      symbol: "PAUSE",
      description: "pause market",
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

    const buyBackingIn = ethers.parseEther("20");
    const buyQuote = await core.quoteBuy(1n, buyBackingIn);
    await core.connect(user).buy(1n, buyBackingIn, buyQuote.tokenInOrOut, user.address);

    await marketToken.connect(user).approve(await positionManager.getAddress(), ethers.MaxUint256);
    const depositAmount = ethers.parseEther("5");
    await positionManager.connect(user).depositCollateral(1n, depositAmount, user.address);
    await positionManager.connect(user).borrow(1n, ethers.parseEther("2"), user.address);

    return { owner, creator, user, receiver, backingAsset, core, feeRouter, positionManager, marketToken };
  }

  it("blocks new buys and borrows when paused but still allows repay, redeem, withdraw-safe, and creator claim", async function () {
    const { owner, creator, user, receiver, backingAsset, core, feeRouter, positionManager, marketToken } =
      await loadFixture(deployFixture);

    await core.connect(owner).pauseMarket(1n);

    const buyQuote = await core.quoteBuy(1n, ethers.parseEther("1"));
    await expect(
      core.connect(user).buy(1n, ethers.parseEther("1"), buyQuote.tokenInOrOut, user.address)
    ).to.be.revertedWithCustomError(core, "MarketNotActive");

    await expect(
      positionManager.connect(user).borrow(1n, ethers.parseEther("1"), user.address)
    ).to.be.revertedWithCustomError(core, "MarketNotActive");

    const debtBeforeRepay = (await positionManager.getPosition(1n, user.address)).debtAmount;
    await positionManager.connect(user).repay(1n, ethers.parseEther("1"), user.address);
    const debtAfterRepay = (await positionManager.getPosition(1n, user.address)).debtAmount;
    expect(debtAfterRepay).to.be.lt(debtBeforeRepay);

    const redeemTokenIn = ethers.parseEther("1");
    const redeemQuote = await core.quoteRedeemAtFloor(1n, redeemTokenIn);
    const backingBeforeRedeem = await backingAsset.balanceOf(user.address);
    await core.connect(user).redeemAtFloor(1n, redeemTokenIn, redeemQuote.backingInOrOut, user.address);
    const backingAfterRedeem = await backingAsset.balanceOf(user.address);
    expect(backingAfterRedeem - backingBeforeRedeem).to.equal(redeemQuote.backingInOrOut);

    const claimable = await feeRouter.creatorClaimable(1n);
    expect(claimable).to.be.gt(0n);
    const receiverBalanceBefore = await backingAsset.balanceOf(receiver.address);
    await core.connect(creator).claimCreatorFees(1n, receiver.address);
    const receiverBalanceAfter = await backingAsset.balanceOf(receiver.address);
    expect(receiverBalanceAfter - receiverBalanceBefore).to.equal(claimable);

    const withdrawAmount = ethers.parseEther("1");
    const tokenBalanceBefore = await marketToken.balanceOf(user.address);
    await positionManager.connect(user).withdrawCollateral(1n, withdrawAmount, user.address);
    const tokenBalanceAfter = await marketToken.balanceOf(user.address);
    expect(tokenBalanceAfter - tokenBalanceBefore).to.equal(withdrawAmount);
  });
});
