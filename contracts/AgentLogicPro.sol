// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title AgentLogicPro
 * @notice BAP-578 compliant advanced logic contract with Learning, Memory, and Multi-Agent features
 * @author SynthLaunch (synthlaunch.fun)
 * @dev Full implementation of BAP-578 NFA standard with:
 *  - Learning Module: Merkle tree-based verifiable learning system
 *  - Memory Module: On-chain key-value storage for agent memory
 *  - Multi-Agent: Cross-agent delegation and collaboration
 *  - OpenClaw Integration: AI-powered autonomous execution
 */
contract AgentLogicPro is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    // Action Types (Basic)
    uint8 public constant ACTION_TRANSFER_BNB = 1;
    uint8 public constant ACTION_TRANSFER_TOKEN = 2;
    uint8 public constant ACTION_APPROVE = 3;
    uint8 public constant ACTION_SWAP = 4;
    uint8 public constant ACTION_CUSTOM_CALL = 5;
    
    // Action Types (Pro)
    uint8 public constant ACTION_SET_MEMORY = 10;
    uint8 public constant ACTION_DELEGATE = 11;
    uint8 public constant ACTION_BATCH = 12;

    // ============ Structs ============
    
    /// @notice Learning state for an agent
    struct LearningState {
        bytes32 merkleRoot;      // Root hash of learning tree
        uint256 version;         // Learning version (increments on update)
        uint256 lastUpdate;      // Timestamp of last update
        uint256 totalLearnings;  // Total learning events
    }
    
    /// @notice Delegation permission
    struct Delegation {
        bool active;
        uint256 expiry;          // 0 = no expiry
        uint8[] allowedActions;  // Empty = all actions allowed
    }

    // ============ State ============
    
    /// @notice NFA contract address
    address public nfaContract;
    
    /// @notice OpenClaw operator address (AI backend)
    address public openclawOperator;
    
    /// @notice Agent wallets
    mapping(uint256 => address) public agentWallets;
    
    /// @notice Approved DEX routers
    mapping(address => bool) public approvedRouters;
    
    /// @notice Approved target contracts
    mapping(address => bool) public approvedTargets;
    
    /// @notice Total actions executed
    uint256 public totalActionsExecuted;
    
    /// @notice Actions per agent
    mapping(uint256 => uint256) public agentActionCount;
    
    // --- Learning Module ---
    
    /// @notice Learning state per agent
    mapping(uint256 => LearningState) public learningStates;
    
    // --- Memory Module ---
    
    /// @notice Agent memory storage (agentId => key => value)
    mapping(uint256 => mapping(bytes32 => bytes)) public agentMemory;
    
    /// @notice Memory keys per agent (for enumeration)
    mapping(uint256 => bytes32[]) public agentMemoryKeys;
    
    /// @notice Memory key exists check
    mapping(uint256 => mapping(bytes32 => bool)) public memoryKeyExists;
    
    // --- Multi-Agent Module ---
    
    /// @notice Delegations (fromAgent => toAgent => delegation)
    mapping(uint256 => mapping(uint256 => Delegation)) public delegations;

    // ============ Events ============
    
    // Basic events
    event ActionExecuted(uint256 indexed agentId, uint8 actionType, bool success);
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);
    event RouterApproved(address indexed router);
    event RouterRevoked(address indexed router);
    event TargetApproved(address indexed target);
    event TargetRevoked(address indexed target);
    
    // Learning events
    event LearningUpdated(
        uint256 indexed agentId,
        bytes32 oldRoot,
        bytes32 newRoot,
        uint256 version
    );
    event LearningVerified(uint256 indexed agentId, bytes32 leaf, bool valid);
    
    // Memory events
    event MemorySet(uint256 indexed agentId, bytes32 indexed key, uint256 valueLength);
    event MemoryDeleted(uint256 indexed agentId, bytes32 indexed key);
    
    // Multi-Agent events
    event DelegationCreated(uint256 indexed fromAgent, uint256 indexed toAgent, uint256 expiry);
    event DelegationRevoked(uint256 indexed fromAgent, uint256 indexed toAgent);
    event DelegatedActionExecuted(uint256 indexed fromAgent, uint256 indexed toAgent, uint8 actionType);
    
    // OpenClaw events
    event OpenClawOperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event AIDecisionExecuted(uint256 indexed agentId, bytes32 indexed decisionHash, bool success);

    // ============ Errors ============
    
    error Unauthorized();
    error InvalidAction();
    error RouterNotApproved();
    error TargetNotApproved();
    error TransferFailed();
    error ZeroAddress();
    error InsufficientBalance();
    error InvalidProof();
    error DelegationExpired();
    error DelegationNotFound();
    error ActionNotAllowed();
    error MemoryKeyNotFound();

    // ============ Constructor ============
    
    constructor(address _nfaContract, address _openclawOperator) Ownable(msg.sender) {
        nfaContract = _nfaContract;
        openclawOperator = _openclawOperator;
    }

    // ============ Modifiers ============
    
    modifier onlyAuthorized(uint256 agentId) {
        if (
            msg.sender != nfaContract && 
            msg.sender != agentWallets[agentId] && 
            msg.sender != openclawOperator &&
            msg.sender != owner()
        ) {
            revert Unauthorized();
        }
        _;
    }
    
    modifier onlyOpenClaw() {
        if (msg.sender != openclawOperator && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    // ============ Admin Functions ============
    
    function setNFAContract(address _nfaContract) external onlyOwner {
        nfaContract = _nfaContract;
    }
    
    function setOpenClawOperator(address _operator) external onlyOwner {
        address old = openclawOperator;
        openclawOperator = _operator;
        emit OpenClawOperatorUpdated(old, _operator);
    }
    
    function setAgentWallet(uint256 agentId, address wallet) external onlyOwner {
        agentWallets[agentId] = wallet;
        emit AgentWalletSet(agentId, wallet);
    }
    
    function approveRouter(address router) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        approvedRouters[router] = true;
        emit RouterApproved(router);
    }
    
    function revokeRouter(address router) external onlyOwner {
        approvedRouters[router] = false;
        emit RouterRevoked(router);
    }
    
    function approveTarget(address target) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        approvedTargets[target] = true;
        emit TargetApproved(target);
    }
    
    function revokeTarget(address target) external onlyOwner {
        approvedTargets[target] = false;
        emit TargetRevoked(target);
    }

    // ============ Core Action Execution ============
    
    /**
     * @notice Execute an action for an agent (BAP-578 entry point)
     */
    function executeAction(
        uint256 agentId,
        bytes calldata data
    ) external onlyAuthorized(agentId) nonReentrant returns (bool success, bytes memory result) {
        return _executeAction(agentId, data);
    }
    
    /**
     * @notice Execute action via OpenClaw AI decision
     */
    function executeAIDecision(
        uint256 agentId,
        bytes calldata action,
        bytes32 decisionHash
    ) external onlyOpenClaw nonReentrant returns (bool success, bytes memory result) {
        (success, result) = _executeAction(agentId, action);
        emit AIDecisionExecuted(agentId, decisionHash, success);
    }
    
    /**
     * @notice Internal action execution
     */
    function _executeAction(
        uint256 agentId,
        bytes calldata data
    ) internal returns (bool success, bytes memory result) {
        if (data.length < 1) revert InvalidAction();
        
        uint8 actionType = uint8(data[0]);
        bytes calldata params = data[1:];
        
        if (actionType == ACTION_TRANSFER_BNB) {
            (success, result) = _executeTransferBNB(params);
        } else if (actionType == ACTION_TRANSFER_TOKEN) {
            (success, result) = _executeTransferToken(params);
        } else if (actionType == ACTION_APPROVE) {
            (success, result) = _executeApprove(params);
        } else if (actionType == ACTION_SWAP) {
            (success, result) = _executeSwap(params);
        } else if (actionType == ACTION_CUSTOM_CALL) {
            (success, result) = _executeCustomCall(params);
        } else if (actionType == ACTION_SET_MEMORY) {
            _setMemoryInternal(agentId, params);
            success = true;
        } else if (actionType == ACTION_DELEGATE) {
            _createDelegationInternal(agentId, params);
            success = true;
        } else if (actionType == ACTION_BATCH) {
            (success, result) = _executeBatch(agentId, params);
        } else {
            revert InvalidAction();
        }
        
        totalActionsExecuted++;
        agentActionCount[agentId]++;
        
        emit ActionExecuted(agentId, actionType, success);
    }

    // ============ Basic Action Handlers ============
    
    function _executeTransferBNB(bytes calldata params) internal returns (bool, bytes memory) {
        (address to, uint256 amount) = abi.decode(params, (address, uint256));
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
        return (true, "");
    }
    
    function _executeTransferToken(bytes calldata params) internal returns (bool, bytes memory) {
        (address token, address to, uint256 amount) = abi.decode(params, (address, address, uint256));
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        return (true, "");
    }
    
    function _executeApprove(bytes calldata params) internal returns (bool, bytes memory) {
        (address token, address spender, uint256 amount) = abi.decode(params, (address, address, uint256));
        if (token == address(0) || spender == address(0)) revert ZeroAddress();
        IERC20(token).forceApprove(spender, amount);
        return (true, "");
    }
    
    function _executeSwap(bytes calldata params) internal returns (bool, bytes memory) {
        (address router, bytes memory callData) = abi.decode(params, (address, bytes));
        if (!approvedRouters[router]) revert RouterNotApproved();
        return router.call(callData);
    }
    
    function _executeCustomCall(bytes calldata params) internal returns (bool, bytes memory) {
        (address target, uint256 value, bytes memory callData) = abi.decode(params, (address, uint256, bytes));
        if (!approvedTargets[target]) revert TargetNotApproved();
        if (address(this).balance < value) revert InsufficientBalance();
        return target.call{value: value}(callData);
    }
    
    function _executeBatch(uint256 agentId, bytes calldata params) internal returns (bool, bytes memory) {
        bytes[] memory actions = abi.decode(params, (bytes[]));
        uint256 successCount = 0;
        
        for (uint256 i = 0; i < actions.length; i++) {
            (bool success, ) = _executeActionMemory(agentId, actions[i]);
            if (success) successCount++;
        }
        
        return (successCount == actions.length, abi.encode(successCount, actions.length));
    }
    
    /**
     * @notice Internal action execution (memory version for batch)
     */
    function _executeActionMemory(
        uint256 agentId,
        bytes memory data
    ) internal returns (bool success, bytes memory result) {
        if (data.length < 1) revert InvalidAction();
        
        uint8 actionType = uint8(data[0]);
        bytes memory params = _slice(data, 1, data.length - 1);
        
        if (actionType == ACTION_TRANSFER_BNB) {
            (address to, uint256 amount) = abi.decode(params, (address, uint256));
            if (to == address(0)) revert ZeroAddress();
            if (address(this).balance < amount) revert InsufficientBalance();
            (success, ) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else if (actionType == ACTION_TRANSFER_TOKEN) {
            (address token, address to, uint256 amount) = abi.decode(params, (address, address, uint256));
            if (token == address(0) || to == address(0)) revert ZeroAddress();
            IERC20(token).safeTransfer(to, amount);
            success = true;
        } else if (actionType == ACTION_APPROVE) {
            (address token, address spender, uint256 amount) = abi.decode(params, (address, address, uint256));
            if (token == address(0) || spender == address(0)) revert ZeroAddress();
            IERC20(token).forceApprove(spender, amount);
            success = true;
        } else {
            revert InvalidAction();
        }
        
        agentActionCount[agentId]++;
        emit ActionExecuted(agentId, actionType, success);
    }
    
    function _slice(bytes memory data, uint256 start, uint256 length) internal pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }

    // ============ Learning Module ============
    
    /**
     * @notice Update agent's learning tree root
     * @param agentId Agent token ID
     * @param newRoot New Merkle root of learning data
     * @param proof Proof that update is valid (optional, for verified updates)
     */
    function updateLearning(
        uint256 agentId,
        bytes32 newRoot,
        bytes32[] calldata proof
    ) external onlyAuthorized(agentId) {
        LearningState storage state = learningStates[agentId];
        bytes32 oldRoot = state.merkleRoot;
        
        // If there's an existing root and proof provided, verify continuity
        if (oldRoot != bytes32(0) && proof.length > 0) {
            // Verify the new root is a valid evolution of the old root
            bytes32 leaf = keccak256(abi.encodePacked(oldRoot, newRoot));
            if (!MerkleProof.verify(proof, newRoot, leaf)) {
                revert InvalidProof();
            }
        }
        
        state.merkleRoot = newRoot;
        state.version++;
        state.lastUpdate = block.timestamp;
        state.totalLearnings++;
        
        emit LearningUpdated(agentId, oldRoot, newRoot, state.version);
    }
    
    /**
     * @notice Verify a piece of learning data belongs to agent's learning tree
     * @param agentId Agent token ID
     * @param data The learning data to verify
     * @param proof Merkle proof
     */
    function verifyLearning(
        uint256 agentId,
        bytes calldata data,
        bytes32[] calldata proof
    ) external view returns (bool) {
        bytes32 root = learningStates[agentId].merkleRoot;
        if (root == bytes32(0)) return false;
        
        bytes32 leaf = keccak256(data);
        return MerkleProof.verify(proof, root, leaf);
    }
    
    /**
     * @notice Get learning state for an agent
     */
    function getLearningState(uint256 agentId) external view returns (
        bytes32 merkleRoot,
        uint256 version,
        uint256 lastUpdate,
        uint256 totalLearnings
    ) {
        LearningState storage state = learningStates[agentId];
        return (state.merkleRoot, state.version, state.lastUpdate, state.totalLearnings);
    }

    // ============ Memory Module ============
    
    /**
     * @notice Set a memory value for an agent
     */
    function setMemory(
        uint256 agentId,
        bytes32 key,
        bytes calldata value
    ) external onlyAuthorized(agentId) {
        _setMemory(agentId, key, value);
    }
    
    function _setMemoryInternal(uint256 agentId, bytes calldata params) internal {
        (bytes32 key, bytes memory value) = abi.decode(params, (bytes32, bytes));
        _setMemory(agentId, key, value);
    }
    
    function _setMemory(uint256 agentId, bytes32 key, bytes memory value) internal {
        if (!memoryKeyExists[agentId][key]) {
            agentMemoryKeys[agentId].push(key);
            memoryKeyExists[agentId][key] = true;
        }
        agentMemory[agentId][key] = value;
        emit MemorySet(agentId, key, value.length);
    }
    
    /**
     * @notice Delete a memory value
     */
    function deleteMemory(
        uint256 agentId,
        bytes32 key
    ) external onlyAuthorized(agentId) {
        if (!memoryKeyExists[agentId][key]) revert MemoryKeyNotFound();
        delete agentMemory[agentId][key];
        memoryKeyExists[agentId][key] = false;
        emit MemoryDeleted(agentId, key);
    }
    
    /**
     * @notice Get a memory value
     */
    function getMemory(uint256 agentId, bytes32 key) external view returns (bytes memory) {
        return agentMemory[agentId][key];
    }
    
    /**
     * @notice Get all memory keys for an agent
     */
    function getMemoryKeys(uint256 agentId) external view returns (bytes32[] memory) {
        return agentMemoryKeys[agentId];
    }
    
    /**
     * @notice Get memory count for an agent
     */
    function getMemoryCount(uint256 agentId) external view returns (uint256) {
        return agentMemoryKeys[agentId].length;
    }

    // ============ Multi-Agent Module ============
    
    /**
     * @notice Create delegation from one agent to another
     */
    function createDelegation(
        uint256 fromAgentId,
        uint256 toAgentId,
        uint256 expiry,
        uint8[] calldata allowedActions
    ) external onlyAuthorized(fromAgentId) {
        delegations[fromAgentId][toAgentId] = Delegation({
            active: true,
            expiry: expiry,
            allowedActions: allowedActions
        });
        emit DelegationCreated(fromAgentId, toAgentId, expiry);
    }
    
    function _createDelegationInternal(uint256 fromAgentId, bytes calldata params) internal {
        (uint256 toAgentId, uint256 expiry, uint8[] memory allowedActions) = 
            abi.decode(params, (uint256, uint256, uint8[]));
        delegations[fromAgentId][toAgentId] = Delegation({
            active: true,
            expiry: expiry,
            allowedActions: allowedActions
        });
        emit DelegationCreated(fromAgentId, toAgentId, expiry);
    }
    
    /**
     * @notice Revoke delegation
     */
    function revokeDelegation(
        uint256 fromAgentId,
        uint256 toAgentId
    ) external onlyAuthorized(fromAgentId) {
        delegations[fromAgentId][toAgentId].active = false;
        emit DelegationRevoked(fromAgentId, toAgentId);
    }
    
    /**
     * @notice Execute action on behalf of another agent (via delegation)
     */
    function executeDelegated(
        uint256 fromAgentId,
        uint256 toAgentId,
        bytes calldata data
    ) external onlyAuthorized(toAgentId) nonReentrant returns (bool success, bytes memory result) {
        Delegation storage del = delegations[fromAgentId][toAgentId];
        
        if (!del.active) revert DelegationNotFound();
        if (del.expiry != 0 && block.timestamp > del.expiry) revert DelegationExpired();
        
        uint8 actionType = uint8(data[0]);
        
        // Check if action is allowed
        if (del.allowedActions.length > 0) {
            bool allowed = false;
            for (uint256 i = 0; i < del.allowedActions.length; i++) {
                if (del.allowedActions[i] == actionType) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) revert ActionNotAllowed();
        }
        
        (success, result) = _executeAction(fromAgentId, data);
        emit DelegatedActionExecuted(fromAgentId, toAgentId, actionType);
    }
    
    /**
     * @notice Check if delegation is valid
     */
    function isDelegationValid(
        uint256 fromAgentId,
        uint256 toAgentId,
        uint8 actionType
    ) external view returns (bool) {
        Delegation storage del = delegations[fromAgentId][toAgentId];
        
        if (!del.active) return false;
        if (del.expiry != 0 && block.timestamp > del.expiry) return false;
        
        if (del.allowedActions.length == 0) return true;
        
        for (uint256 i = 0; i < del.allowedActions.length; i++) {
            if (del.allowedActions[i] == actionType) return true;
        }
        return false;
    }

    // ============ View Functions ============
    
    function getAgentStats(uint256 agentId) external view returns (
        address wallet,
        uint256 actionCount,
        uint256 memoryCount,
        uint256 learningVersion
    ) {
        return (
            agentWallets[agentId],
            agentActionCount[agentId],
            agentMemoryKeys[agentId].length,
            learningStates[agentId].version
        );
    }
    
    function isAuthorized(uint256 agentId, address caller) external view returns (bool) {
        return caller == nfaContract || 
               caller == agentWallets[agentId] || 
               caller == openclawOperator ||
               caller == owner();
    }

    // ============ Receive ============
    
    receive() external payable {}
}
