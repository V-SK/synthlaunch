// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @title SynthAgentHook
/// @notice Agent-aware Uniswap v4 hook for protected AI agent launches and pool-native reputation.
contract SynthAgentHook is IHooks {
    using LPFeeLibrary for uint24;
    using PoolIdLibrary for PoolKey;

    uint160 public constant HOOK_PERMISSIONS = Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;
    uint256 public constant BASE_XP_PER_SWAP = 10;
    uint256 public constant XP_VOLUME_UNIT = 1e18;

    IPoolManager public immutable POOL_MANAGER;

    struct AgentPool {
        bytes32 agentId;
        address creator;
        address treasury;
        uint64 launchEndsAt;
        uint24 launchFee;
        uint24 normalFee;
        uint256 volume;
        uint256 swapCount;
        uint256 uniqueTraders;
        uint256 xp;
        bool initialized;
    }

    mapping(PoolId poolId => AgentPool pool) public agentPools;
    mapping(PoolId poolId => mapping(address trader => bool seen)) public seenTrader;

    error NotPoolManager();
    error HookNotImplemented();
    error InvalidAgentId();
    error InvalidTreasury();
    error InvalidHook();
    error NotDynamicFeePool();
    error FeeTooLarge(uint24 fee);
    error AgentPoolAlreadyRegistered(PoolId poolId);
    error AgentPoolNotRegistered(PoolId poolId);

    event AgentPoolRegistered(
        PoolId indexed poolId,
        bytes32 indexed agentId,
        address indexed creator,
        address treasury,
        uint64 launchEndsAt,
        uint24 launchFee,
        uint24 normalFee
    );
    event LaunchProtected(PoolId indexed poolId, address indexed trader, uint24 fee);
    event AgentSwap(
        PoolId indexed poolId,
        bytes32 indexed agentId,
        address indexed trader,
        int256 amountSpecified,
        uint256 volume,
        uint256 swapCount
    );
    event AgentXPUpdated(PoolId indexed poolId, bytes32 indexed agentId, uint256 xp, uint256 volume, uint256 swapCount);

    constructor(IPoolManager _poolManager) {
        POOL_MANAGER = _poolManager;
    }

    modifier onlyPoolManager() {
        _onlyPoolManager();
        _;
    }

    function poolManager() external view returns (IPoolManager) {
        return POOL_MANAGER;
    }

    function getHookPermissions() external pure returns (Hooks.Permissions memory permissions) {
        permissions.beforeSwap = true;
        permissions.afterSwap = true;
    }

    function registerAgentPool(
        PoolKey calldata key,
        bytes32 agentId,
        address treasury,
        uint64 launchDuration,
        uint24 launchFee,
        uint24 normalFee
    ) external returns (PoolId poolId) {
        if (agentId == bytes32(0)) revert InvalidAgentId();
        if (treasury == address(0)) revert InvalidTreasury();
        if (address(key.hooks) != address(this)) revert InvalidHook();
        if (!key.fee.isDynamicFee()) revert NotDynamicFeePool();
        _validateFee(launchFee);
        _validateFee(normalFee);

        poolId = _poolId(key);
        AgentPool storage pool = agentPools[poolId];
        if (pool.initialized) revert AgentPoolAlreadyRegistered(poolId);

        pool.agentId = agentId;
        pool.creator = msg.sender;
        pool.treasury = treasury;
        pool.launchEndsAt = uint64(block.timestamp) + launchDuration;
        pool.launchFee = launchFee;
        pool.normalFee = normalFee;
        pool.initialized = true;

        emit AgentPoolRegistered(poolId, agentId, msg.sender, treasury, pool.launchEndsAt, launchFee, normalFee);
    }

    function currentFee(PoolId poolId) external view returns (uint24 fee, bool launchActive) {
        AgentPool storage pool = agentPools[poolId];
        if (!pool.initialized) revert AgentPoolNotRegistered(poolId);
        launchActive = block.timestamp < pool.launchEndsAt;
        fee = launchActive ? pool.launchFee : pool.normalFee;
    }

    function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata, bytes calldata hookData)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId poolId = _poolId(key);
        AgentPool storage pool = agentPools[poolId];
        if (!pool.initialized) revert AgentPoolNotRegistered(poolId);

        bool launchActive = block.timestamp < pool.launchEndsAt;
        uint24 fee = launchActive ? pool.launchFee : pool.normalFee;
        address trader = _resolveTrader(sender, hookData);

        if (launchActive) emit LaunchProtected(poolId, trader, fee);

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = _poolId(key);
        AgentPool storage pool = agentPools[poolId];
        if (!pool.initialized) revert AgentPoolNotRegistered(poolId);

        address trader = _resolveTrader(sender, hookData);
        uint256 amount = _abs(params.amountSpecified);

        pool.volume += amount;
        pool.swapCount += 1;
        if (!seenTrader[poolId][trader]) {
            seenTrader[poolId][trader] = true;
            pool.uniqueTraders += 1;
        }
        pool.xp += BASE_XP_PER_SWAP + (amount / XP_VOLUME_UNIT);

        emit AgentSwap(poolId, pool.agentId, trader, params.amountSpecified, pool.volume, pool.swapCount);
        emit AgentXPUpdated(poolId, pool.agentId, pool.xp, pool.volume, pool.swapCount);

        return (IHooks.afterSwap.selector, 0);
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function _poolId(PoolKey calldata key) internal pure returns (PoolId poolId) {
        PoolKey memory poolKey = key;
        poolId = poolKey.toId();
    }

    function _onlyPoolManager() internal view {
        if (msg.sender != address(POOL_MANAGER)) revert NotPoolManager();
    }

    function _resolveTrader(address sender, bytes calldata hookData) internal pure returns (address trader) {
        if (hookData.length == 32) return abi.decode(hookData, (address));
        return sender;
    }

    function _validateFee(uint24 fee) internal pure {
        if (!fee.isValid()) revert FeeTooLarge(fee);
    }

    function _abs(int256 value) internal pure returns (uint256) {
        if (value == type(int256).min) return uint256(type(int256).max) + 1;
        return uint256(value < 0 ? -value : value);
    }
}
