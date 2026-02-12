// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgentLogic
 * @notice BAP-578 compliant logic contract for AI Agent operations
 * @author SynthLaunch (synthlaunch.fun)
 * @dev Implements standardized action execution for Non-Fungible Agents
 * 
 * This contract serves as a shared operation handler that agents can use
 * to execute on-chain actions like swaps, transfers, and strategy operations.
 * 
 * Security:
 *  - Only authorized callers (NFA contract or agent wallets) can execute
 *  - Reentrancy protection on all state-changing functions
 *  - No storage of private keys or sensitive data
 */
contract AgentLogic is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    /// @notice Action type: Transfer BNB
    uint8 public constant ACTION_TRANSFER_BNB = 1;
    
    /// @notice Action type: Transfer ERC20 token
    uint8 public constant ACTION_TRANSFER_TOKEN = 2;
    
    /// @notice Action type: Approve ERC20 spending
    uint8 public constant ACTION_APPROVE = 3;
    
    /// @notice Action type: Execute swap via DEX router
    uint8 public constant ACTION_SWAP = 4;
    
    /// @notice Action type: Custom call (advanced)
    uint8 public constant ACTION_CUSTOM_CALL = 5;

    // ============ State ============
    
    /// @notice NFA contract address (authorized caller)
    address public nfaContract;
    
    /// @notice Mapping of agent ID to authorized wallet
    mapping(uint256 => address) public agentWallets;
    
    /// @notice Approved DEX routers for swap operations
    mapping(address => bool) public approvedRouters;
    
    /// @notice Approved target contracts for custom calls
    mapping(address => bool) public approvedTargets;
    
    /// @notice Total actions executed (for tracking)
    uint256 public totalActionsExecuted;
    
    /// @notice Actions executed per agent
    mapping(uint256 => uint256) public agentActionCount;

    // ============ Events ============
    
    event ActionExecuted(
        uint256 indexed agentId,
        uint8 actionType,
        address indexed target,
        uint256 value,
        bool success
    );
    
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);
    event RouterApproved(address indexed router);
    event RouterRevoked(address indexed router);
    event TargetApproved(address indexed target);
    event TargetRevoked(address indexed target);
    event NFAContractUpdated(address indexed oldNFA, address indexed newNFA);

    // ============ Errors ============
    
    error Unauthorized();
    error InvalidAction();
    error InvalidTarget();
    error RouterNotApproved();
    error TargetNotApproved();
    error TransferFailed();
    error ZeroAddress();
    error InsufficientBalance();

    // ============ Constructor ============
    
    /**
     * @notice Deploy the AgentLogic contract
     * @param _nfaContract Address of the NFA contract (can be address(0) initially)
     */
    constructor(address _nfaContract) Ownable(msg.sender) {
        nfaContract = _nfaContract;
    }

    // ============ Modifiers ============
    
    /**
     * @notice Only NFA contract or agent wallet can call
     * @param agentId The agent ID being operated on
     */
    modifier onlyAuthorized(uint256 agentId) {
        if (msg.sender != nfaContract && msg.sender != agentWallets[agentId] && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Set the NFA contract address
     * @param _nfaContract New NFA contract address
     */
    function setNFAContract(address _nfaContract) external onlyOwner {
        address old = nfaContract;
        nfaContract = _nfaContract;
        emit NFAContractUpdated(old, _nfaContract);
    }
    
    /**
     * @notice Set wallet for an agent
     * @param agentId Agent token ID
     * @param wallet Authorized wallet address
     */
    function setAgentWallet(uint256 agentId, address wallet) external onlyOwner {
        agentWallets[agentId] = wallet;
        emit AgentWalletSet(agentId, wallet);
    }
    
    /**
     * @notice Approve a DEX router for swap operations
     * @param router Router address to approve
     */
    function approveRouter(address router) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        approvedRouters[router] = true;
        emit RouterApproved(router);
    }
    
    /**
     * @notice Revoke a DEX router
     * @param router Router address to revoke
     */
    function revokeRouter(address router) external onlyOwner {
        approvedRouters[router] = false;
        emit RouterRevoked(router);
    }
    
    /**
     * @notice Approve a target contract for custom calls
     * @param target Target address to approve
     */
    function approveTarget(address target) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        approvedTargets[target] = true;
        emit TargetApproved(target);
    }
    
    /**
     * @notice Revoke a target contract
     * @param target Target address to revoke
     */
    function revokeTarget(address target) external onlyOwner {
        approvedTargets[target] = false;
        emit TargetRevoked(target);
    }

    // ============ Core Action Execution ============
    
    /**
     * @notice Execute an action for an agent (BAP-578 standard entry point)
     * @param agentId The agent token ID
     * @param data Encoded action data (actionType + params)
     * @return success Whether the action succeeded
     * @return result Return data from the action
     */
    function executeAction(
        uint256 agentId,
        bytes calldata data
    ) external onlyAuthorized(agentId) nonReentrant returns (bool success, bytes memory result) {
        if (data.length < 1) revert InvalidAction();
        
        uint8 actionType = uint8(data[0]);
        bytes calldata params = data[1:];
        
        if (actionType == ACTION_TRANSFER_BNB) {
            (success, result) = _executeTransferBNB(agentId, params);
        } else if (actionType == ACTION_TRANSFER_TOKEN) {
            (success, result) = _executeTransferToken(agentId, params);
        } else if (actionType == ACTION_APPROVE) {
            (success, result) = _executeApprove(agentId, params);
        } else if (actionType == ACTION_SWAP) {
            (success, result) = _executeSwap(agentId, params);
        } else if (actionType == ACTION_CUSTOM_CALL) {
            (success, result) = _executeCustomCall(agentId, params);
        } else {
            revert InvalidAction();
        }
        
        totalActionsExecuted++;
        agentActionCount[agentId]++;
        
        emit ActionExecuted(agentId, actionType, address(0), 0, success);
        
        return (success, result);
    }

    // ============ Internal Action Handlers ============
    
    /**
     * @notice Execute BNB transfer
     * @param params Encoded (to, amount)
     */
    function _executeTransferBNB(
        uint256 /* agentId */,
        bytes calldata params
    ) internal returns (bool, bytes memory) {
        (address to, uint256 amount) = abi.decode(params, (address, uint256));
        
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) revert InsufficientBalance();
        
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        return (true, "");
    }
    
    /**
     * @notice Execute ERC20 token transfer
     * @param params Encoded (token, to, amount)
     */
    function _executeTransferToken(
        uint256 /* agentId */,
        bytes calldata params
    ) internal returns (bool, bytes memory) {
        (address token, address to, uint256 amount) = abi.decode(params, (address, address, uint256));
        
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        
        IERC20(token).safeTransfer(to, amount);
        
        return (true, "");
    }
    
    /**
     * @notice Execute ERC20 approval
     * @param params Encoded (token, spender, amount)
     */
    function _executeApprove(
        uint256 /* agentId */,
        bytes calldata params
    ) internal returns (bool, bytes memory) {
        (address token, address spender, uint256 amount) = abi.decode(params, (address, address, uint256));
        
        if (token == address(0) || spender == address(0)) revert ZeroAddress();
        
        IERC20(token).forceApprove(spender, amount);
        
        return (true, "");
    }
    
    /**
     * @notice Execute swap via approved DEX router
     * @param params Encoded (router, callData)
     */
    function _executeSwap(
        uint256 /* agentId */,
        bytes calldata params
    ) internal returns (bool, bytes memory) {
        (address router, bytes memory callData) = abi.decode(params, (address, bytes));
        
        if (!approvedRouters[router]) revert RouterNotApproved();
        
        (bool success, bytes memory result) = router.call(callData);
        
        return (success, result);
    }
    
    /**
     * @notice Execute custom call to approved target
     * @param params Encoded (target, value, callData)
     */
    function _executeCustomCall(
        uint256 /* agentId */,
        bytes calldata params
    ) internal returns (bool, bytes memory) {
        (address target, uint256 value, bytes memory callData) = abi.decode(params, (address, uint256, bytes));
        
        if (!approvedTargets[target]) revert TargetNotApproved();
        if (address(this).balance < value) revert InsufficientBalance();
        
        (bool success, bytes memory result) = target.call{value: value}(callData);
        
        return (success, result);
    }

    // ============ View Functions ============
    
    /**
     * @notice Get agent statistics
     * @param agentId Agent token ID
     * @return wallet Authorized wallet
     * @return actionCount Total actions executed
     */
    function getAgentStats(uint256 agentId) external view returns (
        address wallet,
        uint256 actionCount
    ) {
        return (agentWallets[agentId], agentActionCount[agentId]);
    }
    
    /**
     * @notice Check if an address is authorized for an agent
     * @param agentId Agent token ID
     * @param caller Address to check
     */
    function isAuthorized(uint256 agentId, address caller) external view returns (bool) {
        return caller == nfaContract || caller == agentWallets[agentId] || caller == owner();
    }

    // ============ Receive ============
    
    /**
     * @notice Receive BNB for agent operations
     */
    receive() external payable {}
}
