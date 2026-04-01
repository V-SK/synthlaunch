// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SynthStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant COOLDOWN_PERIOD = 7 days;

    IERC20 public immutable synthToken;
    address public immutable rewardToken;

    uint256 public totalActiveStaked;

    struct Position {
        uint256 amount;
        uint256 stakeTimestamp;
        uint256 unstakeRequestTime;
        uint256 frozenMultiplier;
    }

    mapping(address => Position) private positions;

    event Staked(address indexed user, uint256 amount, uint256 totalAmount, uint256 stakeTimestamp);
    event UnstakeRequested(address indexed user, uint256 amount, uint256 multiplier, uint256 requestTimestamp);
    event UnstakeFinalized(address indexed user, uint256 amount);

    constructor(address synthToken_, address rewardToken_) Ownable(msg.sender) {
        require(synthToken_ != address(0), "Invalid synth token");
        synthToken = IERC20(synthToken_);
        rewardToken = rewardToken_;
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount is zero");

        Position storage position = positions[msg.sender];
        require(position.unstakeRequestTime == 0, "Cooldown active");

        synthToken.safeTransferFrom(msg.sender, address(this), amount);

        position.amount += amount;
        position.stakeTimestamp = block.timestamp;
        position.frozenMultiplier = 0;

        totalActiveStaked += amount;

        emit Staked(msg.sender, amount, position.amount, block.timestamp);
    }

    function requestUnstake() external nonReentrant {
        Position storage position = positions[msg.sender];

        require(position.amount > 0, "No active stake");
        require(position.unstakeRequestTime == 0, "Cooldown active");

        uint256 multiplier = _multiplierForDuration(block.timestamp - position.stakeTimestamp);

        position.unstakeRequestTime = block.timestamp;
        position.frozenMultiplier = multiplier;

        totalActiveStaked -= position.amount;

        emit UnstakeRequested(msg.sender, position.amount, multiplier, block.timestamp);
    }

    function finalizeUnstake() external nonReentrant {
        Position memory position = positions[msg.sender];

        require(position.amount > 0, "No stake found");
        require(position.unstakeRequestTime > 0, "Unstake not requested");
        require(block.timestamp >= position.unstakeRequestTime + COOLDOWN_PERIOD, "Cooldown not finished");

        delete positions[msg.sender];
        synthToken.safeTransfer(msg.sender, position.amount);

        emit UnstakeFinalized(msg.sender, position.amount);
    }

    function getStakeInfo(address user)
        external
        view
        returns (
            uint256 stakedAmount,
            uint256 multiplier,
            uint256 stakeTimestamp,
            uint256 unstakeRequestTime
        )
    {
        Position memory position = positions[user];

        stakedAmount = position.amount;
        stakeTimestamp = position.stakeTimestamp;
        unstakeRequestTime = position.unstakeRequestTime;

        if (position.amount == 0) {
            return (0, 0, 0, 0);
        }

        if (position.unstakeRequestTime > 0) {
            multiplier = position.frozenMultiplier;
        } else {
            multiplier = _multiplierForDuration(block.timestamp - position.stakeTimestamp);
        }
    }

    function _multiplierForDuration(uint256 duration) internal pure returns (uint256) {
        if (duration < 7 days) {
            return 1;
        }
        if (duration < 30 days) {
            return 2;
        }
        if (duration < 90 days) {
            return 3;
        }
        if (duration < 180 days) {
            return 4;
        }
        return 5;
    }
}
