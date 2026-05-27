// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRiseMarketToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function marketId() external view returns (uint256);
    function core() external view returns (address);
    function decimals() external view returns (uint8);
}
