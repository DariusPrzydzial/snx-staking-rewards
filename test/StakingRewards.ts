import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { StakingRewards } from "../typechain-types";


let stakingRewards: StakingRewards
let owner: SignerWithAddress
let alice: SignerWithAddress
let bob: SignerWithAddress
let craig: SignerWithAddress

describe("StakingRewards", function () {

  const HUNDRED_ETH = ethers.utils.parseEther("100")
  const ONE_ETH = ethers.utils.parseEther("1")

  it("should manage StakingRewards lifecycle", async () => {
    [owner, alice, bob, craig] = await ethers.getSigners();

    // deploy contracts
    const SimpleERC20 = await ethers.getContractFactory("SimpleERC20");
    const erc20Staking = await SimpleERC20.deploy("LP Token", "LP");
    const erc20Rewards = await SimpleERC20.deploy("Wrapped ETH", "WETH");

    const StakingRewards = await ethers.getContractFactory("StakingRewards");
    stakingRewards = await StakingRewards.deploy(owner.address, owner.address, erc20Rewards.address, erc20Staking.address)

    // setup ERC20
    await erc20Staking.mint(owner.address, HUNDRED_ETH)
    await erc20Staking.mint(alice.address, HUNDRED_ETH)
    await erc20Staking.mint(bob.address, HUNDRED_ETH)
    await erc20Staking.mint(craig.address, HUNDRED_ETH)

    await erc20Rewards.mint(owner.address, HUNDRED_ETH)

    // begin the rewards period
    await erc20Rewards.transfer(stakingRewards.address, HUNDRED_ETH)
    await stakingRewards.notifyRewardAmount(HUNDRED_ETH)

    console.log("after notifyRewardAmount")
    await log()

    // stake
    await erc20Staking.approve(stakingRewards.address, HUNDRED_ETH)
    await stakingRewards.stake(HUNDRED_ETH)

    console.log("after stake")
    await log()

    // fast forward to 3/10 through
    await time.increase(60 * 60 * 24 * 3)

    console.log("after increasing time by 3/10ths the rewardsDuration")
    await log()

    await erc20Staking.connect(craig).approve(stakingRewards.address, HUNDRED_ETH)
    await stakingRewards.connect(craig).stake(HUNDRED_ETH)

    console.log("after craig stakes")
    await log()

    // fast forward to 5/10s through
    await time.increase(60 * 60 * 24 * 2)

    console.log("after increasing time by 5/10ths the rewardsDuration")
    await log()

    // have craig exit, so the total supply is brought back down to 100
    await stakingRewards.connect(craig).exit()

    console.log("after craig exit")
    await log()

    // have alice stake 100 LP Token
    await erc20Staking.connect(alice).approve(stakingRewards.address, HUNDRED_ETH)
    await stakingRewards.connect(alice).stake(HUNDRED_ETH)

    console.log("after alice stakes at 5/10th")
    await log()

    // increase time to 6/10 through the reward period
    await time.increase(60 * 60 * 24 * 1)

    console.log("after 7/10 done")
    await log()

    // add a third staker, bob, who stakes for 1/10 of the time and then exits
    // this will help us see how intermediate changes in the rewardPerToken and
    // rewardPerTokenStored affect the owner and alice
    await erc20Staking.connect(bob).approve(stakingRewards.address, HUNDRED_ETH)
    await stakingRewards.connect(bob).stake(HUNDRED_ETH)

    console.log("after bob stake")
    await log()

    // increase time to 7/10ths through the reward period
    await time.increase(60 * 60 * 24 * 1)

    console.log("after 8/10 done")
    await log()

    // have bob exit, so the total supply is brought back down to 200
    await time.increase(60 * 60 * 24 * 2)
    await stakingRewards.connect(bob).exit()

    console.log("after bob exit")
    await log()

    // increase time to the end (10/10) of the period
    const periodFinish = await stakingRewards.periodFinish()
    await time.increaseTo(periodFinish)

    console.log("after reached periodFinish")
    await log()

    // both exit
    await stakingRewards.exit()
    await stakingRewards.connect(alice).exit()

    console.log("after exit")
    await log()

    console.log("owner balance WETH", Number(await (await erc20Rewards.balanceOf(owner.address)).toString()) / 1e18)
    console.log("alice balance WETH", Number(await (await erc20Rewards.balanceOf(alice.address)).toString()) / 1e18)
    console.log("bob balance WETH  ", Number(await (await erc20Rewards.balanceOf(bob.address)).toString()) / 1e18)
    console.log("craig balance WETH", Number(await (await erc20Rewards.balanceOf(craig.address)).toString()) / 1e18)

  })

  const log = async () => {
    console.log("rewardPerTokenStored         ", Number(await (await stakingRewards.rewardPerTokenStored()).toString()) / 1e18)
    console.log("lastTimeRewardApplicable     ", await (await stakingRewards.lastTimeRewardApplicable()).toString())
    console.log("lastUpdateTime               ", await (await stakingRewards.lastUpdateTime()).toString())
    console.log("rewardRate                   ", await (await stakingRewards.rewardRate()).toString())
    console.log("rewardPerToken               ", Number(await (await stakingRewards.rewardPerToken()).toString()) / 1e18)
    console.log("totalSupply                  ", await (await stakingRewards.totalSupply()).div(ONE_ETH).toString())
    console.log("owner earned                 ", Number(await (await stakingRewards.earned(owner.address)).toString()) / 1e18)
    console.log("alice earned                 ", Number(await (await stakingRewards.earned(alice.address)).toString()) / 1e18)
    console.log("bob earned                   ", Number(await (await stakingRewards.earned(bob.address)).toString()) / 1e18)
    console.log("craig earned                 ", Number(await (await stakingRewards.earned(craig.address)).toString()) / 1e18)
    console.log("owner userRewardPerTokenPaid ", Number(await (await stakingRewards.userRewardPerTokenPaid(owner.address)).toString()) / 1e18)
    console.log("alice userRewardPerTokenPaid ", Number(await (await stakingRewards.userRewardPerTokenPaid(alice.address)).toString()) / 1e18)
    console.log("bob userRewardPerTokenPaid   ", Number(await (await stakingRewards.userRewardPerTokenPaid(bob.address)).toString()) / 1e18)
    console.log("craig userRewardPerTokenPaid ", Number(await (await stakingRewards.userRewardPerTokenPaid(craig.address)).toString()) / 1e18)

    console.log("\n")
  }
});