import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("SynthStaking", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const synthToken = await MockERC20.deploy("Synth", "SYNTH");
    await synthToken.waitForDeployment();

    const SynthStaking = await ethers.getContractFactory("SynthStaking");
    const staking = await SynthStaking.deploy(await synthToken.getAddress(), ethers.ZeroAddress);
    await staking.waitForDeployment();

    const initialStake = ethers.parseEther("100");
    await synthToken.mint(user.address, ethers.parseEther("1000"));
    await synthToken.connect(user).approve(await staking.getAddress(), ethers.parseEther("1000"));

    return { owner, user, synthToken, staking, initialStake };
  }

  it("stores stake info and starts at 1x", async function () {
    const { user, staking, initialStake } = await loadFixture(deployFixture);

    await staking.connect(user).stake(initialStake);

    const [amount, multiplier, stakeTimestamp, unstakeRequestTime] = await staking.getStakeInfo(user.address);

    expect(amount).to.equal(initialStake);
    expect(multiplier).to.equal(1n);
    expect(stakeTimestamp).to.be.gt(0n);
    expect(unstakeRequestTime).to.equal(0n);
    expect(await staking.totalActiveStaked()).to.equal(initialStake);
  });

  it("updates multiplier across time thresholds", async function () {
    const { user, staking, initialStake } = await loadFixture(deployFixture);

    await staking.connect(user).stake(initialStake);
    const [, , stakeTimestamp] = await staking.getStakeInfo(user.address);

    await time.increaseTo(stakeTimestamp + 7n * 24n * 60n * 60n);
    expect((await staking.getStakeInfo(user.address))[1]).to.equal(2n);

    await time.increaseTo(stakeTimestamp + 30n * 24n * 60n * 60n);
    expect((await staking.getStakeInfo(user.address))[1]).to.equal(3n);

    await time.increaseTo(stakeTimestamp + 90n * 24n * 60n * 60n);
    expect((await staking.getStakeInfo(user.address))[1]).to.equal(4n);

    await time.increaseTo(stakeTimestamp + 180n * 24n * 60n * 60n);
    expect((await staking.getStakeInfo(user.address))[1]).to.equal(5n);
  });

  it("allows top-up on active position and resets timer", async function () {
    const { user, staking, initialStake } = await loadFixture(deployFixture);
    const topUp = ethers.parseEther("25");

    await staking.connect(user).stake(initialStake);
    const [, , firstStakeTimestamp] = await staking.getStakeInfo(user.address);

    await time.increase(40 * 24 * 60 * 60);
    await staking.connect(user).stake(topUp);

    const [amount, multiplier, secondStakeTimestamp, unstakeRequestTime] = await staking.getStakeInfo(user.address);

    expect(amount).to.equal(initialStake + topUp);
    expect(multiplier).to.equal(1n);
    expect(secondStakeTimestamp).to.be.gt(firstStakeTimestamp);
    expect(unstakeRequestTime).to.equal(0n);
    expect(await staking.totalActiveStaked()).to.equal(initialStake + topUp);
  });

  it("freezes multiplier and removes active stake on requestUnstake", async function () {
    const { user, staking, initialStake } = await loadFixture(deployFixture);

    await staking.connect(user).stake(initialStake);
    await time.increase(35 * 24 * 60 * 60);

    await staking.connect(user).requestUnstake();

    const [amount, multiplier, , unstakeRequestTime] = await staking.getStakeInfo(user.address);
    expect(amount).to.equal(initialStake);
    expect(multiplier).to.equal(3n);
    expect(unstakeRequestTime).to.be.gt(0n);
    expect(await staking.totalActiveStaked()).to.equal(0n);

    await time.increase(15 * 24 * 60 * 60);
    expect((await staking.getStakeInfo(user.address))[1]).to.equal(3n);
  });

  it("blocks new stake during cooldown", async function () {
    const { user, staking, initialStake } = await loadFixture(deployFixture);

    await staking.connect(user).stake(initialStake);
    await staking.connect(user).requestUnstake();

    await expect(staking.connect(user).stake(ethers.parseEther("1"))).to.be.revertedWith("Cooldown active");
  });

  it("finalizes after cooldown and resets future stake to 1x", async function () {
    const { user, synthToken, staking, initialStake } = await loadFixture(deployFixture);

    await staking.connect(user).stake(initialStake);
    await time.increase(100 * 24 * 60 * 60);
    await staking.connect(user).requestUnstake();

    await expect(staking.connect(user).finalizeUnstake()).to.be.revertedWith("Cooldown not finished");

    await time.increase(7 * 24 * 60 * 60);
    await staking.connect(user).finalizeUnstake();

    const [amount, multiplier, stakeTimestamp, unstakeRequestTime] = await staking.getStakeInfo(user.address);
    expect(amount).to.equal(0n);
    expect(multiplier).to.equal(0n);
    expect(stakeTimestamp).to.equal(0n);
    expect(unstakeRequestTime).to.equal(0n);
    expect(await synthToken.balanceOf(user.address)).to.equal(ethers.parseEther("1000"));

    await staking.connect(user).stake(ethers.parseEther("10"));
    expect((await staking.getStakeInfo(user.address))[1]).to.equal(1n);
  });
});
