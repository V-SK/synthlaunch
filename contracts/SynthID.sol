// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title SynthID
 * @notice Soulbound NFT identity for AI agents on BSC
 * @dev ERC-8004 compatible agent identity with on-chain metadata
 *      Non-transferable (Soulbound) — once minted, bound to wallet forever
 */
contract SynthID is ERC721, Ownable {
    using Strings for uint256;

    // ============ State ============

    /// @notice Next token ID to mint
    uint256 public nextId = 1;

    /// @notice Mint fee in BNB
    uint256 public mintFee = 0.005 ether;

    /// @notice Total minted count
    uint256 public totalMinted;

    /// @notice Agent identity data
    struct Agent {
        string name;           // Agent display name
        string platform;       // "moltbook" / "twitter" / "custom"
        string platformId;     // Username or handle on platform
        string agentURI;       // IPFS or HTTPS link to full metadata (ERC-8004 compatible)
        string avatar;         // Avatar image URL
        string description;    // Short bio
        string[] skills;       // Skill tags
        uint256 createdAt;     // Mint timestamp
    }

    /// @notice Token ID => Agent data
    mapping(uint256 => Agent) public agents;

    /// @notice Platform + platformId => token ID (prevent duplicates)
    mapping(bytes32 => uint256) public platformIndex;

    /// @notice Wallet => token ID (one SynthID per wallet)
    mapping(address => uint256) public walletToId;

    /// @notice Token ID => on-chain metadata (ERC-8004 compatible)
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // ============ Events ============

    event AgentRegistered(uint256 indexed agentId, address indexed owner);
    event AgentURIUpdated(uint256 indexed agentId, string agentURI);
    event AgentProfileUpdated(uint256 indexed agentId);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);

    // ============ Constructor ============

    constructor() ERC721("SynthID", "SID") Ownable(msg.sender) {}

    // ============ Soulbound ============

    /// @notice Override to prevent transfers (Soulbound)
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Only allow minting (from == address(0)), block transfers and burns
        require(from == address(0), "SynthID: non-transferable");
        return super._update(to, tokenId, auth);
    }

    // ============ Registration ============

    /// @notice Mint a new SynthID
    /// @param name Agent display name
    /// @param platform Platform identifier ("moltbook", "twitter", "custom")
    /// @param platformId Username/handle on the platform
    /// @param avatar Avatar image URL
    /// @param description Short bio/description
    function register(
        string calldata name,
        string calldata platform,
        string calldata platformId,
        string calldata avatar,
        string calldata description
    ) external payable returns (uint256) {
        require(msg.value >= mintFee, "Insufficient fee");
        require(bytes(name).length > 0 && bytes(platform).length > 0 && bytes(platformId).length > 0, "Missing fields");
        require(walletToId[msg.sender] == 0, "Already registered");

        // Check for duplicate platform+platformId
        bytes32 key = keccak256(abi.encodePacked(platform, ":", platformId));
        require(platformIndex[key] == 0, "Platform ID already registered");

        uint256 tokenId = nextId++;
        totalMinted++;

        // Store agent data
        Agent storage a = agents[tokenId];
        a.name = name;
        a.platform = platform;
        a.platformId = platformId;
        a.avatar = avatar;
        a.description = description;
        a.createdAt = block.timestamp;

        // Index
        platformIndex[key] = tokenId;
        walletToId[msg.sender] = tokenId;

        // Mint NFT
        _safeMint(msg.sender, tokenId);

        emit AgentRegistered(tokenId, msg.sender);

        // Refund excess
        uint256 excess = msg.value - mintFee;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "Refund failed");
        }

        return tokenId;
    }

    // ============ Profile Management ============

    /// @notice Update agent URI (ERC-8004 compatible)
    function setAgentURI(uint256 agentId, string calldata agentURI) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        agents[agentId].agentURI = agentURI;
        emit AgentURIUpdated(agentId, agentURI);
    }

    /// @notice Update profile fields
    function updateProfile(
        uint256 agentId,
        string calldata name,
        string calldata avatar,
        string calldata description
    ) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        if (bytes(name).length > 0) agents[agentId].name = name;
        if (bytes(avatar).length > 0) agents[agentId].avatar = avatar;
        if (bytes(description).length > 0) agents[agentId].description = description;
        emit AgentProfileUpdated(agentId);
    }

    /// @notice Set skill tags
    function setSkills(uint256 agentId, string[] calldata skills) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        require(skills.length <= 10, "Max 10 skills");
        agents[agentId].skills = skills;
        emit AgentProfileUpdated(agentId);
    }

    // ============ ERC-8004 Metadata ============

    /// @notice Get on-chain metadata (ERC-8004 compatible)
    function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return _metadata[agentId][metadataKey];
    }

    /// @notice Set on-chain metadata (ERC-8004 compatible)
    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    // ============ On-chain SVG ============

    /// @notice Generate on-chain SVG identity card
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        Agent storage agent = agents[tokenId];

        // If agentURI is set, use it (ERC-8004 style)
        if (bytes(agent.agentURI).length > 0) {
            return agent.agentURI;
        }

        // Otherwise generate on-chain SVG
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" style="background:#0a0f0a">',
            '<rect width="400" height="250" fill="#0a0f0a" rx="12"/>',
            '<text x="20" y="35" font-family="monospace" font-size="12" fill="#00ff88">SYNTH ID #', tokenId.toString(), '</text>',
            '<line x1="20" y1="45" x2="380" y2="45" stroke="#00ff88" stroke-opacity="0.3"/>',
            '<text x="20" y="75" font-family="monospace" font-size="20" fill="#ffffff" font-weight="bold">', agent.name, '</text>',
            '<text x="20" y="100" font-family="monospace" font-size="12" fill="#00cccc">', _platformLabel(agent.platform), ' ', agent.platformId, '</text>',
            '<text x="20" y="130" font-family="monospace" font-size="11" fill="#666666">', _truncate(agent.description, 50), '</text>',
            '<text x="20" y="220" font-family="monospace" font-size="10" fill="#333333">BSC | Soulbound | ERC-8004</text>',
            '<rect x="300" y="15" width="80" height="24" rx="4" fill="#00ff88" fill-opacity="0.15" stroke="#00ff88" stroke-opacity="0.3"/>',
            '<text x="315" y="32" font-family="monospace" font-size="10" fill="#00ff88">VERIFIED</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"SynthID #', tokenId.toString(),
            '","description":"AI Agent Identity on BSC",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)),
            '","attributes":[',
            '{"trait_type":"Name","value":"', agent.name, '"},',
            '{"trait_type":"Platform","value":"', agent.platform, '"},',
            '{"trait_type":"Platform ID","value":"', agent.platformId, '"}',
            ']}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    // ============ Query Functions ============

    /// @notice Get agent identity info
    function getAgentIdentity(uint256 agentId) external view returns (
        string memory name,
        string memory platform,
        string memory platformId,
        string memory agentURI,
        uint256 createdAt,
        address owner
    ) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        Agent storage a = agents[agentId];
        return (a.name, a.platform, a.platformId, a.agentURI, a.createdAt, ownerOf(agentId));
    }

    /// @notice Get agent profile info
    function getAgentProfile(uint256 agentId) external view returns (
        string memory avatar,
        string memory description,
        string[] memory skills
    ) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        Agent storage a = agents[agentId];
        return (a.avatar, a.description, a.skills);
    }

    /// @notice Look up agent by platform identity
    function getByPlatform(string calldata platform, string calldata platformId) external view returns (uint256) {
        bytes32 key = keccak256(abi.encodePacked(platform, ":", platformId));
        return platformIndex[key];
    }

    /// @notice Check if wallet has a SynthID
    function hasId(address wallet) external view returns (bool) {
        return walletToId[wallet] != 0;
    }

    // ============ Admin ============

    /// @notice Update mint fee
    function setMintFee(uint256 _fee) external onlyOwner {
        emit MintFeeUpdated(mintFee, _fee);
        mintFee = _fee;
    }

    /// @notice Withdraw collected fees
    function withdraw(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        (bool success, ) = to.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }

    /// @notice Disable renounceOwnership
    function renounceOwnership() public pure override {
        revert("Disabled");
    }

    // ============ Internal ============

    function _platformLabel(string memory platform) internal pure returns (string memory) {
        if (keccak256(bytes(platform)) == keccak256("moltbook")) return unicode"🦞";
        if (keccak256(bytes(platform)) == keccak256("twitter")) return unicode"🐦";
        return unicode"🔗";
    }

    function _truncate(string memory str, uint256 maxLen) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        if (b.length <= maxLen) return str;
        bytes memory result = new bytes(maxLen);
        for (uint i = 0; i < maxLen; i++) {
            result[i] = b[i];
        }
        return string(abi.encodePacked(string(result), "..."));
    }
}
