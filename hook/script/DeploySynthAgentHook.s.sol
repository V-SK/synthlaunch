// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

import {SynthAgentHook} from "../src/SynthAgentHook.sol";
import {SynthHookMiner} from "./SynthHookMiner.sol";

contract DeploySynthAgentHook is Script {
    address internal constant XLAYER_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    uint160 internal constant HOOK_FLAGS = Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;

    function run() external returns (SynthAgentHook hook) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envOr("POOL_MANAGER", XLAYER_POOL_MANAGER);

        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager));
        (address predictedHook, bytes32 salt) =
            SynthHookMiner.find(CREATE2_FACTORY, HOOK_FLAGS, type(SynthAgentHook).creationCode, constructorArgs);

        vm.startBroadcast(deployerKey);
        hook = new SynthAgentHook{salt: salt}(IPoolManager(poolManager));
        vm.stopBroadcast();

        require(address(hook) == predictedHook, "unexpected hook address");

        console2.log("Network chainId:", block.chainid);
        console2.log("PoolManager:", poolManager);
        console2.log("SynthAgentHook:", address(hook));
        console2.logBytes32(salt);
        console2.log("Hook permission bits:");
        console2.logUint(uint160(address(hook)) & 0x3fff);
    }
}
