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
    
    /// @notice Factory address (only factory can mint)
    address public factory;
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Agent data by tokenId
    mapping(uint256 => Agent) public agents;
    
    /// @notice Token address to NFA tokenId mapping
    mapping(address => uint256) public tokenToAgent;
    
    /// @notice Creator address to their first NFA tokenId
    mapping(address => uint256) public creatorToAgent;

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
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);

    // ============ Errors ============
    
    error OnlyFactory();
    error OnlyOwnerOf();
    error OnlyAdmin();
    error AgentNotFound();
    error ZeroAddress();

    // ============ Constructor ============
    
    /// @notice Deploy NFALite
    /// @param _factory Factory address (can be set later via setFactory)
    constructor(address _factory) ERC721("SynthLaunch NFA Lite", "NFAL") {
        factory = _factory;
        owner = msg.sender;
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
        
        // Return avatar URI as token URI
        // For full metadata JSON, integrate with API endpoint
        if (bytes(agent.avatarURI).length > 0) {
            return agent.avatarURI;
        }
        
        // Default placeholder if no avatar set
        return string(abi.encodePacked(
            "https://synthlaunch.fun/api/nfa/metadata?id=",
            _toString(tokenId)
        ));
    }

    // ============ Admin ============
    
    /// @notice Update factory address (for factory upgrade)
    /// @param _factory New factory address
    function setFactory(address _factory) external {
        if (msg.sender != owner) revert OnlyAdmin();
        if (_factory == address(0)) revert ZeroAddress();
        emit FactoryUpdated(factory, _factory);
        factory = _factory;
    }
    
    /// @notice Transfer ownership
    /// @param _owner New owner address
    function transferOwnership(address _owner) external {
        if (msg.sender != owner) revert OnlyAdmin();
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
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
