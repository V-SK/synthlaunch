// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RiseErrors.sol";
import "./RiseTypes.sol";

library RiseMath {
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    function computeTradeFee(uint256 amount, uint16 feeBps) internal pure returns (uint256) {
        return (amount * feeBps) / BPS_DENOMINATOR;
    }

    function computeSpotPrice(
        uint256 supply,
        uint256 floorPrice,
        RiseTypes.CurveParams memory curve
    ) internal pure returns (uint256) {
        if (supply <= curve.x2) {
            return floorPrice + ((curve.m1 * supply) / 1e18);
        }

        int256 price = int256(floorPrice) +
            int256((curve.m2 * supply) / 1e18) +
            curve.b2;
        if (price < int256(floorPrice)) revert RiseErrors.InvalidCurveParams();
        return uint256(price);
    }

    function quoteBuyTokenOut(
        uint256 supply,
        uint256 floorPrice,
        RiseTypes.CurveParams memory curve,
        uint256 netBackingIn
    ) internal pure returns (uint256 tokenOut) {
        if (netBackingIn == 0) return 0;
        if (floorPrice == 0) revert RiseErrors.InvalidFloorConfig();

        uint256 low = 0;
        uint256 high = ((netBackingIn * 1e18) / floorPrice) + 1e18;

        if (_buyCost(supply, floorPrice, curve, high) < netBackingIn) {
            high *= 2;
        }

        for (uint256 i = 0; i < 80; i++) {
            uint256 mid = (low + high + 1) / 2;
            uint256 cost = _buyCost(supply, floorPrice, curve, mid);
            if (cost <= netBackingIn) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        return low;
    }

    function quoteSellBackingOut(
        uint256 supply,
        uint256 floorPrice,
        RiseTypes.CurveParams memory curve,
        uint256 tokenIn
    ) internal pure returns (uint256) {
        if (tokenIn == 0 || tokenIn > supply) return 0;
        uint256 newSupply = supply - tokenIn;
        return _curveIntegral(newSupply, supply, floorPrice, curve);
    }

    function quoteRedeemBackingOut(
        uint256 floorPrice,
        uint256 tokenIn
    ) internal pure returns (uint256) {
        return (tokenIn * floorPrice) / 1e18;
    }

    function computeMaxSafeFloor(
        uint256 reserveBalance,
        uint256 totalSupply,
        uint256 totalDebt,
        uint256 unpaidAccruals
    ) internal pure returns (uint256) {
        if (totalSupply == 0) return 0;
        if (reserveBalance <= totalDebt + unpaidAccruals) return 0;
        return ((reserveBalance - totalDebt - unpaidAccruals) * 1e18) / totalSupply;
    }

    function computeCooldown(
        uint256 netInflows,
        RiseTypes.FloorConfig memory config
    ) internal pure returns (uint32) {
        if (netInflows < config.threshold1) return config.cooldown0;
        if (netInflows < config.threshold2) return config.cooldown1;
        if (netInflows < config.threshold3) return config.cooldown2;
        if (netInflows < config.threshold4) return config.cooldown3;
        return config.cooldown4;
    }

    function _buyCost(
        uint256 supply,
        uint256 floorPrice,
        RiseTypes.CurveParams memory curve,
        uint256 tokenOut
    ) private pure returns (uint256) {
        return _curveIntegral(supply, supply + tokenOut, floorPrice, curve);
    }

    function _curveIntegral(
        uint256 fromSupply,
        uint256 toSupply,
        uint256 floorPrice,
        RiseTypes.CurveParams memory curve
    ) private pure returns (uint256) {
        if (toSupply <= fromSupply) return 0;

        if (toSupply <= curve.x2) {
            return _linearIntegral(fromSupply, toSupply, floorPrice, curve.m1);
        }

        if (fromSupply >= curve.x2) {
            return _postShoulderIntegral(fromSupply, toSupply, floorPrice, curve);
        }

        return
            _linearIntegral(fromSupply, curve.x2, floorPrice, curve.m1) +
            _postShoulderIntegral(curve.x2, toSupply, floorPrice, curve);
    }

    function _linearIntegral(
        uint256 fromSupply,
        uint256 toSupply,
        uint256 floorPrice,
        uint256 slope
    ) private pure returns (uint256) {
        uint256 delta = toSupply - fromSupply;
        uint256 floorPart = (floorPrice * delta) / 1e18;
        uint256 squareDelta = ((toSupply * toSupply) - (fromSupply * fromSupply)) / 1e18;
        uint256 slopePart = (slope * squareDelta) / (2 * 1e18);
        return floorPart + slopePart;
    }

    function _postShoulderIntegral(
        uint256 fromSupply,
        uint256 toSupply,
        uint256 floorPrice,
        RiseTypes.CurveParams memory curve
    ) private pure returns (uint256) {
        uint256 delta = toSupply - fromSupply;
        uint256 floorPart = (floorPrice * delta) / 1e18;
        uint256 squareDelta = ((toSupply * toSupply) - (fromSupply * fromSupply)) / 1e18;
        uint256 slopePart = (curve.m2 * squareDelta) / (2 * 1e18);
        int256 interceptPart = (curve.b2 * int256(delta)) / int256(1e18);
        int256 total = int256(floorPart + slopePart) + interceptPart;
        if (total < 0) revert RiseErrors.InvalidCurveParams();
        return uint256(total);
    }
}
