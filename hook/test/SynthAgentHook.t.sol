// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {SynthAgentHook} from "../src/SynthAgentHook.sol";

contract SynthAgentHookTest is Test {
    using PoolIdLibrary for PoolKey;

    SynthAgentHook hook;
    PoolKey key;
    PoolId poolId;

    address trader = address(0xA11CE);
    address treasury = address(0xBEEF);
    bytes32 agentId = keccak256("synth-agent-1");

    function setUp() public {
        hook = new SynthAgentHook(IPoolManager(address(this)));
        key = PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        poolId = key.toId();
    }

    function testHookPermissionBitmap() public view {
        assertEq(hook.HOOK_PERMISSIONS(), Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
    }

    function testRegisterAgentPool() public {
        hook.registerAgentPool(key, agentId, treasury, 1 hours, 30_000, 3_000);

        (
            bytes32 storedAgentId,
            address creator,
            address storedTreasury,
            uint64 launchEndsAt,
            uint24 launchFee,
            uint24 normalFee,
            uint256 volume,
            uint256 swapCount,
            uint256 uniqueTraders,
            uint256 xp,
            bool initialized
        ) = hook.agentPools(poolId);

        assertEq(storedAgentId, agentId);
        assertEq(creator, address(this));
        assertEq(storedTreasury, treasury);
        assertEq(launchEndsAt, block.timestamp + 1 hours);
        assertEq(launchFee, 30_000);
        assertEq(normalFee, 3_000);
        assertEq(volume, 0);
        assertEq(swapCount, 0);
        assertEq(uniqueTraders, 0);
        assertEq(xp, 0);
        assertTrue(initialized);
    }

    function testBeforeSwapReturnsLaunchFeeOverride() public {
        hook.registerAgentPool(key, agentId, treasury, 1 hours, 30_000, 3_000);

        (,, uint24 feeOverride) = hook.beforeSwap(
            address(0xCAFE),
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 0}),
            abi.encode(trader)
        );

        assertEq(feeOverride, LPFeeLibrary.OVERRIDE_FEE_FLAG | 30_000);
    }

    function testBeforeSwapFallsBackToNormalFeeAfterLaunch() public {
        hook.registerAgentPool(key, agentId, treasury, 1 hours, 30_000, 3_000);
        vm.warp(block.timestamp + 1 hours + 1);

        (,, uint24 feeOverride) = hook.beforeSwap(
            address(0xCAFE),
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 0}),
            abi.encode(trader)
        );

        assertEq(feeOverride, LPFeeLibrary.OVERRIDE_FEE_FLAG | 3_000);
    }

    function testAfterSwapUpdatesAgentReputation() public {
        hook.registerAgentPool(key, agentId, treasury, 1 hours, 30_000, 3_000);

        hook.afterSwap(
            address(0xCAFE),
            key,
            SwapParams({zeroForOne: true, amountSpecified: -2 ether, sqrtPriceLimitX96: 0}),
            BalanceDeltaLibrary.ZERO_DELTA,
            abi.encode(trader)
        );
        hook.afterSwap(
            address(0xCAFE),
            key,
            SwapParams({zeroForOne: false, amountSpecified: 1 ether, sqrtPriceLimitX96: 0}),
            BalanceDeltaLibrary.ZERO_DELTA,
            abi.encode(trader)
        );

        (,,,,,, uint256 volume, uint256 swapCount, uint256 uniqueTraders, uint256 xp,) = hook.agentPools(poolId);

        assertEq(volume, 3 ether);
        assertEq(swapCount, 2);
        assertEq(uniqueTraders, 1);
        assertEq(xp, 23);
    }

    function testUnregisteredPoolReverts() public {
        vm.expectRevert(abi.encodeWithSelector(SynthAgentHook.AgentPoolNotRegistered.selector, poolId));
        hook.beforeSwap(
            address(0xCAFE),
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 0}),
            abi.encode(trader)
        );
    }

    function testOnlyPoolManagerCanCallHooks() public {
        hook.registerAgentPool(key, agentId, treasury, 1 hours, 30_000, 3_000);

        vm.prank(address(0xBAD));
        vm.expectRevert(SynthAgentHook.NotPoolManager.selector);
        hook.afterSwap(
            address(0xCAFE),
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 0}),
            BalanceDeltaLibrary.ZERO_DELTA,
            abi.encode(trader)
        );
    }

    function testDuplicateRegistrationReverts() public {
        hook.registerAgentPool(key, agentId, treasury, 1 hours, 30_000, 3_000);

        vm.expectRevert(abi.encodeWithSelector(SynthAgentHook.AgentPoolAlreadyRegistered.selector, poolId));
        hook.registerAgentPool(key, agentId, treasury, 1 hours, 30_000, 3_000);
    }

    function testRejectsStaticFeePool() public {
        PoolKey memory staticFeeKey = key;
        staticFeeKey.fee = 3_000;

        vm.expectRevert(SynthAgentHook.NotDynamicFeePool.selector);
        hook.registerAgentPool(staticFeeKey, agentId, treasury, 1 hours, 30_000, 3_000);
    }
}
