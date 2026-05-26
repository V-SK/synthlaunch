// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library RiseTypes {
    enum MarketStatus {
        Pending,
        Active,
        Paused,
        Deprecated
    }

    struct CurveParams {
        uint256 x2;
        uint256 m1;
        uint256 m2;
        int256 b2;
    }

    struct FeeParams {
        uint16 tradingFeeBps;
        uint16 borrowOriginationFeeBps;
        uint16 creatorShareBps;
        uint16 treasuryShareBps;
        uint16 floorShareBps;
    }

    struct FloorConfig {
        uint256 initialFloorPrice;
        uint256 threshold1;
        uint256 threshold2;
        uint256 threshold3;
        uint256 threshold4;
        uint32 cooldown0;
        uint32 cooldown1;
        uint32 cooldown2;
        uint32 cooldown3;
        uint32 cooldown4;
    }

    struct Market {
        uint256 marketId;
        address token;
        address backingAsset;
        address creator;
        uint64 createdAt;
        uint64 startTime;
        MarketStatus status;
        bool disableSell;
        uint64 disableSellUntil;
        uint8 tokenDecimals;
        uint8 backingDecimals;
        CurveParams curve;
        FeeParams fees;
        FloorConfig floorConfig;
        uint256 initialFloorPrice;
        uint256 currentFloorPrice;
        uint256 currentPrice;
        uint256 totalSupply;
        uint256 reserveBalance;
        uint256 floorReserveAllocated;
        uint256 creatorFeeAccrued;
        uint256 treasuryFeeAccrued;
        uint256 floorFeeAccrued;
        uint256 totalDebt;
        uint256 totalCollateral;
        uint256 netInflows;
        uint64 lastFloorRaiseAt;
    }

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct CreateMarketParams {
        string name;
        string symbol;
        string description;
        string metadataURI;
        string logoURI;
        string[4] socialLinks;
        address backingAsset;
        address creator;
        CurveParams curve;
        FeeParams fees;
        FloorConfig floorConfig;
        uint256 initialFloorPrice;
        uint64 startTime;
        bool disableSellAtLaunch;
        uint64 disableSellUntil;
    }

    struct QuoteResult {
        uint256 backingInOrOut;
        uint256 tokenInOrOut;
        uint256 feeAmount;
        uint256 priceAfter;
        uint256 floorAfter;
    }
}
