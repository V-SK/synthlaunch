// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRiseFeeRouter.sol";
import "./libraries/RiseErrors.sol";
import "./libraries/RiseTypes.sol";

contract RiseFeeRouter is Ownable, IRiseFeeRouter {
    address public core;
    mapping(uint256 => address) private _creatorOf;
    mapping(uint256 => RiseTypes.FeeParams) private _feeParams;
    mapping(uint256 => uint256) private _creatorClaimable;
    mapping(uint256 => uint256) private _treasuryAccrued;
    mapping(uint256 => uint256) private _floorAccrued;

    event TradingFeeAccrued(
        uint256 indexed marketId,
        uint256 feeAmount,
        uint256 creatorShare,
        uint256 treasuryShare,
        uint256 floorShare
    );
    event BorrowFeeAccrued(
        uint256 indexed marketId,
        uint256 feeAmount,
        uint256 creatorShare,
        uint256 treasuryShare,
        uint256 floorShare
    );
    event CreatorFeesClaimed(
        uint256 indexed marketId,
        address indexed receiver,
        uint256 amountOut
    );
    event TreasuryFeesClaimed(
        uint256 indexed marketId,
        address indexed receiver,
        uint256 amountOut
    );
    event CoreUpdated(address indexed core);
    event MarketFeeConfigRegistered(uint256 indexed marketId, address indexed creator);

    modifier onlyCore() {
        if (msg.sender != core) revert RiseErrors.NotAuthorized();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert RiseErrors.ZeroAddress();
    }

    function setCore(address core_) external override onlyOwner {
        if (core_ == address(0)) revert RiseErrors.ZeroAddress();
        core = core_;
        emit CoreUpdated(core_);
    }

    function registerMarket(
        uint256 marketId,
        address creator,
        RiseTypes.FeeParams calldata fees
    ) external override onlyCore {
        if (creator == address(0)) revert RiseErrors.ZeroAddress();
        if (_creatorOf[marketId] != address(0)) revert RiseErrors.InvalidMarketStatus();
        if (fees.creatorShareBps + fees.treasuryShareBps + fees.floorShareBps != 10_000) {
            revert RiseErrors.FeeShareMismatch();
        }
        _creatorOf[marketId] = creator;
        _feeParams[marketId] = fees;
        emit MarketFeeConfigRegistered(marketId, creator);
    }

    function accrueTradingFee(
        uint256 marketId,
        uint256 feeAmount
    ) external override onlyCore returns (uint256, uint256, uint256) {
        return _accrue(marketId, feeAmount, true);
    }

    function accrueBorrowFee(
        uint256 marketId,
        uint256 feeAmount
    ) external override onlyCore returns (uint256, uint256, uint256) {
        return _accrue(marketId, feeAmount, false);
    }

    function claimCreatorFees(
        uint256 marketId,
        address caller,
        address receiver
    ) external override returns (uint256 amountOut) {
        if (msg.sender != core) revert RiseErrors.NotAuthorized();
        if (caller != _creatorOf[marketId]) revert RiseErrors.NotAuthorized();
        if (receiver == address(0)) revert RiseErrors.ZeroAddress();
        amountOut = _creatorClaimable[marketId];
        _creatorClaimable[marketId] = 0;
        emit CreatorFeesClaimed(marketId, receiver, amountOut);
    }

    function claimTreasuryFees(
        uint256 marketId,
        address receiver
    ) external override returns (uint256 amountOut) {
        if (msg.sender != core) revert RiseErrors.NotAuthorized();
        if (receiver == address(0)) revert RiseErrors.ZeroAddress();
        amountOut = _treasuryAccrued[marketId];
        _treasuryAccrued[marketId] = 0;
        emit TreasuryFeesClaimed(marketId, receiver, amountOut);
    }

    function creatorOf(uint256 marketId) external view override returns (address) {
        return _creatorOf[marketId];
    }

    function creatorClaimable(uint256 marketId) external view override returns (uint256) {
        return _creatorClaimable[marketId];
    }

    function treasuryAccrued(uint256 marketId) external view override returns (uint256) {
        return _treasuryAccrued[marketId];
    }

    function floorAccrued(uint256 marketId) external view override returns (uint256) {
        return _floorAccrued[marketId];
    }

    function _accrue(
        uint256 marketId,
        uint256 feeAmount,
        bool isTrading
    ) internal returns (uint256 creatorShare, uint256 treasuryShare, uint256 floorShare) {
        if (_creatorOf[marketId] == address(0)) revert RiseErrors.MarketNotFound();
        RiseTypes.FeeParams memory fees = _feeParams[marketId];
        creatorShare = (feeAmount * fees.creatorShareBps) / 10_000;
        treasuryShare = (feeAmount * fees.treasuryShareBps) / 10_000;
        floorShare = feeAmount - creatorShare - treasuryShare;

        _creatorClaimable[marketId] += creatorShare;
        _treasuryAccrued[marketId] += treasuryShare;
        _floorAccrued[marketId] += floorShare;

        if (isTrading) {
            emit TradingFeeAccrued(marketId, feeAmount, creatorShare, treasuryShare, floorShare);
        } else {
            emit BorrowFeeAccrued(marketId, feeAmount, creatorShare, treasuryShare, floorShare);
        }
    }
}
