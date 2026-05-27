import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("RiseMarketCore trading", function () {
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

    const startTime = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 5n;
    const params = {
      name: "Flat Curve Market",
      symbol: "FLAT",
      description: "flat curve market",
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
    const tokenAddress = await factory.marketToken(1n);
    const marketToken = await ethers.getContractAt("RiseMarketToken", tokenAddress);
    await time.increaseTo(startTime);

    await backingAsset.mint(user.address, ethers.parseEther("1000"));
    await backingAsset.connect(user).approve(await core.getAddress(), ethers.MaxUint256);

    return { owner, creator, user, backingAsset, core, marketToken };
  }

  it("matches buy quote to execution on a flat curve", async function () {
    const { user, core, marketToken } = await loadFixture(deployFixture);
    const backingIn = ethers.parseEther("10");

    const quote = await core.quoteBuy(1n, backingIn);
    await core.connect(user).buy(1n, backingIn, quote.tokenInOrOut, user.address);

    expect(await marketToken.balanceOf(user.address)).to.equal(quote.tokenInOrOut);

    const market = await core.getMarket(1n);
    expect(market.totalSupply).to.equal(quote.tokenInOrOut);
    expect(market.reserveBalance).to.equal(backingIn);
    expect(market.currentPrice).to.equal(market.currentFloorPrice);
    expect(market.currentPrice).to.be.gte(ethers.parseEther("1"));
  });

  it("matches sell quote to execution after a buy", async function () {
    const { user, core, marketToken, backingAsset } = await loadFixture(deployFixture);
    const backingIn = ethers.parseEther("10");

    const buyQuote = await core.quoteBuy(1n, backingIn);
    await core.connect(user).buy(1n, backingIn, buyQuote.tokenInOrOut, user.address);

    const tokenIn = buyQuote.tokenInOrOut / 2n;
    const sellQuote = await core.quoteSell(1n, tokenIn);
    const balanceBefore = await backingAsset.balanceOf(user.address);

    await core.connect(user).sell(1n, tokenIn, sellQuote.backingInOrOut, user.address);

    const balanceAfter = await backingAsset.balanceOf(user.address);
    expect(balanceAfter - balanceBefore).to.equal(sellQuote.backingInOrOut);
    expect(await marketToken.balanceOf(user.address)).to.equal(buyQuote.tokenInOrOut - tokenIn);
  });

  it("matches redeem quote to execution after a buy", async function () {
    const { user, core, marketToken, backingAsset } = await loadFixture(deployFixture);
    const backingIn = ethers.parseEther("10");

    const buyQuote = await core.quoteBuy(1n, backingIn);
    await core.connect(user).buy(1n, backingIn, buyQuote.tokenInOrOut, user.address);

    const tokenIn = ethers.parseEther("1");
    const redeemQuote = await core.quoteRedeemAtFloor(1n, tokenIn);
    const balanceBefore = await backingAsset.balanceOf(user.address);

    await core.connect(user).redeemAtFloor(1n, tokenIn, redeemQuote.backingInOrOut, user.address);

    const balanceAfter = await backingAsset.balanceOf(user.address);
    expect(balanceAfter - balanceBefore).to.equal(redeemQuote.backingInOrOut);
    expect(await marketToken.balanceOf(user.address)).to.equal(buyQuote.tokenInOrOut - tokenIn);
  });
});
