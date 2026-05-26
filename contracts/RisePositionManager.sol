// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IRiseMarketCore.sol";
import "./interfaces/IRiseMarketToken.sol";
import "./interfaces/IRisePositionManager.sol";
import "./libraries/RiseErrors.sol";
import "./libraries/RiseMath.sol";
import "./libraries/RiseTypes.sol";

contract RisePositionManager is Ownable, IRisePositionManager {
    using SafeERC20 for IERC20;

    IRiseMarketCore public immutable marketCore;
    mapping(uint256 => mapping(address => RiseTypes.Position)) internal _positions;

    event CollateralDeposited(
        uint256 indexed marketId,
        address indexed payer,
        address indexed owner,
        uint256 amount,
        uint256 totalCollateralAfter
    );
    event Borrowed(
        uint256 indexed marketId,
        address indexed user,
        uint256 borrowAmount,
        uint256 netAmountOut,
        uint256 feeAmount,
        uint256 debtAfter
    );
    event Repaid(
        uint256 indexed marketId,
        address indexed payer,
        address indexed owner,
        uint256 repaidAmount,
        uint256 debtAfter
    );
    event CollateralWithdrawn(
        uint256 indexed marketId,
        address indexed user,
        address indexed receiver,
        uint256 amount,
        uint256 collateralAfter
    );

    constructor(address initialOwner, address marketCore_) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert RiseErrors.ZeroAddress();
        if (marketCore_ == address(0)) revert RiseErrors.ZeroAddress();
        marketCore = IRiseMarketCore(marketCore_);
    }

    function depositCollateral(
        uint256 marketId,
        uint256 amount,
        address owner
    ) external override returns (uint256) {
        if (owner == address(0)) revert RiseErrors.ZeroAddress();
        if (amount == 0) revert RiseErrors.ZeroAmount();

        RiseTypes.Market memory market = marketCore.getMarket(marketId);
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();

        IERC20(market.token).safeTransferFrom(msg.sender, address(this), amount);

        RiseTypes.Position storage position = _position(marketId, owner);
        if (position.createdAt == 0) position.createdAt = uint64(block.timestamp);
        position.updatedAt = uint64(block.timestamp);
        position.collateralAmount += amount;

        marketCore.increaseTotalCollateral(marketId, amount);
        emit CollateralDeposited(marketId, msg.sender, owner, amount, position.collateralAmount);
        return position.collateralAmount;
    }

    function borrow(
        uint256 marketId,
        uint256 amount,
        address receiver
    ) external override returns (uint256, uint256, uint256) {
        if (receiver == address(0)) revert RiseErrors.InvalidReceiver();
        if (amount == 0) revert RiseErrors.ZeroAmount();

        RiseTypes.Market memory market = marketCore.getMarket(marketId);
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();

        RiseTypes.Position storage position = _position(marketId, msg.sender);
        uint256 maxBorrow = _maxBorrowable(market.currentFloorPrice, position.collateralAmount);
        if (position.debtAmount + amount > maxBorrow) revert RiseErrors.DebtExceedsBorrowLimit();

        uint256 feeAmount = RiseMath.computeTradeFee(amount, market.fees.borrowOriginationFeeBps);
        uint256 netAmountOut = amount - feeAmount;

        position.debtAmount += amount;
        if (position.createdAt == 0) position.createdAt = uint64(block.timestamp);
        position.updatedAt = uint64(block.timestamp);

        marketCore.executeBorrow(marketId, amount, netAmountOut, feeAmount, receiver);

        emit Borrowed(
            marketId,
            msg.sender,
            amount,
            netAmountOut,
            feeAmount,
            position.debtAmount
        );

        return (netAmountOut, feeAmount, position.debtAmount);
    }

    function repay(
        uint256 marketId,
        uint256 amount,
        address owner
    ) external override returns (uint256) {
        if (owner == address(0)) revert RiseErrors.ZeroAddress();
        if (amount == 0) revert RiseErrors.ZeroAmount();

        RiseTypes.Market memory market = marketCore.getMarket(marketId);
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();

        RiseTypes.Position storage position = _position(marketId, owner);
        uint256 effectiveRepay = amount > position.debtAmount ? position.debtAmount : amount;
        if (effectiveRepay == 0) revert RiseErrors.DebtOutstanding();

        IERC20(market.backingAsset).safeTransferFrom(msg.sender, address(marketCore), effectiveRepay);
        position.debtAmount -= effectiveRepay;
        position.updatedAt = uint64(block.timestamp);
        marketCore.executeRepay(marketId, effectiveRepay);

        emit Repaid(marketId, msg.sender, owner, effectiveRepay, position.debtAmount);
        return position.debtAmount;
    }

    function withdrawCollateral(
        uint256 marketId,
        uint256 amount,
        address receiver
    ) external override returns (uint256) {
        if (receiver == address(0)) revert RiseErrors.InvalidReceiver();
        if (amount == 0) revert RiseErrors.ZeroAmount();

        RiseTypes.Market memory market = marketCore.getMarket(marketId);
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();

        RiseTypes.Position storage position = _position(marketId, msg.sender);
        if (amount > position.collateralAmount) revert RiseErrors.InsufficientCollateral();
        uint256 remainingCollateral = position.collateralAmount - amount;
        uint256 maxDebtAfter = _maxBorrowable(market.currentFloorPrice, remainingCollateral);
        if (position.debtAmount > maxDebtAfter) revert RiseErrors.DebtExceedsBorrowLimit();

        position.collateralAmount = remainingCollateral;
        position.updatedAt = uint64(block.timestamp);
        marketCore.decreaseTotalCollateral(marketId, amount);
        IERC20(market.token).safeTransfer(receiver, amount);

        emit CollateralWithdrawn(marketId, msg.sender, receiver, amount, remainingCollateral);
        return remainingCollateral;
    }

    function getPosition(
        uint256 marketId,
        address owner
    ) external view override returns (RiseTypes.Position memory) {
        return _positions[marketId][owner];
    }

    function maxBorrowable(uint256 marketId, address owner) external view override returns (uint256) {
        RiseTypes.Market memory market = marketCore.getMarket(marketId);
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        RiseTypes.Position storage position = _positions[marketId][owner];
        return _maxBorrowable(market.currentFloorPrice, position.collateralAmount);
    }

    function availableToBorrow(uint256 marketId, address owner) external view override returns (uint256) {
        RiseTypes.Market memory market = marketCore.getMarket(marketId);
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        RiseTypes.Position storage position = _positions[marketId][owner];
        uint256 maxBorrow = _maxBorrowable(market.currentFloorPrice, position.collateralAmount);
        return maxBorrow > position.debtAmount ? maxBorrow - position.debtAmount : 0;
    }

    function _position(
        uint256 marketId,
        address owner
    ) internal view returns (RiseTypes.Position storage position) {
        position = _positions[marketId][owner];
    }

    function _maxBorrowable(
        uint256 floorPrice,
        uint256 collateralAmount
    ) internal pure returns (uint256) {
        return (collateralAmount * floorPrice) / 1e18;
    }
}
