// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/VaultBase.sol";

/// @title SynthVault
/// @notice Vault contract for AI Agent tax revenue distribution
/// @author SynthLaunch (synthlaunch.fun)
/// @dev Inherits VaultBase and implements 90/10 split (Agent/Platform)
contract SynthVault is VaultBase {
    // ============ State Variables ============
    
    /// @notice The tax token address this vault is bound to
    address public token;
    
    /// @notice The agent wallet address (receives 90% of tax)
    address public agentWallet;
    
    /// @notice SynthLaunch treasury address (receives platform fee)
    address public treasury;
    
    /// @notice Platform fee in basis points (1000 = 10%, max 1000)
    uint256 public platformFeeBps;
    
    /// @notice Total BNB received by this vault
    uint256 public totalReceived;
    
    /// @notice Total BNB claimed by the agent
    uint256 public totalClaimed;
    
    /// @notice Total platform fees collected
    uint256 public totalPlatformFee;
    
    /// @notice Whether this vault has been initialized
    bool public initialized;
    
    /// @notice Minimum balance required for public claim (anti-spam)
    uint256 public constant MIN_CLAIM_THRESHOLD = 0.01 ether;

    // ============ Events ============
    
    /// @notice Emitted when vault is initialized
    event Initialized(address indexed token, address indexed agentWallet, address indexed treasury);
    
    /// @notice Emitted when tax BNB is received
    event TaxReceived(uint256 amount);
    
    /// @notice Emitted when agent claims their share
    event Claimed(address indexed to, uint256 agentAmount, uint256 platformFee);
    
    /// @notice Emitted when platform claims accumulated fees
    event PlatformFeeClaimed(address indexed to, uint256 amount);
    
    /// @notice Emitted when agent wallet is updated
    event AgentWalletUpdated(address indexed oldWallet, address indexed newWallet);
    
    /// @notice Emitted when treasury is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ============ Errors ============
    
    /// @notice Thrown when vault is already initialized
    error AlreadyInitialized();
    
    /// @notice Thrown when caller is not authorized
    error Unauthorized();
    
    /// @notice Thrown when platform fee exceeds maximum (10%)
    error FeeTooHigh();
    
    /// @notice Thrown when there's nothing to claim
    error NothingToClaim();
    
    /// @notice Thrown when transfer fails
    error TransferFailed();
    
    /// @notice Thrown when address is zero
    error ZeroAddress();

    // ============ Modifiers ============
    
    /// @notice Only agent wallet or guardian can call
    modifier onlyAgentOrGuardian() {
        if (msg.sender != agentWallet && msg.sender != _getGuardian()) {
            revert Unauthorized();
        }
        _;
    }
    
    /// @notice Only guardian can call
    modifier onlyGuardian() {
        if (msg.sender != _getGuardian()) {
            revert Unauthorized();
        }
        _;
    }

    // ============ Constructor ============
    
    /// @notice Locks the implementation contract from being initialized
    /// @dev Prevents attackers from initializing the template contract
    constructor() {
        initialized = true;
    }

    // ============ Initialization ============
    
    /// @notice Initialize the vault (can only be called once by factory)
    /// @param _token The tax token address
    /// @param _agentWallet The agent wallet that will receive 90% of tax
    /// @param _treasury The SynthLaunch treasury for platform fees
    /// @param _platformFeeBps Platform fee in basis points (max 1000 = 10%)
    function initialize(
        address _token,
        address _agentWallet,
        address _treasury,
        uint256 _platformFeeBps
    ) external {
        if (initialized) revert AlreadyInitialized();
        if (_platformFeeBps > 1000) revert FeeTooHigh();
        
        token = _token;
        agentWallet = _agentWallet;
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
        initialized = true;
        
        emit Initialized(_token, _agentWallet, _treasury);
    }

    // ============ Receive Function ============
    
    /// @notice Receive BNB from tax
    receive() external payable {
        totalReceived += msg.value;
        emit TaxReceived(msg.value);
    }

    // ============ Claim Functions ============
    
    /// @notice Agent claims their share (auto-deducts platform fee)
    /// @dev Can only be called by agent wallet or guardian
    function claim() external onlyAgentOrGuardian {
        _executeClaim();
    }
    
    /// @notice Public claim - anyone can trigger (for automation bots)
    /// @dev Funds still go to agentWallet, not caller. Enables Lite tier auto-claim.
    /// @dev Requires minimum balance to prevent spam
    function claimPublic() external {
        if (address(this).balance < MIN_CLAIM_THRESHOLD) revert NothingToClaim();
        _executeClaim();
    }
    
    /// @notice Internal claim logic
    function _executeClaim() internal {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToClaim();
        
        // Calculate split
        uint256 platformFee = (balance * platformFeeBps) / 10000;
        uint256 agentAmount = balance - platformFee;
        
        // Update state before transfers
        totalClaimed += agentAmount;
        totalPlatformFee += platformFee;
        
        // Transfer to agent
        (bool successAgent, ) = payable(agentWallet).call{value: agentAmount}("");
        if (!successAgent) revert TransferFailed();
        
        // Transfer platform fee to treasury
        if (platformFee > 0) {
            (bool successTreasury, ) = payable(treasury).call{value: platformFee}("");
            if (!successTreasury) revert TransferFailed();
        }
        
        emit Claimed(agentWallet, agentAmount, platformFee);
    }
    
    /// @notice Emergency withdraw — Guardian only
    /// @dev Sends all vault balance to treasury. Use only in emergency.
    /// Normal platform fees are collected automatically via claim().
    function emergencyWithdraw() external onlyGuardian {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToClaim();
        
        (bool success, ) = payable(treasury).call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit PlatformFeeClaimed(treasury, balance);
    }
    
    // ============ Guardian Admin Functions ============
    
    /// @notice Update agent wallet address — Guardian only
    /// @dev Use when agentWallet cannot receive BNB (contract without receive)
    /// @param _newWallet New agent wallet address
    function setAgentWallet(address _newWallet) external onlyGuardian {
        if (_newWallet == address(0)) revert ZeroAddress();
        address oldWallet = agentWallet;
        agentWallet = _newWallet;
        emit AgentWalletUpdated(oldWallet, _newWallet);
    }
    
    /// @notice Update treasury address — Guardian only
    /// @dev Use when treasury cannot receive BNB
    /// @param _newTreasury New treasury address
    function setTreasury(address _newTreasury) external onlyGuardian {
        if (_newTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    // ============ View Functions ============
    
    /// @notice Returns pending amount claimable by agent
    function pendingAgent() public view returns (uint256) {
        uint256 balance = address(this).balance;
        uint256 platformFee = (balance * platformFeeBps) / 10000;
        return balance - platformFee;
    }
    
    /// @notice Returns pending platform fee
    function pendingPlatform() public view returns (uint256) {
        return (address(this).balance * platformFeeBps) / 10000;
    }

    /// @notice Returns vault description (required by VaultBase)
    /// @dev Dynamic description showing vault state
    function description() public view override returns (string memory) {
        uint256 balance = address(this).balance;
        
        return string(
            abi.encodePacked(
                "SynthVault for AI Agent. Token: ",
                _addressToString(token),
                ". Agent wallet: ",
                _addressToString(agentWallet),
                ". Balance: ",
                _formatBNB(balance),
                " BNB. Total received: ",
                _formatBNB(totalReceived),
                " BNB. Agent claimed: ",
                _formatBNB(totalClaimed),
                " BNB. Platform fee: ",
                _uintToString(platformFeeBps / 100),
                ".",
                _uintToString(platformFeeBps % 100),
                "%. Developed by SynthLaunch (synthlaunch.fun)"
            )
        );
    }

    // ============ Internal Helpers ============
    
    /// @notice Convert uint to string
    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    /// @notice Format BNB amount with 4 decimals
    function _formatBNB(uint256 weiAmount) internal pure returns (string memory) {
        uint256 whole = weiAmount / 1e18;
        uint256 decimals = (weiAmount % 1e18) / 1e14; // 4 decimal places
        
        return string(
            abi.encodePacked(
                _uintToString(whole),
                ".",
                _padZeros(_uintToString(decimals), 4)
            )
        );
    }
    
    /// @notice Pad string with leading zeros
    function _padZeros(string memory str, uint256 targetLength) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length >= targetLength) return str;
        
        bytes memory padded = new bytes(targetLength);
        uint256 paddingCount = targetLength - strBytes.length;
        
        for (uint256 i = 0; i < paddingCount; i++) {
            padded[i] = "0";
        }
        for (uint256 i = 0; i < strBytes.length; i++) {
            padded[paddingCount + i] = strBytes[i];
        }
        
        return string(padded);
    }
    
    /// @notice Convert address to string
    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(uint160(addr) >> (8 * (19 - i)) >> 4) & 0xf];
            str[3 + i * 2] = alphabet[uint8(uint160(addr) >> (8 * (19 - i))) & 0xf];
        }
        return string(str);
    }
}
