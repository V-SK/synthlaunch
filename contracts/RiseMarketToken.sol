// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IRiseMarketToken.sol";
import "./libraries/RiseErrors.sol";

contract RiseMarketToken is ERC20, IRiseMarketToken {
    uint256 public immutable override marketId;
    address public immutable override core;
    uint8 private immutable _customDecimals;

    modifier onlyCore() {
        if (msg.sender != core) revert RiseErrors.NotAuthorized();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 marketId_,
        address core_
    ) ERC20(name_, symbol_) {
        if (core_ == address(0)) revert RiseErrors.ZeroAddress();
        marketId = marketId_;
        core = core_;
        _customDecimals = decimals_;
    }

    function decimals() public view override(ERC20, IRiseMarketToken) returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external override onlyCore {
        if (to == address(0)) revert RiseErrors.ZeroAddress();
        if (amount == 0) revert RiseErrors.ZeroAmount();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external override onlyCore {
        if (from == address(0)) revert RiseErrors.ZeroAddress();
        if (amount == 0) revert RiseErrors.ZeroAmount();
        _burn(from, amount);
    }
}
