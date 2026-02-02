// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title SynthID
 * @notice Soulbound NFT identity for AI agents on BSC
 * @dev ERC-8004 compatible agent identity with on-chain metadata
 *      Non-transferable (Soulbound) — once minted, bound to wallet forever
 *
 * Audit fixes v2:
 *  - ReentrancyGuard on register()
 *  - SVG string sanitization (prevent injection)
 *  - String length limits to cap gas/storage abuse
 *  - Admin revoke for malicious agents
 *  - mintFee set to 0.04 ether (~$30)
 */
contract SynthID is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ============ Constants ============

    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_PLATFORM_LENGTH = 32;
    uint256 public constant MAX_PLATFORM_ID_LENGTH = 64;
    uint256 public constant MAX_AVATAR_LENGTH = 512;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 512;
    uint256 public constant MAX_SKILL_LENGTH = 32;
    uint256 public constant MAX_SKILLS = 10;
    uint256 public constant MAX_METADATA_KEY_LENGTH = 64;
    uint256 public constant MAX_METADATA_VALUE_LENGTH = 2048;

    // ============ State ============

    /// @notice Next token ID to mint
    uint256 public nextId = 1;

    /// @notice Mint fee in BNB (~$30 at launch)
    uint256 public mintFee = 0.04 ether;

    /// @notice Total minted count (includes revoked)
    uint256 public totalMinted;

    /// @notice Active (non-revoked) count
    uint256 public activeCount;

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
        bool revoked;          // Admin can revoke malicious agents
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

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string name, string platform, string platformId);
    event AgentRevoked(uint256 indexed agentId, string reason);
    event AgentURIUpdated(uint256 indexed agentId, string agentURI);
    event AgentProfileUpdated(uint256 indexed agentId);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);

    // ============ Constructor ============

    constructor() ERC721("SynthID", "SID") Ownable(msg.sender) {}

    // ============ Soulbound ============

    /// @notice Override to prevent transfers (Soulbound)
    /// @dev Only minting (from == address(0)) and admin burns are allowed
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Allow minting (from == 0) and burning by owner (to == 0, auth == owner())
        if (from != address(0)) {
            require(to == address(0) && auth == owner(), "SynthID: non-transferable");
        }
        return super._update(to, tokenId, auth);
    }

    // ============ Registration ============

    /// @notice Mint a new SynthID
    function register(
        string calldata name,
        string calldata platform,
        string calldata platformId,
        string calldata avatar,
        string calldata description
    ) external payable nonReentrant returns (uint256) {
        require(msg.value >= mintFee, "Insufficient fee");
        require(walletToId[msg.sender] == 0, "Already registered");

        // Validate lengths
        require(bytes(name).length > 0 && bytes(name).length <= MAX_NAME_LENGTH, "Invalid name length");
        require(bytes(platform).length > 0 && bytes(platform).length <= MAX_PLATFORM_LENGTH, "Invalid platform length");
        require(bytes(platformId).length > 0 && bytes(platformId).length <= MAX_PLATFORM_ID_LENGTH, "Invalid platformId length");
        require(bytes(avatar).length <= MAX_AVATAR_LENGTH, "Avatar URL too long");
        require(bytes(description).length <= MAX_DESCRIPTION_LENGTH, "Description too long");

        // Check for duplicate platform+platformId
        bytes32 key = keccak256(abi.encodePacked(platform, ":", platformId));
        require(platformIndex[key] == 0, "Platform ID already registered");

        uint256 tokenId = nextId++;
        totalMinted++;
        activeCount++;

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

        emit AgentRegistered(tokenId, msg.sender, name, platform, platformId);

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
        require(!agents[agentId].revoked, "Agent revoked");
        agents[agentId].agentURI = agentURI;
        emit AgentURIUpdated(agentId, agentURI);
    }

    /// @notice Update profile fields (pass empty string to skip a field)
    function updateProfile(
        uint256 agentId,
        string calldata name,
        string calldata avatar,
        string calldata description
    ) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        require(!agents[agentId].revoked, "Agent revoked");
        if (bytes(name).length > 0) {
            require(bytes(name).length <= MAX_NAME_LENGTH, "Name too long");
            agents[agentId].name = name;
        }
        if (bytes(avatar).length > 0) {
            require(bytes(avatar).length <= MAX_AVATAR_LENGTH, "Avatar too long");
            agents[agentId].avatar = avatar;
        }
        if (bytes(description).length > 0) {
            require(bytes(description).length <= MAX_DESCRIPTION_LENGTH, "Description too long");
            agents[agentId].description = description;
        }
        emit AgentProfileUpdated(agentId);
    }

    /// @notice Set skill tags
    function setSkills(uint256 agentId, string[] calldata skills) external {
        require(ownerOf(agentId) == msg.sender, "Not owner");
        require(!agents[agentId].revoked, "Agent revoked");
        require(skills.length <= MAX_SKILLS, "Max 10 skills");
        for (uint i = 0; i < skills.length; i++) {
            require(bytes(skills[i]).length <= MAX_SKILL_LENGTH, "Skill tag too long");
        }
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
        require(!agents[agentId].revoked, "Agent revoked");
        require(bytes(metadataKey).length <= MAX_METADATA_KEY_LENGTH, "Key too long");
        require(metadataValue.length <= MAX_METADATA_VALUE_LENGTH, "Value too long");
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

        // Sanitize strings for SVG (prevent injection)
        string memory safeName = _sanitizeSvg(agent.name, 32);
        string memory safePlatformId = _sanitizeSvg(agent.platformId, 32);
        string memory safeDesc = _sanitizeSvg(agent.description, 50);
        string memory status = agent.revoked ? "REVOKED" : "VERIFIED";
        string memory statusColor = agent.revoked ? "#F6465D" : "#00ff88";

        // Generate on-chain SVG
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" style="background:#0B0E11">',
            '<rect width="400" height="250" fill="#0B0E11" rx="12"/>',
            '<text x="20" y="35" font-family="monospace" font-size="12" fill="#F0B90B">SYNTH ID #', tokenId.toString(), '</text>',
            '<line x1="20" y1="45" x2="380" y2="45" stroke="#F0B90B" stroke-opacity="0.3"/>',
            '<text x="20" y="75" font-family="monospace" font-size="20" fill="#EAECEF" font-weight="bold">', safeName, '</text>',
            '<text x="20" y="100" font-family="monospace" font-size="12" fill="#848E9C">', _platformLabel(agent.platform), ' ', safePlatformId, '</text>',
            '<text x="20" y="130" font-family="monospace" font-size="11" fill="#5E6673">', safeDesc, '</text>'
        ));

        svg = string(abi.encodePacked(
            svg,
            '<text x="20" y="220" font-family="monospace" font-size="10" fill="#2B3139">BSC | Soulbound | ERC-8004</text>',
            '<rect x="300" y="15" width="80" height="24" rx="4" fill="', statusColor, '" fill-opacity="0.15" stroke="', statusColor, '" stroke-opacity="0.3"/>',
            '<text x="315" y="32" font-family="monospace" font-size="10" fill="', statusColor, '">', status, '</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"SynthID #', tokenId.toString(),
            '","description":"AI Agent Identity on BSC",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)),
            '","attributes":[',
            '{"trait_type":"Name","value":"', safeName, '"},',
            '{"trait_type":"Platform","value":"', _sanitizeSvg(agent.platform, 16), '"},',
            '{"trait_type":"Platform ID","value":"', safePlatformId, '"},',
            '{"trait_type":"Status","value":"', status, '"}',
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
        address agentOwner,
        bool revoked
    ) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        Agent storage a = agents[agentId];
        return (a.name, a.platform, a.platformId, a.agentURI, a.createdAt, ownerOf(agentId), a.revoked);
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

    /// @notice Revoke a malicious agent (marks as revoked, does NOT burn)
    function revoke(uint256 agentId, string calldata reason) external onlyOwner {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        require(!agents[agentId].revoked, "Already revoked");
        agents[agentId].revoked = true;
        activeCount--;
        emit AgentRevoked(agentId, reason);
    }

    /// @notice Update mint fee
    function setMintFee(uint256 _fee) external onlyOwner {
        emit MintFeeUpdated(mintFee, _fee);
        mintFee = _fee;
    }

    /// @notice Withdraw collected fees
    function withdraw(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = to.call{value: balance}("");
        require(success, "Transfer failed");
    }

    /// @notice Disable renounceOwnership
    function renounceOwnership() public pure override {
        revert("Disabled");
    }

    // ============ Internal ============

    /// @notice Sanitize string for SVG embedding — strips < > & " ' characters
    /// @dev Prevents SVG/XML injection attacks in tokenURI output
    function _sanitizeSvg(string memory str, uint256 maxLen) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        uint256 len = b.length > maxLen ? maxLen : b.length;
        bytes memory result = new bytes(len);
        uint256 j = 0;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            // Skip dangerous XML/SVG characters
            if (c != "<" && c != ">" && c != "&" && c != '"' && c != "'") {
                result[j++] = c;
            }
        }
        // Trim result to actual length
        bytes memory trimmed = new bytes(j);
        for (uint256 i = 0; i < j; i++) {
            trimmed[i] = result[i];
        }
        return string(trimmed);
    }

    function _platformLabel(string memory platform) internal pure returns (string memory) {
        if (keccak256(bytes(platform)) == keccak256("moltbook")) return "Moltbook";
        if (keccak256(bytes(platform)) == keccak256("twitter")) return "Twitter";
        return "Custom";
    }
}
