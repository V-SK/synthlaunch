// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/RiseTypes.sol";

interface IRiseMarketFactory {
    function createMarket(
        RiseTypes.CreateMarketParams calldata params
    ) external payable returns (uint256 marketId, address token);

    function totalMarkets() external view returns (uint256);
    function marketExists(uint256 marketId) external view returns (bool);
    function marketToken(uint256 marketId) external view returns (address);
    function marketCreator(uint256 marketId) external view returns (address);
    function getMarketIdsByCreator(address creator) external view returns (uint256[] memory);
}
