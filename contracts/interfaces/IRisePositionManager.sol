// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/RiseTypes.sol";

interface IRisePositionManager {
    function depositCollateral(
        uint256 marketId,
        uint256 amount,
        address owner
    ) external returns (uint256 newCollateralAmount);

    function borrow(
        uint256 marketId,
        uint256 amount,
        address receiver
    ) external returns (
        uint256 netAmountOut,
        uint256 feeAmount,
        uint256 newDebtAmount
    );

    function repay(
        uint256 marketId,
        uint256 amount,
        address owner
    ) external returns (uint256 remainingDebt);

    function withdrawCollateral(
        uint256 marketId,
        uint256 amount,
        address receiver
    ) external returns (uint256 remainingCollateral);

    function getPosition(
        uint256 marketId,
        address owner
    ) external view returns (RiseTypes.Position memory);

    function maxBorrowable(uint256 marketId, address owner) external view returns (uint256);
    function availableToBorrow(uint256 marketId, address owner) external view returns (uint256);
}
