import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("RisePositionManager borrow flow", function () {
  async function deployFixture() {
    const [owner, creator, user, treasuryVault, pauseGuardian, timelock] =
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

    const RisePositionManager = await ethers.getContractFactory("RisePositionManager");
    const positionManager = await RisePositionManager.deploy(owner.address, await core.getAddress());
    await positionManager.waitForDeployment();
    await core.connect(owner).setPositionManager(await positionManager.getAddress());

    const startTime = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 5n;
    const params = {
      name: "Borrow Market",
      symbol: "BRW",
      description: "borrow market",
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

    return { user, backingAsset, core, marketToken, positionManager, buyQuote };
  }

  it("supports deposit, borrow, repay, and withdraw", async function () {
    const { user, backingAsset, core, marketToken, positionManager, buyQuote } =
      await loadFixture(deployFixture);

    const depositAmount = buyQuote.tokenInOrOut / 2n;
    await positionManager.connect(user).depositCollateral(1n, depositAmount, user.address);

    const marketAfterDeposit = await core.getMarket(1n);
    const maxBorrowable = await positionManager.maxBorrowable(1n, user.address);
    expect(maxBorrowable).to.equal((depositAmount * marketAfterDeposit.currentFloorPrice) / ethers.parseEther("1"));

    const borrowAmount = depositAmount / 2n;
    const expectedFee = (borrowAmount * 300n) / 10_000n;
    const expectedNet = borrowAmount - expectedFee;
    const balanceBeforeBorrow = await backingAsset.balanceOf(user.address);

    await positionManager.connect(user).borrow(1n, borrowAmount, user.address);

    const balanceAfterBorrow = await backingAsset.balanceOf(user.address);
    expect(balanceAfterBorrow - balanceBeforeBorrow).to.equal(expectedNet);

    const positionAfterBorrow = await positionManager.getPosition(1n, user.address);
    expect(positionAfterBorrow.collateralAmount).to.equal(depositAmount);
    expect(positionAfterBorrow.debtAmount).to.equal(borrowAmount);

    const marketAfterBorrow = await core.getMarket(1n);
    expect(marketAfterBorrow.totalDebt).to.equal(borrowAmount);
    expect(marketAfterBorrow.totalCollateral).to.equal(depositAmount);

    const partialRepay = borrowAmount / 2n;
    await positionManager.connect(user).repay(1n, partialRepay, user.address);
    const positionAfterRepay = await positionManager.getPosition(1n, user.address);
    expect(positionAfterRepay.debtAmount).to.equal(borrowAmount - partialRepay);

    await expect(
      positionManager.connect(user).withdrawCollateral(1n, depositAmount, user.address)
    ).to.be.revertedWithCustomError(positionManager, "DebtExceedsBorrowLimit");

    await positionManager.connect(user).repay(1n, borrowAmount, user.address);
    const positionAfterFullRepay = await positionManager.getPosition(1n, user.address);
    expect(positionAfterFullRepay.debtAmount).to.equal(0n);

    const tokenBalanceBeforeWithdraw = await marketToken.balanceOf(user.address);
    await positionManager.connect(user).withdrawCollateral(1n, depositAmount, user.address);
    const tokenBalanceAfterWithdraw = await marketToken.balanceOf(user.address);
    expect(tokenBalanceAfterWithdraw - tokenBalanceBeforeWithdraw).to.equal(depositAmount);

    const finalPosition = await positionManager.getPosition(1n, user.address);
    expect(finalPosition.collateralAmount).to.equal(0n);
  });
});
