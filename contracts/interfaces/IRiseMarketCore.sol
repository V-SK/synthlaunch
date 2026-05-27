// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/RiseTypes.sol";

interface IRiseMarketCore {
    function setMarketFactory(address marketFactory) external;
    function setPositionManager(address positionManager) external;
    function setFeeRouter(address feeRouter) external;
    function setTreasuryVault(address treasuryVault) external;
    function pauseMarket(uint256 marketId) external;
    function unpauseMarket(uint256 marketId) external;
    function deprecateMarket(uint256 marketId) external;

    function registerMarket(
        uint256 marketId,
        address token,
        address backingAsset,
        address creator,
        uint64 startTime,
        bool disableSell,
        uint64 disableSellUntil,
        RiseTypes.CurveParams calldata curve,
        RiseTypes.FeeParams calldata fees,
        RiseTypes.FloorConfig calldata floorConfig,
        uint256 initialFloorPrice
    ) external;

    function buy(
        uint256 marketId,
        uint256 backingIn,
        uint256 minTokenOut,
        address receiver
    ) external returns (
        uint256 tokenOut,
        uint256 feeAmount,
        uint256 priceAfter,
        uint256 floorAfter
    );

    function sell(
        uint256 marketId,
        uint256 tokenIn,
        uint256 minBackingOut,
        address receiver
    ) external returns (
        uint256 backingOut,
        uint256 feeAmount,
        uint256 priceAfter,
        uint256 floorAfter
    );

    function redeemAtFloor(
        uint256 marketId,
        uint256 tokenIn,
        uint256 minBackingOut,
        address receiver
    ) external returns (
        uint256 backingOut,
        uint256 feeAmount,
        uint256 floorAfter
    );

    function quoteBuy(uint256 marketId, uint256 backingIn)
        external
        view
        returns (RiseTypes.QuoteResult memory);

    function quoteSell(uint256 marketId, uint256 tokenIn)
        external
        view
        returns (RiseTypes.QuoteResult memory);

    function quoteRedeemAtFloor(uint256 marketId, uint256 tokenIn)
        external
        view
        returns (RiseTypes.QuoteResult memory);

    function maybeRaiseFloor(uint256 marketId) external returns (bool raised, uint256 newFloor);
    function claimCreatorFees(uint256 marketId, address receiver) external returns (uint256 amountOut);
    function claimTreasuryFees(uint256 marketId) external returns (uint256 amountOut);
    function executeBorrow(
        uint256 marketId,
        uint256 debtAmount,
        uint256 netAmountOut,
        uint256 feeAmount,
        address receiver
    ) external;
    function executeRepay(uint256 marketId, uint256 repayAmount) external;
    function increaseTotalCollateral(uint256 marketId, uint256 amount) external;
    function decreaseTotalCollateral(uint256 marketId, uint256 amount) external;
    function getMarket(uint256 marketId) external view returns (RiseTypes.Market memory);
    function getCurrentPrice(uint256 marketId) external view returns (uint256);
    function getCurrentFloorPrice(uint256 marketId) external view returns (uint256);
    function getReserveBalance(uint256 marketId) external view returns (uint256);
}
