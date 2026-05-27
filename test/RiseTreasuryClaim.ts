import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Rise treasury claim", function () {
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
    await core.setTreasuryVault(treasuryVault.address);

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

    const startTime = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 5n;
    const params = {
      name: "Treasury Market",
      symbol: "TRSY",
      description: "treasury market",
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

    await backingAsset.mint(user.address, ethers.parseEther("1000"));
    await backingAsset.connect(user).approve(await core.getAddress(), ethers.MaxUint256);

    return { owner, user, treasuryVault, backingAsset, core, feeRouter };
  }

  it("moves treasury accrued fees to treasury vault", async function () {
    const { owner, user, treasuryVault, backingAsset, core, feeRouter } = await loadFixture(
      deployFixture
    );

    const buyBackingIn = ethers.parseEther("10");
    const tradeFee = (buyBackingIn * 125n) / 10_000n;
    const expectedTreasuryShare = (tradeFee * 2000n) / 10_000n;

    const quote = await core.quoteBuy(1n, buyBackingIn);
    await core.connect(user).buy(1n, buyBackingIn, quote.tokenInOrOut, user.address);

    expect(await feeRouter.treasuryAccrued(1n)).to.equal(expectedTreasuryShare);

    const vaultBalanceBefore = await backingAsset.balanceOf(treasuryVault.address);
    await core.connect(owner).claimTreasuryFees(1n);
    const vaultBalanceAfter = await backingAsset.balanceOf(treasuryVault.address);

    expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(expectedTreasuryShare);
    expect(await feeRouter.treasuryAccrued(1n)).to.equal(0n);

    const market = await core.getMarket(1n);
    expect(market.treasuryFeeAccrued).to.equal(0n);
  });
});
