// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

import {SynthAgentHook} from "../src/SynthAgentHook.sol";

contract RegisterAgentPool is Script {
    using PoolIdLibrary for PoolKey;

    address internal constant XLAYER_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external returns (PoolId poolId) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envOr("POOL_MANAGER", XLAYER_POOL_MANAGER);
        SynthAgentHook hook = SynthAgentHook(vm.envAddress("SYNTH_AGENT_HOOK"));
        address token0 = vm.envAddress("TOKEN0");
        address token1 = vm.envAddress("TOKEN1");
        address treasury = vm.envOr("AGENT_TREASURY", vm.addr(deployerKey));
        bytes32 agentId = vm.envOr("AGENT_ID", bytes32(keccak256("synth-agent-demo")));
        uint64 launchDuration = uint64(vm.envOr("LAUNCH_DURATION", uint256(1 hours)));
        uint24 launchFee = uint24(vm.envOr("LAUNCH_FEE", uint256(30_000)));
        uint24 normalFee = uint24(vm.envOr("NORMAL_FEE", uint256(3_000)));

        if (token1 < token0) {
            (token0, token1) = (token1, token0);
        }

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        poolId = key.toId();

        vm.startBroadcast(deployerKey);
        IPoolManager(poolManager).initialize(key, SQRT_PRICE_1_1);
        hook.registerAgentPool(key, agentId, treasury, launchDuration, launchFee, normalFee);
        vm.stopBroadcast();

        console2.log("SynthAgentHook:", address(hook));
        console2.log("PoolManager:", poolManager);
        console2.log("Token0:", token0);
        console2.log("Token1:", token1);
        console2.log("PoolId:");
        console2.logBytes32(PoolId.unwrap(poolId));
        console2.log("Agent treasury:", treasury);
    }
}
