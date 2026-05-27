// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

library SynthHookMiner {
    uint256 internal constant MAX_LOOP = 250_000;

    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal
        view
        returns (address hookAddress, bytes32 salt)
    {
        flags = flags & Hooks.ALL_HOOK_MASK;
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);

        for (uint256 i; i < MAX_LOOP; i++) {
            hookAddress = computeAddress(deployer, bytes32(i), initCode);
            if ((uint160(hookAddress) & Hooks.ALL_HOOK_MASK) == flags && hookAddress.code.length == 0) {
                return (hookAddress, bytes32(i));
            }
        }

        revert("SynthHookMiner: salt not found");
    }

    function computeAddress(address deployer, bytes32 salt, bytes memory initCode)
        internal
        pure
        returns (address hookAddress)
    {
        hookAddress = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, keccak256(initCode)))))
        );
    }
}
