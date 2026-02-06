// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SynthTimelock
 * @notice Timelock controller for SynthLaunch Custody contract.
 *         All owner operations must be queued 48h in advance,
 *         giving users time to verify and react.
 *
 *         Queued transactions are visible on-chain via events.
 *         Anyone can verify what's scheduled before execution.
 */
contract SynthTimelock is ReentrancyGuard {
    // --- Custom Errors (gas efficient) ---
    error NotAdmin();
    error NotSelf();
    error NotPendingAdmin();
    error ZeroAddress();
    error ZeroTarget();
    error EtaTooSoon();
    error EtaTooLate();
    error AlreadyQueued();
    error NotQueued();
    error TooEarly();
    error TxExpired();
    error ExecutionFailed(bytes reason);

    // --- Constants ---
    uint256 public constant MINIMUM_DELAY = 48 hours;
    uint256 public constant MAXIMUM_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 14 days;

    // --- State ---
    address public admin;
    address public pendingAdmin;
    mapping(bytes32 => bool) public queuedTransactions;

    // --- Events ---
    event TransactionQueued(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event TransactionExecuted(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event TransactionCancelled(bytes32 indexed txHash);
    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed pendingAdmin);

    // --- Modifiers ---
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert NotSelf();
        _;
    }

    // --- Constructor ---
    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
        emit NewAdmin(_admin);
    }

    // --- Queue: schedule a transaction for future execution ---
    function queueTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external onlyAdmin returns (bytes32) {
        if (target == address(0)) revert ZeroTarget();
        if (eta < block.timestamp + MINIMUM_DELAY) revert EtaTooSoon();
        if (eta > block.timestamp + MAXIMUM_DELAY) revert EtaTooLate();

        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        if (queuedTransactions[txHash]) revert AlreadyQueued();

        queuedTransactions[txHash] = true;

        emit TransactionQueued(txHash, target, value, signature, data, eta);
        return txHash;
    }

    // --- Execute: run the transaction after delay has passed ---
    function executeTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external onlyAdmin nonReentrant returns (bytes memory) {
        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );

        if (!queuedTransactions[txHash]) revert NotQueued();
        if (block.timestamp < eta) revert TooEarly();
        if (block.timestamp > eta + GRACE_PERIOD) revert TxExpired();

        queuedTransactions[txHash] = false;

        // Build calldata
        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(
                bytes4(keccak256(bytes(signature))),
                data
            );
        }

        (bool success, bytes memory result) = target.call{value: value}(
            callData
        );
        if (!success) {
            if (result.length > 0) {
                // Propagate revert reason
                assembly {
                    revert(add(result, 32), mload(result))
                }
            } else {
                revert ExecutionFailed(result);
            }
        }

        emit TransactionExecuted(txHash, target, value, signature, data, eta);
        return result;
    }

    // --- Cancel: remove a queued transaction ---
    function cancelTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external onlyAdmin {
        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );

        if (!queuedTransactions[txHash]) revert NotQueued();
        queuedTransactions[txHash] = false;

        emit TransactionCancelled(txHash);
    }

    // --- Admin transfer: MUST go through timelock itself (48h delay enforced) ---
    function setPendingAdmin(address _pendingAdmin) external onlySelf {
        if (_pendingAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = _pendingAdmin;
        emit NewPendingAdmin(_pendingAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit NewAdmin(admin);
    }

    // --- Receive BNB (for withdrawPlatformFee relay) ---
    receive() external payable {}
}
