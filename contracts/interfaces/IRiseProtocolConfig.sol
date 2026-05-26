// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRiseProtocolConfig {
    function creationFee() external view returns (uint256);
    function treasuryVault() external view returns (address);
    function timelock() external view returns (address);
    function pauseGuardian() external view returns (address);
    function isBackingAssetAllowed(address asset) external view returns (bool);
    function isMarketPaused(uint256 marketId) external view returns (bool);

    function setBackingAssetAllowed(address asset, bool allowed) external;
    function setCreationFee(uint256 newFee) external;
    function pauseMarket(uint256 marketId) external;
    function unpauseMarket(uint256 marketId) external;
    function pauseAll() external;
    function unpauseAll() external;
}
