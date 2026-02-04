// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IVaultFactory.sol";
import "./SynthVault.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/// @title SynthVaultFactory
/// @notice Factory contract for deploying SynthVault instances via EIP-1167 Clone
/// @author SynthLaunch (synthlaunch.fun)
/// @dev Implements IVaultFactory interface for Flap VaultPortal integration
contract SynthVaultFactory is IVaultFactory {
    // ============ Constants ============
    
    /// @notice VaultPortal address on BSC mainnet
    address public constant VAULT_PORTAL_MAINNET = 0x90497450f2a706f1951b5bdda52B4E5d16f34C06;
    
    /// @notice VaultPortal address on BSC testnet
    address public constant VAULT_PORTAL_TESTNET = 0x027e3704fC5C16522e9393d04C60A3ac5c0d775f;

    // ============ State Variables ============
    
    /// @notice Factory owner
    address public owner;
    
    /// @notice SynthLaunch treasury
    address public treasury;
    
    /// @notice SynthVault implementation contract (template for cloning)
    address public vaultImplementation;
    
    /// @notice Default platform fee in basis points (1000 = 10%)
    uint256 public platformFeeBps;
    
    /// @notice Mapping from tax token to vault address
    mapping(address => address) public vaults;
    
    /// @notice Array of all deployed vaults
    address[] public allVaults;

    // ============ Events ============
    
    /// @notice Emitted when a new vault is created
    event VaultCreated(
        address indexed token,
        address indexed vault,
        address indexed creator,
        address agentWallet
    );
    
    /// @notice Emitted when owner is changed
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    
    /// @notice Emitted when treasury is changed
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    
    /// @notice Emitted when platform fee is changed
    event PlatformFeeChanged(uint256 oldFee, uint256 newFee);

    // ============ Errors ============
    
    /// @notice Thrown when caller is not owner
    error OnlyOwner();
    
    /// @notice Thrown when fee exceeds 10%
    error FeeTooHigh();
    
    /// @notice Thrown when quote token is not supported
    error UnsupportedQuoteToken();
    
    /// @notice Thrown when vault already exists for token
    error VaultAlreadyExists();

    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ============ Constructor ============
    
    /// @notice Deploy the factory
    /// @param _treasury SynthLaunch treasury address
    /// @param _vaultImplementation SynthVault implementation contract for cloning
    /// @param _platformFeeBps Default platform fee in basis points (max 1000)
    constructor(
        address _treasury,
        address _vaultImplementation,
        uint256 _platformFeeBps
    ) {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_vaultImplementation == address(0)) revert ZeroAddress();
        if (_platformFeeBps > 1000) revert FeeTooHigh();
        
        owner = msg.sender;
        treasury = _treasury;
        vaultImplementation = _vaultImplementation;
        platformFeeBps = _platformFeeBps;
    }

    // ============ IVaultFactory Implementation ============
    
    /// @notice Create a new vault for a tax token
    /// @dev Called by VaultPortal when creating a new tax token
    /// @param taxToken The predicted address of the tax token (not yet deployed)
    /// @param quoteToken The quote token address (must be address(0) for BNB)
    /// @param creator The original msg.sender who initiated token creation
    /// @param vaultData Custom data - encodes agentWallet address
    /// @return vault The address of the newly created vault
    function newVault(
        address taxToken,
        address quoteToken,
        address creator,
        bytes calldata vaultData
    ) external override returns (address vault) {
        // Only VaultPortal can call this
        if (msg.sender != _getVaultPortal()) revert OnlyVaultPortal();
        
        // Only support BNB as quote token
        if (quoteToken != address(0)) revert UnsupportedQuoteToken();
        
        // Check vault doesn't already exist
        if (vaults[taxToken] != address(0)) revert VaultAlreadyExists();
        
        // Decode agentWallet from vaultData, default to creator if empty
        address agentWallet;
        if (vaultData.length >= 32) {
            agentWallet = abi.decode(vaultData, (address));
        }
        if (agentWallet == address(0)) {
            agentWallet = creator;
        }
        
        // Deploy vault using EIP-1167 Clone (minimal proxy)
        vault = Clones.clone(vaultImplementation);
        
        // Initialize the vault
        SynthVault(payable(vault)).initialize(
            taxToken,
            agentWallet,
            treasury,
            platformFeeBps
        );
        
        // Record the vault
        vaults[taxToken] = vault;
        allVaults.push(vault);
        
        emit VaultCreated(taxToken, vault, creator, agentWallet);
        
        return vault;
    }
    
    /// @notice Check if a quote token is supported
    /// @param quoteToken The quote token to check
    /// @return supported True if supported (only BNB = address(0))
    function isQuoteTokenSupported(address quoteToken) external pure override returns (bool supported) {
        return quoteToken == address(0);
    }

    // ============ View Functions ============
    
    /// @notice Get the VaultPortal address for current chain
    function _getVaultPortal() internal view returns (address) {
        uint256 chainId = block.chainid;
        if (chainId == 56) return VAULT_PORTAL_MAINNET;
        if (chainId == 97) return VAULT_PORTAL_TESTNET;
        revert("Unsupported chain");
    }
    
    /// @notice Get total number of vaults created
    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }
    
    /// @notice Get vault address for a token
    function getVault(address taxToken) external view returns (address) {
        return vaults[taxToken];
    }

    // ============ Admin Functions ============
    
    /// @notice Transfer ownership
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }
    
    /// @notice Update treasury address (only affects NEW vaults)
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryChanged(treasury, newTreasury);
        treasury = newTreasury;
    }
    
    /// @notice Update default platform fee (only affects NEW vaults)
    /// @param newFeeBps New fee in basis points (max 1000)
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert FeeTooHigh();
        emit PlatformFeeChanged(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }
}
