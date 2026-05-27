import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state;
  };
}

describe("Rise invariant-style random sequences", function () {
  async function deployFixture() {
    const [owner, creator, userA, userB, treasuryVault, pauseGuardian, timelock, creatorReceiver] =
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
      name: "Invariant Market",
      symbol: "INV",
      description: "invariant market",
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

    for (const user of [userA, userB]) {
      await backingAsset.mint(user.address, ethers.parseEther("1000"));
      await backingAsset.connect(user).approve(await core.getAddress(), ethers.MaxUint256);
      await backingAsset.connect(user).approve(await positionManager.getAddress(), ethers.MaxUint256);
      await marketToken.connect(user).approve(await positionManager.getAddress(), ethers.MaxUint256);
    }

    return {
      creator,
      creatorReceiver,
      userA,
      userB,
      backingAsset,
      marketToken,
      core,
      feeRouter,
      positionManager,
    };
  }

  async function assertInvariants(ctx: Awaited<ReturnType<typeof deployFixture>>) {
    const market = await ctx.core.getMarket(1n);
    const posA = await ctx.positionManager.getPosition(1n, ctx.userA.address);
    const posB = await ctx.positionManager.getPosition(1n, ctx.userB.address);

    expect(market.currentPrice).to.be.gte(market.currentFloorPrice);
    expect(market.currentFloorPrice).to.be.gte(market.initialFloorPrice);
    expect(market.totalDebt).to.equal(posA.debtAmount + posB.debtAmount);
    expect(market.totalCollateral).to.equal(posA.collateralAmount + posB.collateralAmount);

    const creatorClaimable = await ctx.feeRouter.creatorClaimable(1n);
    const treasuryAccrued = await ctx.feeRouter.treasuryAccrued(1n);
    const floorAccrued = await ctx.feeRouter.floorAccrued(1n);

    expect(market.creatorFeeAccrued).to.equal(creatorClaimable);
    expect(market.treasuryFeeAccrued).to.equal(treasuryAccrued);
    expect(market.floorFeeAccrued).to.equal(floorAccrued);
  }

  it("preserves core invariants across a deterministic random action sequence", async function () {
    const ctx = await loadFixture(deployFixture);
    const rng = makeRng(42);
    const users = [ctx.userA, ctx.userB];

    for (let step = 0; step < 30; step++) {
      const user = users[rng() % users.length];
      const market = await ctx.core.getMarket(1n);
      const position = await ctx.positionManager.getPosition(1n, user.address);
      const walletToken = await ctx.marketToken.balanceOf(user.address);
      const walletBacking = await ctx.backingAsset.balanceOf(user.address);

      const action = rng() % 6;

      if (action === 0) {
        const backingIn = ethers.parseEther(((rng() % 5) + 1).toString());
        if (walletBacking >= backingIn) {
          const quote = await ctx.core.quoteBuy(1n, backingIn);
          if (quote.tokenInOrOut > 0) {
            await ctx.core.connect(user).buy(1n, backingIn, quote.tokenInOrOut, user.address);
          }
        }
      } else if (action === 1) {
        if (walletToken > 0) {
          const tokenIn = walletToken / 2n || walletToken;
          const quote = await ctx.core.quoteSell(1n, tokenIn);
          if (quote.backingInOrOut > 0) {
            await ctx.core.connect(user).sell(1n, tokenIn, quote.backingInOrOut, user.address);
          }
        }
      } else if (action === 2) {
        if (walletToken > 0) {
          const depositAmount = walletToken / 2n || walletToken;
          await ctx.positionManager.connect(user).depositCollateral(1n, depositAmount, user.address);
        }
      } else if (action === 3) {
        const available = await ctx.positionManager.availableToBorrow(1n, user.address);
        if (available > 0) {
          const borrowAmount = available / 2n || available;
          await ctx.positionManager.connect(user).borrow(1n, borrowAmount, user.address);
        }
      } else if (action === 4) {
        if (position.debtAmount > 0) {
          const repayAmount = position.debtAmount / 2n || position.debtAmount;
          await ctx.positionManager.connect(user).repay(1n, repayAmount, user.address);
        }
      } else {
        if (walletToken > 0) {
          const redeemAmount = walletToken / 3n || walletToken;
          const quote = await ctx.core.quoteRedeemAtFloor(1n, redeemAmount);
          if (quote.backingInOrOut > 0) {
            await ctx.core.connect(user).redeemAtFloor(1n, redeemAmount, quote.backingInOrOut, user.address);
          }
        }
      }

      await assertInvariants(ctx);
    }

    const creatorClaimable = await ctx.feeRouter.creatorClaimable(1n);
    if (creatorClaimable > 0) {
      const before = await ctx.backingAsset.balanceOf(ctx.creatorReceiver.address);
      await ctx.core.connect(ctx.creator).claimCreatorFees(1n, ctx.creatorReceiver.address);
      const after = await ctx.backingAsset.balanceOf(ctx.creatorReceiver.address);
      expect(after - before).to.equal(creatorClaimable);
    }

    await assertInvariants(ctx);
  });
});
