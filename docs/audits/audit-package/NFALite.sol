// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title NFALite
/// @notice Lightweight Non-Fungible Agent — auto-minted by VaultFactory
/// @author SynthLaunch (synthlaunch.fun)
/// @dev Has avatar + wallet capability but no XP/evolution (upgrade to NFA Pro for that)
contract NFALite is ERC721 {

    // ============ Structs ============
    
    struct Agent {
        string name;            // Agent 名字
        string avatarURI;       // 头像 URI (IPFS/URL)
        address vault;          // 绑定的 SynthVault 地址
        address wallet;         // Agent 可操控的钱包地址
        address creator;        // 创建者
        uint256 createdAt;      // 创建时间
        address token;          // 绑定的 tax token 地址
    }

    // ============ State Variables ============
    
    /// @notice Total number of agents minted
    uint256 public totalAgents;
    
    /// @notice Factory address (only factory can mint, immutable after deploy)
    address public immutable factory;
    
    /// @notice Agent data by tokenId
    mapping(uint256 => Agent) public agents;
    
    /// @notice Token address to NFA tokenId mapping
    mapping(address => uint256) public tokenToAgent;
    
    /// @notice Creator address to their first NFA tokenId
    mapping(address => uint256) public creatorToAgent;
    
    /// @notice Base metadata URI (default fallback, can be IPFS gateway)
    string public baseMetadataURI;

    // ============ Events ============
    
    event AgentMinted(
        uint256 indexed tokenId,
        string name,
        address indexed vault,
        address indexed creator,
        address token
    );
    
    event AvatarUpdated(uint256 indexed tokenId, string newAvatarURI);
    event WalletUpdated(uint256 indexed tokenId, address newWallet);

    // ============ Errors ============
    
    error OnlyFactory();
    error OnlyOwnerOf();
    error AgentNotFound();
    error ZeroAddress();

    // ============ Constructor ============
    
    /// @notice Deploy NFALite
    /// @param _factory Factory address (immutable)
    /// @param _baseMetadataURI Base URI for token metadata (e.g., IPFS gateway)
    constructor(address _factory, string memory _baseMetadataURI) ERC721("SynthLaunch NFA Lite", "NFAL") {
        factory = _factory;
        baseMetadataURI = _baseMetadataURI;
    }

    // ============ Mint (Factory Only) ============
    
    /// @notice Mint a new NFALite — called by SynthVaultFactory
    /// @param _name Agent name (usually same as token name)
    /// @param _avatarURI Avatar image URI (can be empty, set later)
    /// @param _vault The SynthVault address bound to this agent
    /// @param _wallet Agent wallet address (usually = creator)
    /// @param _creator The original creator
    /// @param _token The tax token address
    /// @return tokenId The minted NFALite tokenId
    function mintAgent(
        string calldata _name,
        string calldata _avatarURI,
        address _vault,
        address _wallet,
        address _creator,
        address _token
    ) external returns (uint256 tokenId) {
        if (msg.sender != factory) revert OnlyFactory();
        
        totalAgents++;
        tokenId = totalAgents;
        
        agents[tokenId] = Agent({
            name: _name,
            avatarURI: _avatarURI,
            vault: _vault,
            wallet: _wallet,
            creator: _creator,
            createdAt: block.timestamp,
            token: _token
        });
        
        tokenToAgent[_token] = tokenId;
        
        // Only set creatorToAgent if not already set (first agent per creator)
        if (creatorToAgent[_creator] == 0) {
            creatorToAgent[_creator] = tokenId;
        }
        
        // Mint NFT to creator
        _mint(_creator, tokenId);
        
        emit AgentMinted(tokenId, _name, _vault, _creator, _token);
        return tokenId;
    }

    // ============ Update Functions ============
    
    /// @notice Update avatar (only NFT owner)
    /// @param tokenId The NFALite tokenId
    /// @param _avatarURI New avatar URI
    function setAvatar(uint256 tokenId, string calldata _avatarURI) external {
        if (ownerOf(tokenId) != msg.sender) revert OnlyOwnerOf();
        agents[tokenId].avatarURI = _avatarURI;
        emit AvatarUpdated(tokenId, _avatarURI);
    }
    
    /// @notice Update wallet address (only NFT owner)
    /// @param tokenId The NFALite tokenId
    /// @param _wallet New wallet address
    function setWallet(uint256 tokenId, address _wallet) external {
        if (ownerOf(tokenId) != msg.sender) revert OnlyOwnerOf();
        if (_wallet == address(0)) revert ZeroAddress();
        agents[tokenId].wallet = _wallet;
        emit WalletUpdated(tokenId, _wallet);
    }

    // ============ View Functions ============
    
    /// @notice Get full agent info
    /// @param tokenId The NFALite tokenId
    /// @return agent The Agent struct
    function getAgent(uint256 tokenId) external view returns (Agent memory) {
        if (tokenId == 0 || tokenId > totalAgents) revert AgentNotFound();
        return agents[tokenId];
    }
    
    /// @notice Get agent by token address
    /// @param _token The tax token address
    /// @return tokenId The NFALite tokenId
    /// @return agent The Agent struct
    function getAgentByToken(address _token) external view returns (uint256 tokenId, Agent memory agent) {
        tokenId = tokenToAgent[_token];
        if (tokenId == 0) revert AgentNotFound();
        return (tokenId, agents[tokenId]);
    }
    
    /// @notice Token URI for NFT metadata
    /// @param tokenId The NFALite tokenId
    /// @return URI string
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (tokenId == 0 || tokenId > totalAgents) revert AgentNotFound();
        Agent memory agent = agents[tokenId];
        
        // Return avatar URI as token URI if set
        // For full metadata JSON, integrate with API endpoint
        if (bytes(agent.avatarURI).length > 0) {
            return agent.avatarURI;
        }
        
        // Use configurable base URI (can be changed to IPFS gateway)
        return string(abi.encodePacked(
            baseMetadataURI,
            _toString(tokenId)
        ));
    }

    // ============ Internal Helpers ============
    
    /// @notice Convert uint to string
    function _toString(uint256 value) internal pure returns (string memory) {
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
}
