// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IRiseFeeRouter.sol";
import "./interfaces/IRiseMarketCore.sol";
import "./interfaces/IRiseMarketToken.sol";
import "./libraries/RiseErrors.sol";
import "./libraries/RiseMath.sol";
import "./libraries/RiseTypes.sol";

contract RiseMarketCore is Ownable, IRiseMarketCore {
    using SafeERC20 for IERC20;

    mapping(uint256 => RiseTypes.Market) internal _markets;
    address public marketFactory;
    address public positionManager;
    address public feeRouter;
    address public treasuryVault;

    event MarketRegistered(uint256 indexed marketId, address indexed token, address indexed backingAsset);
    event Bought(
        uint256 indexed marketId,
        address indexed user,
        uint256 backingIn,
        uint256 tokenOut,
        uint256 feeAmount,
        uint256 priceAfter,
        uint256 floorAfter
    );
    event Sold(
        uint256 indexed marketId,
        address indexed user,
        uint256 tokenIn,
        uint256 backingOut,
        uint256 feeAmount,
        uint256 priceAfter,
        uint256 floorAfter
    );
    event RedeemedAtFloor(
        uint256 indexed marketId,
        address indexed user,
        uint256 tokenIn,
        uint256 backingOut,
        uint256 feeAmount,
        uint256 floorAfter
    );
    event FloorRaised(uint256 indexed marketId, uint256 oldFloor, uint256 newFloor, uint64 raisedAt);
    event PositionManagerUpdated(address indexed positionManager);
    event FeeRouterUpdated(address indexed feeRouter);
    event MarketFactoryUpdated(address indexed marketFactory);
    event TreasuryVaultUpdated(address indexed treasuryVault);
    event CreatorFeesClaimed(
        uint256 indexed marketId,
        address indexed creator,
        address indexed receiver,
        uint256 amountOut
    );
    event TreasuryFeesClaimed(uint256 indexed marketId, address indexed receiver, uint256 amountOut);
    event MarketPaused(uint256 indexed marketId);
    event MarketUnpaused(uint256 indexed marketId);
    event MarketDeprecated(uint256 indexed marketId);

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert RiseErrors.ZeroAddress();
    }

    modifier onlyPositionManager() {
        if (msg.sender != positionManager) revert RiseErrors.NotAuthorized();
        _;
    }

    modifier onlyMarketFactory() {
        if (msg.sender != marketFactory) revert RiseErrors.NotAuthorized();
        _;
    }

    function setMarketFactory(address marketFactory_) external override onlyOwner {
        if (marketFactory_ == address(0)) revert RiseErrors.ZeroAddress();
        marketFactory = marketFactory_;
        emit MarketFactoryUpdated(marketFactory_);
    }

    function setPositionManager(address positionManager_) external override onlyOwner {
        if (positionManager_ == address(0)) revert RiseErrors.ZeroAddress();
        positionManager = positionManager_;
        emit PositionManagerUpdated(positionManager_);
    }

    function setFeeRouter(address feeRouter_) external override onlyOwner {
        if (feeRouter_ == address(0)) revert RiseErrors.ZeroAddress();
        feeRouter = feeRouter_;
        emit FeeRouterUpdated(feeRouter_);
    }

    function setTreasuryVault(address treasuryVault_) external override onlyOwner {
        if (treasuryVault_ == address(0)) revert RiseErrors.ZeroAddress();
        treasuryVault = treasuryVault_;
        emit TreasuryVaultUpdated(treasuryVault_);
    }

    function pauseMarket(uint256 marketId) external override onlyOwner {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        market.status = RiseTypes.MarketStatus.Paused;
        emit MarketPaused(marketId);
    }

    function unpauseMarket(uint256 marketId) external override onlyOwner {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        market.status = RiseTypes.MarketStatus.Active;
        emit MarketUnpaused(marketId);
    }

    function deprecateMarket(uint256 marketId) external override onlyOwner {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        market.status = RiseTypes.MarketStatus.Deprecated;
        emit MarketDeprecated(marketId);
    }

    function buy(
        uint256 marketId,
        uint256 backingIn,
        uint256 minTokenOut,
        address receiver
    ) external override returns (uint256, uint256, uint256, uint256) {
        if (receiver == address(0)) revert RiseErrors.InvalidReceiver();
        if (backingIn == 0) revert RiseErrors.ZeroAmount();

        RiseTypes.Market storage market = _requireActiveMarket(marketId);
        IERC20 backingAsset = IERC20(market.backingAsset);
        backingAsset.safeTransferFrom(msg.sender, address(this), backingIn);

        RiseTypes.QuoteResult memory quote = _quoteBuy(market, backingIn);
        if (quote.tokenInOrOut < minTokenOut) revert RiseErrors.SlippageExceeded();
        if (quote.tokenInOrOut == 0) revert RiseErrors.SlippageExceeded();

        IRiseMarketToken(market.token).mint(receiver, quote.tokenInOrOut);

        market.reserveBalance += backingIn;
        market.totalSupply += quote.tokenInOrOut;
        market.currentPrice = quote.priceAfter;
        _accrueTradingFee(market, quote.feeAmount);
        market.netInflows += backingIn;

        (, uint256 floorAfter) = _maybeRaiseFloor(market);

        emit Bought(
            marketId,
            msg.sender,
            backingIn,
            quote.tokenInOrOut,
            quote.feeAmount,
            market.currentPrice,
            floorAfter
        );

        return (quote.tokenInOrOut, quote.feeAmount, market.currentPrice, floorAfter);
    }

    function sell(
        uint256 marketId,
        uint256 tokenIn,
        uint256 minBackingOut,
        address receiver
    ) external override returns (uint256, uint256, uint256, uint256) {
        if (receiver == address(0)) revert RiseErrors.InvalidReceiver();
        if (tokenIn == 0) revert RiseErrors.ZeroAmount();

        RiseTypes.Market storage market = _requireActiveMarket(marketId);
        _ensureSellEnabled(market);

        IRiseMarketToken(market.token).burn(msg.sender, tokenIn);
        RiseTypes.QuoteResult memory quote = _quoteSell(market, tokenIn);
        if (quote.backingInOrOut < minBackingOut) revert RiseErrors.SlippageExceeded();
        if (quote.backingInOrOut == 0 || quote.backingInOrOut > market.reserveBalance) {
            revert RiseErrors.InsufficientReserve();
        }

        market.totalSupply -= tokenIn;
        market.reserveBalance -= quote.backingInOrOut;
        market.currentPrice = quote.priceAfter;
        _accrueTradingFee(market, quote.feeAmount);
        IERC20(market.backingAsset).safeTransfer(receiver, quote.backingInOrOut);

        if (market.netInflows >= quote.backingInOrOut) {
            market.netInflows -= quote.backingInOrOut;
        } else {
            market.netInflows = 0;
        }

        (, uint256 floorAfter) = _maybeRaiseFloor(market);

        emit Sold(
            marketId,
            msg.sender,
            tokenIn,
            quote.backingInOrOut,
            quote.feeAmount,
            market.currentPrice,
            floorAfter
        );

        return (quote.backingInOrOut, quote.feeAmount, market.currentPrice, floorAfter);
    }

    function redeemAtFloor(
        uint256 marketId,
        uint256 tokenIn,
        uint256 minBackingOut,
        address receiver
    ) external override returns (uint256, uint256, uint256) {
        if (receiver == address(0)) revert RiseErrors.InvalidReceiver();
        if (tokenIn == 0) revert RiseErrors.ZeroAmount();

        RiseTypes.Market storage market = _requireExitMarket(marketId);
        IRiseMarketToken(market.token).burn(msg.sender, tokenIn);

        RiseTypes.QuoteResult memory quote = _quoteRedeem(market, tokenIn);
        if (quote.backingInOrOut < minBackingOut) revert RiseErrors.SlippageExceeded();
        if (quote.backingInOrOut == 0 || quote.backingInOrOut > market.reserveBalance) {
            revert RiseErrors.InsufficientReserve();
        }

        market.totalSupply -= tokenIn;
        market.reserveBalance -= quote.backingInOrOut;
        _accrueTradingFee(market, quote.feeAmount);
        IERC20(market.backingAsset).safeTransfer(receiver, quote.backingInOrOut);

        (, uint256 floorAfter) = _maybeRaiseFloor(market);

        emit RedeemedAtFloor(
            marketId,
            msg.sender,
            tokenIn,
            quote.backingInOrOut,
            quote.feeAmount,
            floorAfter
        );

        return (quote.backingInOrOut, quote.feeAmount, floorAfter);
    }

    function quoteBuy(
        uint256 marketId,
        uint256 backingIn
    ) external view override returns (RiseTypes.QuoteResult memory) {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        return _quoteBuy(market, backingIn);
    }

    function quoteSell(
        uint256 marketId,
        uint256 tokenIn
    ) external view override returns (RiseTypes.QuoteResult memory) {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        return _quoteSell(market, tokenIn);
    }

    function quoteRedeemAtFloor(
        uint256 marketId,
        uint256 tokenIn
    ) external view override returns (RiseTypes.QuoteResult memory) {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        return _quoteRedeem(market, tokenIn);
    }

    function maybeRaiseFloor(uint256 marketId) external override returns (bool, uint256) {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        return _maybeRaiseFloor(market);
    }

    function claimCreatorFees(
        uint256 marketId,
        address receiver
    ) external override returns (uint256 amountOut) {
        if (receiver == address(0)) revert RiseErrors.InvalidReceiver();
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        if (feeRouter == address(0)) revert RiseErrors.NotAuthorized();

        amountOut = IRiseFeeRouter(feeRouter).claimCreatorFees(marketId, msg.sender, receiver);
        if (amountOut > market.creatorFeeAccrued) revert RiseErrors.InsufficientReserve();
        market.creatorFeeAccrued -= amountOut;
        IERC20(market.backingAsset).safeTransfer(receiver, amountOut);
        emit CreatorFeesClaimed(marketId, msg.sender, receiver, amountOut);
    }

    function claimTreasuryFees(uint256 marketId) external override onlyOwner returns (uint256 amountOut) {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        if (feeRouter == address(0) || treasuryVault == address(0)) revert RiseErrors.NotAuthorized();

        amountOut = IRiseFeeRouter(feeRouter).claimTreasuryFees(marketId, treasuryVault);
        if (amountOut > market.treasuryFeeAccrued) revert RiseErrors.InsufficientReserve();
        market.treasuryFeeAccrued -= amountOut;
        IERC20(market.backingAsset).safeTransfer(treasuryVault, amountOut);
        emit TreasuryFeesClaimed(marketId, treasuryVault, amountOut);
    }

    function executeBorrow(
        uint256 marketId,
        uint256 debtAmount,
        uint256 netAmountOut,
        uint256 feeAmount,
        address receiver
    ) external override onlyPositionManager {
        if (receiver == address(0)) revert RiseErrors.InvalidReceiver();
        RiseTypes.Market storage market = _requireActiveMarket(marketId);
        uint256 unpaidAccruals = market.creatorFeeAccrued + market.treasuryFeeAccrued;
        if (market.reserveBalance < market.totalDebt + unpaidAccruals + netAmountOut) {
            revert RiseErrors.InsufficientReserve();
        }

        market.totalDebt += debtAmount;
        market.reserveBalance -= netAmountOut;
        _accrueBorrowFee(market, feeAmount);
        if (market.netInflows >= netAmountOut) {
            market.netInflows -= netAmountOut;
        } else {
            market.netInflows = 0;
        }

        IERC20(market.backingAsset).safeTransfer(receiver, netAmountOut);
        _maybeRaiseFloor(market);
    }

    function executeRepay(uint256 marketId, uint256 repayAmount) external override onlyPositionManager {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        market.totalDebt -= repayAmount;
        market.reserveBalance += repayAmount;
        market.netInflows += repayAmount;
        _maybeRaiseFloor(market);
    }

    function increaseTotalCollateral(uint256 marketId, uint256 amount) external override onlyPositionManager {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        market.totalCollateral += amount;
    }

    function decreaseTotalCollateral(uint256 marketId, uint256 amount) external override onlyPositionManager {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        market.totalCollateral -= amount;
    }

    function getMarket(uint256 marketId) external view override returns (RiseTypes.Market memory) {
        return _markets[marketId];
    }

    function getCurrentPrice(uint256 marketId) external view override returns (uint256) {
        return _markets[marketId].currentPrice;
    }

    function getCurrentFloorPrice(uint256 marketId) external view override returns (uint256) {
        return _markets[marketId].currentFloorPrice;
    }

    function getReserveBalance(uint256 marketId) external view override returns (uint256) {
        return _markets[marketId].reserveBalance;
    }

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
    ) external override onlyMarketFactory {
        RiseTypes.Market storage market = _markets[marketId];
        if (market.marketId != 0) revert RiseErrors.InvalidMarketStatus();
        market.marketId = marketId;
        market.token = token;
        market.backingAsset = backingAsset;
        market.creator = creator;
        market.createdAt = uint64(block.timestamp);
        market.startTime = startTime;
        market.status = startTime > block.timestamp
            ? RiseTypes.MarketStatus.Pending
            : RiseTypes.MarketStatus.Active;
        market.disableSell = disableSell;
        market.disableSellUntil = disableSellUntil;
        market.tokenDecimals = IRiseMarketToken(token).decimals();
        market.backingDecimals = IERC20Metadata(backingAsset).decimals();
        market.curve = curve;
        market.fees = fees;
        market.floorConfig = floorConfig;
        market.initialFloorPrice = initialFloorPrice;
        market.currentFloorPrice = initialFloorPrice;
        market.currentPrice = initialFloorPrice;

        if (feeRouter != address(0)) {
            IRiseFeeRouter(feeRouter).registerMarket(marketId, creator, fees);
        }

        emit MarketRegistered(marketId, token, backingAsset);
    }

    function _quoteBuy(
        RiseTypes.Market storage market,
        uint256 backingIn
    ) internal view returns (RiseTypes.QuoteResult memory result) {
        if (backingIn == 0) return result;
        uint256 feeAmount = RiseMath.computeTradeFee(backingIn, market.fees.tradingFeeBps);
        uint256 netBackingIn = backingIn - feeAmount;
        uint256 tokenOut = RiseMath.quoteBuyTokenOut(
            market.totalSupply,
            market.currentFloorPrice,
            market.curve,
            netBackingIn
        );

        result.backingInOrOut = backingIn;
        result.tokenInOrOut = tokenOut;
        result.feeAmount = feeAmount;
        result.priceAfter = RiseMath.computeSpotPrice(
            market.totalSupply + tokenOut,
            market.currentFloorPrice,
            market.curve
        );
        result.floorAfter = market.currentFloorPrice;
    }

    function _quoteSell(
        RiseTypes.Market storage market,
        uint256 tokenIn
    ) internal view returns (RiseTypes.QuoteResult memory result) {
        if (tokenIn == 0 || tokenIn > market.totalSupply) return result;
        uint256 grossBackingOut = RiseMath.quoteSellBackingOut(
            market.totalSupply,
            market.currentFloorPrice,
            market.curve,
            tokenIn
        );
        uint256 feeAmount = RiseMath.computeTradeFee(grossBackingOut, market.fees.tradingFeeBps);
        uint256 netBackingOut = grossBackingOut - feeAmount;

        result.backingInOrOut = netBackingOut;
        result.tokenInOrOut = tokenIn;
        result.feeAmount = feeAmount;
        result.priceAfter = RiseMath.computeSpotPrice(
            market.totalSupply - tokenIn,
            market.currentFloorPrice,
            market.curve
        );
        result.floorAfter = market.currentFloorPrice;
    }

    function _quoteRedeem(
        RiseTypes.Market storage market,
        uint256 tokenIn
    ) internal view returns (RiseTypes.QuoteResult memory result) {
        if (tokenIn == 0) return result;
        uint256 grossBackingOut = RiseMath.quoteRedeemBackingOut(
            market.currentFloorPrice,
            tokenIn
        );
        uint256 feeAmount = RiseMath.computeTradeFee(grossBackingOut, market.fees.tradingFeeBps);
        uint256 netBackingOut = grossBackingOut - feeAmount;

        result.backingInOrOut = netBackingOut;
        result.tokenInOrOut = tokenIn;
        result.feeAmount = feeAmount;
        result.priceAfter = market.currentPrice;
        result.floorAfter = market.currentFloorPrice;
    }

    function _requireActiveMarket(uint256 marketId) internal returns (RiseTypes.Market storage market) {
        market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        _syncStatus(market);
        if (market.status != RiseTypes.MarketStatus.Active) revert RiseErrors.MarketNotActive();
    }

    function _requireExitMarket(uint256 marketId) internal returns (RiseTypes.Market storage market) {
        market = _markets[marketId];
        if (market.marketId == 0) revert RiseErrors.MarketNotFound();
        _syncStatus(market);
        if (
            market.status != RiseTypes.MarketStatus.Active &&
            market.status != RiseTypes.MarketStatus.Paused
        ) revert RiseErrors.InvalidMarketStatus();
    }

    function _syncStatus(RiseTypes.Market storage market) internal {
        if (
            market.status == RiseTypes.MarketStatus.Pending &&
            market.startTime <= block.timestamp
        ) {
            market.status = RiseTypes.MarketStatus.Active;
        }
    }

    function _ensureSellEnabled(RiseTypes.Market storage market) internal view {
        if (market.disableSell && block.timestamp < market.disableSellUntil) {
            revert RiseErrors.SellDisabled();
        }
    }

    function _accrueTradingFee(RiseTypes.Market storage market, uint256 feeAmount) internal {
        _accrueFee(market, feeAmount, true);
    }

    function _accrueBorrowFee(RiseTypes.Market storage market, uint256 feeAmount) internal {
        _accrueFee(market, feeAmount, false);
    }

    function _accrueFee(RiseTypes.Market storage market, uint256 feeAmount, bool isTrading) internal {
        if (feeAmount == 0) return;
        uint256 creatorShare;
        uint256 treasuryShare;
        uint256 floorShare;

        if (feeRouter != address(0)) {
            if (isTrading) {
                (creatorShare, treasuryShare, floorShare) = IRiseFeeRouter(feeRouter).accrueTradingFee(
                    market.marketId,
                    feeAmount
                );
            } else {
                (creatorShare, treasuryShare, floorShare) = IRiseFeeRouter(feeRouter).accrueBorrowFee(
                    market.marketId,
                    feeAmount
                );
            }
        } else {
            creatorShare = (feeAmount * market.fees.creatorShareBps) / 10_000;
            treasuryShare = (feeAmount * market.fees.treasuryShareBps) / 10_000;
            floorShare = feeAmount - creatorShare - treasuryShare;
        }

        market.creatorFeeAccrued += creatorShare;
        market.treasuryFeeAccrued += treasuryShare;
        market.floorFeeAccrued += floorShare;
    }

    function _maybeRaiseFloor(
        RiseTypes.Market storage market
    ) internal returns (bool raised, uint256 newFloor) {
        if (market.totalSupply == 0) return (false, market.currentFloorPrice);

        uint256 unpaidAccruals = market.creatorFeeAccrued + market.treasuryFeeAccrued;
        uint256 maxSafeFloor = RiseMath.computeMaxSafeFloor(
            market.reserveBalance,
            market.totalSupply,
            market.totalDebt,
            unpaidAccruals
        );

        if (maxSafeFloor <= market.currentFloorPrice) {
            return (false, market.currentFloorPrice);
        }

        uint32 cooldown = RiseMath.computeCooldown(market.netInflows, market.floorConfig);
        if (block.timestamp < market.lastFloorRaiseAt + cooldown) {
            return (false, market.currentFloorPrice);
        }

        uint256 oldFloor = market.currentFloorPrice;
        market.currentFloorPrice = maxSafeFloor;
        market.floorReserveAllocated = (maxSafeFloor * market.totalSupply) / 1e18;
        market.currentPrice = RiseMath.computeSpotPrice(
            market.totalSupply,
            market.currentFloorPrice,
            market.curve
        );
        market.lastFloorRaiseAt = uint64(block.timestamp);

        emit FloorRaised(market.marketId, oldFloor, maxSafeFloor, uint64(block.timestamp));
        return (true, maxSafeFloor);
    }
}
