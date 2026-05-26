// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRiseProtocolConfig.sol";
import "./libraries/RiseErrors.sol";

contract RiseProtocolConfig is Ownable, IRiseProtocolConfig {
    uint256 public override creationFee;
    address public override treasuryVault;
    address public override timelock;
    address public override pauseGuardian;
    bool public globalPause;

    mapping(address => bool) private _backingAssetAllowed;
    mapping(uint256 => bool) private _marketPaused;

    event BackingAssetUpdated(address indexed asset, bool allowed);
    event CreationFeeUpdated(uint256 newCreationFee);
    event TreasuryVaultUpdated(address indexed treasuryVault);
    event TimelockUpdated(address indexed timelock);
    event PauseGuardianUpdated(address indexed pauseGuardian);
    event MarketPaused(uint256 indexed marketId);
    event MarketUnpaused(uint256 indexed marketId);
    event GlobalPaused();
    event GlobalUnpaused();

    modifier onlyPauseGuardian() {
        if (msg.sender != pauseGuardian && msg.sender != owner()) {
            revert RiseErrors.NotAuthorized();
        }
        _;
    }

    constructor(
        address initialOwner,
        address treasuryVault_,
        address timelock_,
        address pauseGuardian_,
        uint256 creationFee_
    ) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert RiseErrors.ZeroAddress();
        if (treasuryVault_ == address(0)) revert RiseErrors.ZeroAddress();
        if (timelock_ == address(0)) revert RiseErrors.ZeroAddress();
        if (pauseGuardian_ == address(0)) revert RiseErrors.ZeroAddress();

        treasuryVault = treasuryVault_;
        timelock = timelock_;
        pauseGuardian = pauseGuardian_;
        creationFee = creationFee_;
    }

    function isBackingAssetAllowed(address asset) external view override returns (bool) {
        return _backingAssetAllowed[asset];
    }

    function isMarketPaused(uint256 marketId) external view override returns (bool) {
        return globalPause || _marketPaused[marketId];
    }

    function setBackingAssetAllowed(address asset, bool allowed) external override onlyOwner {
        if (asset == address(0)) revert RiseErrors.ZeroAddress();
        _backingAssetAllowed[asset] = allowed;
        emit BackingAssetUpdated(asset, allowed);
    }

    function setCreationFee(uint256 newFee) external override onlyOwner {
        creationFee = newFee;
        emit CreationFeeUpdated(newFee);
    }

    function setTreasuryVault(address treasuryVault_) external onlyOwner {
        if (treasuryVault_ == address(0)) revert RiseErrors.ZeroAddress();
        treasuryVault = treasuryVault_;
        emit TreasuryVaultUpdated(treasuryVault_);
    }

    function setTimelock(address timelock_) external onlyOwner {
        if (timelock_ == address(0)) revert RiseErrors.ZeroAddress();
        timelock = timelock_;
        emit TimelockUpdated(timelock_);
    }

    function setPauseGuardian(address pauseGuardian_) external onlyOwner {
        if (pauseGuardian_ == address(0)) revert RiseErrors.ZeroAddress();
        pauseGuardian = pauseGuardian_;
        emit PauseGuardianUpdated(pauseGuardian_);
    }

    function pauseMarket(uint256 marketId) external override onlyPauseGuardian {
        _marketPaused[marketId] = true;
        emit MarketPaused(marketId);
    }

    function unpauseMarket(uint256 marketId) external override onlyOwner {
        _marketPaused[marketId] = false;
        emit MarketUnpaused(marketId);
    }

    function pauseAll() external override onlyPauseGuardian {
        globalPause = true;
        emit GlobalPaused();
    }

    function unpauseAll() external override onlyOwner {
        globalPause = false;
        emit GlobalUnpaused();
    }
}
