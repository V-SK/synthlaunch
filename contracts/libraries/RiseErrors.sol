// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library RiseErrors {
    error NotAuthorized();
    error MarketNotFound();
    error InvalidMarketStatus();
    error MarketNotActive();
    error MarketPaused();
    error SellDisabled();
    error BackingAssetNotAllowed();
    error InvalidFeeParams();
    error InvalidCurveParams();
    error InvalidFloorConfig();
    error InvalidStartTime();
    error InvalidReceiver();
    error SlippageExceeded();
    error InsufficientReserve();
    error InsufficientFloorBacking();
    error InsufficientCollateral();
    error DebtExceedsBorrowLimit();
    error DebtOutstanding();
    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed();
    error CooldownNotMet();
    error FloorCannotDecrease();
    error FeeShareMismatch();
    error NotImplemented();
}
