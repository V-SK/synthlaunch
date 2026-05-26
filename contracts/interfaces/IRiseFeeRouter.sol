// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/RiseTypes.sol";

interface IRiseFeeRouter {
    function setCore(address core) external;
    function registerMarket(
        uint256 marketId,
        address creator,
        RiseTypes.FeeParams calldata fees
    ) external;

    function accrueTradingFee(
        uint256 marketId,
        uint256 feeAmount
    ) external returns (
        uint256 creatorShare,
        uint256 treasuryShare,
        uint256 floorShare
    );

    function accrueBorrowFee(
        uint256 marketId,
        uint256 feeAmount
    ) external returns (
        uint256 creatorShare,
        uint256 treasuryShare,
        uint256 floorShare
    );

    function claimCreatorFees(
        uint256 marketId,
        address caller,
        address receiver
    ) external returns (uint256 amountOut);
    function claimTreasuryFees(uint256 marketId, address receiver) external returns (uint256 amountOut);

    function creatorOf(uint256 marketId) external view returns (address);
    function creatorClaimable(uint256 marketId) external view returns (uint256);
    function treasuryAccrued(uint256 marketId) external view returns (uint256);
    function floorAccrued(uint256 marketId) external view returns (uint256);
}
