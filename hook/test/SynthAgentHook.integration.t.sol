// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";

import {SynthAgentHook} from "../src/SynthAgentHook.sol";
import {SynthHookMiner} from "../script/SynthHookMiner.sol";

contract SynthAgentHookIntegrationTest is Deployers {
    using PoolIdLibrary for PoolKey;

    SynthAgentHook hook;
    PoolId agentPoolId;
    uint160 internal constant HOOK_FLAGS = Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;

    address trader = address(0xA11CE);
    bytes32 agentId = keccak256("synth-agent-integration");

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        bytes memory constructorArgs = abi.encode(manager);
        (address predictedHook, bytes32 salt) =
            SynthHookMiner.find(address(this), HOOK_FLAGS, type(SynthAgentHook).creationCode, constructorArgs);
        hook = new SynthAgentHook{salt: salt}(manager);
        assertEq(address(hook), predictedHook);

        (key, agentPoolId) = initPoolAndAddLiquidity(
            currency0, currency1, IHooks(address(hook)), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1
        );
        hook.registerAgentPool(key, agentId, address(this), 1 hours, 30_000, 3_000);
    }

    function testRealPoolManagerSwapUpdatesAgentReputation() public {
        swap(key, true, -1 ether, abi.encode(trader));

        (bytes32 storedAgentId,,,,,, uint256 volume, uint256 swapCount, uint256 uniqueTraders, uint256 xp,) =
            hook.agentPools(agentPoolId);

        assertEq(storedAgentId, agentId);
        assertEq(volume, 1 ether);
        assertEq(swapCount, 1);
        assertEq(uniqueTraders, 1);
        assertEq(xp, 11);
    }
}
