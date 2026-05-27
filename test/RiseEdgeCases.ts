import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Rise edge cases", function () {
  async function deployFixture() {
    const [owner, creator, user, user2, treasuryVault, pauseGuardian, timelock] =
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
      name: "Edge Market",
      symbol: "EDGE",
      description: "edge market",
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

    for (const account of [user, user2]) {
      await backingAsset.mint(account.address, ethers.parseEther("1000"));
      await backingAsset.connect(account).approve(await core.getAddress(), ethers.MaxUint256);
      await backingAsset.connect(account).approve(await positionManager.getAddress(), ethers.MaxUint256);
      await marketToken.connect(account).approve(await positionManager.getAddress(), ethers.MaxUint256);
    }

    return { user, user2, core, positionManager, backingAsset, marketToken };
  }

  it("rejects borrowing above maxBorrowable", async function () {
    const { user, core, positionManager, marketToken } = await loadFixture(deployFixture);

    const buyQuote = await core.quoteBuy(1n, ethers.parseEther("10"));
    await core.connect(user).buy(1n, ethers.parseEther("10"), buyQuote.tokenInOrOut, user.address);

    const depositAmount = ethers.parseEther("5");
    await marketToken.connect(user).approve(await positionManager.getAddress(), ethers.MaxUint256);
    await positionManager.connect(user).depositCollateral(1n, depositAmount, user.address);

    const maxBorrowable = await positionManager.maxBorrowable(1n, user.address);
    await expect(
      positionManager.connect(user).borrow(1n, maxBorrowable + 1n, user.address)
    ).to.be.revertedWithCustomError(positionManager, "DebtExceedsBorrowLimit");
  });

  it("rejects borrow when reserve is too tight", async function () {
    const { user, user2, core, positionManager, marketToken } = await loadFixture(deployFixture);

    const firstBuy = await core.quoteBuy(1n, ethers.parseEther("20"));
    await core.connect(user).buy(1n, ethers.parseEther("20"), firstBuy.tokenInOrOut, user.address);

    const secondBuy = await core.quoteBuy(1n, ethers.parseEther("20"));
    await core.connect(user2).buy(1n, ethers.parseEther("20"), secondBuy.tokenInOrOut, user2.address);

    await marketToken.connect(user).approve(await positionManager.getAddress(), ethers.MaxUint256);
    await marketToken.connect(user2).approve(await positionManager.getAddress(), ethers.MaxUint256);
    await positionManager.connect(user).depositCollateral(1n, firstBuy.tokenInOrOut, user.address);
    await positionManager.connect(user2).depositCollateral(1n, ethers.parseEther("15"), user2.address);

    await positionManager.connect(user2).borrow(1n, ethers.parseEther("15"), user2.address);

    const maxBorrowableUser1 = await positionManager.maxBorrowable(1n, user.address);
    const marketBefore = await core.getMarket(1n);
    const unpaid = marketBefore.creatorFeeAccrued + marketBefore.treasuryFeeAccrued;
    const availableReserve = marketBefore.reserveBalance - marketBefore.totalDebt - unpaid;
    const borrowFeeBps = 300n;
    const reserveLimitedDebt = ((availableReserve * 10_000n) / (10_000n - borrowFeeBps)) + 1n;
    const borrowAmount = reserveLimitedDebt < maxBorrowableUser1 ? reserveLimitedDebt : maxBorrowableUser1;

    await expect(
      positionManager.connect(user).borrow(1n, borrowAmount, user.address)
    ).to.be.revertedWithCustomError(core, "InsufficientReserve");
  });

  it("does not let floor decrease after sells and redeems", async function () {
    const { user, core } = await loadFixture(deployFixture);

    const buyQuote = await core.quoteBuy(1n, ethers.parseEther("20"));
    await core.connect(user).buy(1n, ethers.parseEther("20"), buyQuote.tokenInOrOut, user.address);
    const floorAfterBuy = (await core.getMarket(1n)).currentFloorPrice;

    const sellAmount = buyQuote.tokenInOrOut / 4n;
    const sellQuote = await core.quoteSell(1n, sellAmount);
    await core.connect(user).sell(1n, sellAmount, sellQuote.backingInOrOut, user.address);
    const floorAfterSell = (await core.getMarket(1n)).currentFloorPrice;

    const redeemAmount = buyQuote.tokenInOrOut / 4n;
    const redeemQuote = await core.quoteRedeemAtFloor(1n, redeemAmount);
    await core.connect(user).redeemAtFloor(1n, redeemAmount, redeemQuote.backingInOrOut, user.address);
    const floorAfterRedeem = (await core.getMarket(1n)).currentFloorPrice;

    expect(floorAfterSell).to.be.gte(floorAfterBuy);
    expect(floorAfterRedeem).to.be.gte(floorAfterSell);
  });

  it("allows near-full floor redemption in multiple steps without violating price-floor relation", async function () {
    const { user, core, marketToken } = await loadFixture(deployFixture);

    const buyQuote = await core.quoteBuy(1n, ethers.parseEther("12"));
    await core.connect(user).buy(1n, ethers.parseEther("12"), buyQuote.tokenInOrOut, user.address);

    let remaining = await marketToken.balanceOf(user.address);
    for (let i = 0; i < 3; i++) {
      const redeemAmount = i === 2 ? remaining : remaining / 2n;
      const quote = await core.quoteRedeemAtFloor(1n, redeemAmount);
      await core.connect(user).redeemAtFloor(1n, redeemAmount, quote.backingInOrOut, user.address);
      remaining = await marketToken.balanceOf(user.address);
      const market = await core.getMarket(1n);
      expect(market.currentPrice).to.be.gte(market.currentFloorPrice);
    }

    expect(await marketToken.balanceOf(user.address)).to.equal(0n);
  });
});
