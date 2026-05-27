// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RiseMarketToken.sol";
import "./interfaces/IRiseMarketFactory.sol";
import "./interfaces/IRiseMarketCore.sol";
import "./interfaces/IRiseProtocolConfig.sol";
import "./libraries/RiseErrors.sol";
import "./libraries/RiseTypes.sol";

contract RiseMarketFactory is Ownable, IRiseMarketFactory {
    IRiseProtocolConfig public immutable config;
    address public marketCore;
    uint256 private _nextMarketId = 1;

    mapping(uint256 => bool) private _marketExists;
    mapping(uint256 => address) private _marketToken;
    mapping(uint256 => address) private _marketCreator;
    mapping(address => uint256[]) private _marketIdsByCreator;

    event MarketCoreUpdated(address indexed marketCore);
    event MarketCreated(
        uint256 indexed marketId,
        address indexed token,
        address indexed creator,
        address backingAsset,
        uint256 initialFloorPrice,
        uint64 startTime
    );

    constructor(
        address initialOwner,
        address config_,
        address marketCore_
    ) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert RiseErrors.ZeroAddress();
        if (config_ == address(0)) revert RiseErrors.ZeroAddress();
        if (marketCore_ == address(0)) revert RiseErrors.ZeroAddress();
        config = IRiseProtocolConfig(config_);
        marketCore = marketCore_;
    }

    function createMarket(
        RiseTypes.CreateMarketParams calldata params
    ) external payable override returns (uint256 marketId, address token) {
        _validateCreateParams(params);

        uint256 requiredFee = config.creationFee();
        if (msg.value < requiredFee) revert RiseErrors.InsufficientReserve();

        marketId = _nextMarketId++;
        token = address(
            new RiseMarketToken(
                params.name,
                params.symbol,
                18,
                marketId,
                marketCore
            )
        );

        _marketExists[marketId] = true;
        _marketToken[marketId] = token;
        _marketCreator[marketId] = params.creator;
        _marketIdsByCreator[params.creator].push(marketId);

        IRiseMarketCore(marketCore).registerMarket(
            marketId,
            token,
            params.backingAsset,
            params.creator,
            params.startTime,
            params.disableSellAtLaunch,
            params.disableSellUntil,
            params.curve,
            params.fees,
            params.floorConfig,
            params.initialFloorPrice
        );

        emit MarketCreated(
            marketId,
            token,
            params.creator,
            params.backingAsset,
            params.initialFloorPrice,
            params.startTime
        );

        if (msg.value > requiredFee) {
            (bool ok, ) = msg.sender.call{value: msg.value - requiredFee}("");
            if (!ok) revert RiseErrors.TransferFailed();
        }

        if (requiredFee > 0) {
            (bool ok, ) = config.treasuryVault().call{value: requiredFee}("");
            if (!ok) revert RiseErrors.TransferFailed();
        }
    }

    function totalMarkets() external view override returns (uint256) {
        return _nextMarketId - 1;
    }

    function marketExists(uint256 marketId) external view override returns (bool) {
        return _marketExists[marketId];
    }

    function marketToken(uint256 marketId) external view override returns (address) {
        return _marketToken[marketId];
    }

    function marketCreator(uint256 marketId) external view override returns (address) {
        return _marketCreator[marketId];
    }

    function getMarketIdsByCreator(address creator) external view override returns (uint256[] memory) {
        return _marketIdsByCreator[creator];
    }

    function setMarketCore(address marketCore_) external onlyOwner {
        if (marketCore_ == address(0)) revert RiseErrors.ZeroAddress();
        marketCore = marketCore_;
        emit MarketCoreUpdated(marketCore_);
    }

    function _validateCreateParams(RiseTypes.CreateMarketParams calldata params) internal view {
        if (params.creator == address(0)) revert RiseErrors.ZeroAddress();
        if (params.backingAsset == address(0)) revert RiseErrors.ZeroAddress();
        if (bytes(params.name).length == 0 || bytes(params.symbol).length == 0) {
            revert RiseErrors.InvalidCurveParams();
        }
        if (!config.isBackingAssetAllowed(params.backingAsset)) {
            revert RiseErrors.BackingAssetNotAllowed();
        }
        if (params.initialFloorPrice == 0) revert RiseErrors.InvalidFloorConfig();
        if (params.startTime < block.timestamp) revert RiseErrors.InvalidStartTime();
        if (
            params.fees.creatorShareBps +
                params.fees.treasuryShareBps +
                params.fees.floorShareBps !=
            10_000
        ) {
            revert RiseErrors.FeeShareMismatch();
        }
        if (params.curve.m1 < params.curve.m2) revert RiseErrors.InvalidCurveParams();
        if (params.disableSellAtLaunch && params.disableSellUntil <= params.startTime) {
            revert RiseErrors.InvalidStartTime();
        }
    }
}
