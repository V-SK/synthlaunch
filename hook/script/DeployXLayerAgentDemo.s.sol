// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {DemoERC20} from "../src/DemoERC20.sol";
import {SynthAgentHook} from "../src/SynthAgentHook.sol";
import {SynthHookMiner} from "./SynthHookMiner.sol";

contract DeployXLayerAgentDemo is Script {
    using PoolIdLibrary for PoolKey;

    address internal constant XLAYER_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    uint160 internal constant HOOK_FLAGS = Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    int24 internal constant TICK_SPACING = 60;
    uint256 internal constant INITIAL_SUPPLY = 1_000_000 ether;

    function run() external returns (SynthAgentHook hook, PoolId poolId) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address poolManager = vm.envOr("POOL_MANAGER", XLAYER_POOL_MANAGER);

        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager));
        (address predictedHook, bytes32 salt) =
            SynthHookMiner.find(CREATE2_FACTORY, HOOK_FLAGS, type(SynthAgentHook).creationCode, constructorArgs);

        vm.startBroadcast(deployerKey);

        hook = new SynthAgentHook{salt: salt}(IPoolManager(poolManager));
        require(address(hook) == predictedHook, "unexpected hook address");

        DemoERC20 agentToken = new DemoERC20("SynthAgent Demo", "SAGENT", INITIAL_SUPPLY, deployer);
        DemoERC20 quoteToken = new DemoERC20("Agent USD Demo", "aUSD", INITIAL_SUPPLY, deployer);

        (address token0, address token1) = address(agentToken) < address(quoteToken)
            ? (address(agentToken), address(quoteToken))
            : (address(quoteToken), address(agentToken));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });
        poolId = key.toId();

        IPoolManager(poolManager).initialize(key, SQRT_PRICE_1_1);
        hook.registerAgentPool(
            key,
            keccak256("synth-agent-demo"),
            deployer,
            uint64(vm.envOr("LAUNCH_DURATION", uint256(4 hours))),
            uint24(vm.envOr("LAUNCH_FEE", uint256(30_000))),
            uint24(vm.envOr("NORMAL_FEE", uint256(3_000)))
        );

        PoolModifyLiquidityTest modifyRouter = new PoolModifyLiquidityTest(IPoolManager(poolManager));
        PoolSwapTest swapRouter = new PoolSwapTest(IPoolManager(poolManager));

        IERC20(token0).approve(address(modifyRouter), type(uint256).max);
        IERC20(token1).approve(address(modifyRouter), type(uint256).max);
        IERC20(token0).approve(address(swapRouter), type(uint256).max);
        IERC20(token1).approve(address(swapRouter), type(uint256).max);

        modifyRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -120, tickUpper: 120, liquidityDelta: 10 ether, salt: bytes32(0)}),
            abi.encode(deployer)
        );

        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -0.01 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(deployer)
        );

        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: false, amountSpecified: -0.005 ether, sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(deployer)
        );

        vm.stopBroadcast();

        console2.log("Network chainId:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("PoolManager:", poolManager);
        console2.log("SynthAgentHook:", address(hook));
        console2.log("SAGENT:", address(agentToken));
        console2.log("aUSD:", address(quoteToken));
        console2.log("Token0:", token0);
        console2.log("Token1:", token1);
        console2.log("ModifyRouter:", address(modifyRouter));
        console2.log("SwapRouter:", address(swapRouter));
        console2.log("PoolId:");
        console2.logBytes32(PoolId.unwrap(poolId));
        console2.log("Hook permission bits:");
        console2.logUint(uint160(address(hook)) & 0x3fff);
    }
}
