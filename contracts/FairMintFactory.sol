// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FairMintToken.sol";

/**
 * @title FairMintFactory
 * @notice One-click deployment of FairMintToken contracts.
 *
 * - Owner sets platform fee recipient and default router
 * - Anyone can create a Fair Mint (pays creation fee)
 * - Tracks all deployed tokens
 */
contract FairMintFactory {
    // ── State ───────────────────────────────────────────────────
    address public owner;
    address public platform;           // platform fee wallet
    address public router;             // PancakeSwap V2 router
    address public synthID;            // SynthID contract address
    uint256 public creationFee;        // BNB fee to create a fair mint
    uint256 public minRaiseBnb;        // min total raise in wei (~$50K FDV)
    uint256 public maxRaiseBnb;        // max total raise in wei (~$200K FDV)
    uint256 public mintFeeRate;        // mint fee in bps (250 = 2.5%)

    address[] public allTokens;
    mapping(address => bool) public isToken;
    mapping(address => address[]) public tokensByCreator;

    // ── Events ──────────────────────────────────────────────────
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 mintPrice,
        bool agentOnly
    );
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event PlatformChanged(address indexed newPlatform);
    event RouterChanged(address indexed newRouter);
    event CreationFeeChanged(uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event RaiseLimitsChanged(uint256 minRaise, uint256 maxRaise);
    event MintFeeRateChanged(uint256 newRate);

    // ── Errors ──────────────────────────────────────────────────
    error NotOwner();
    error InsufficientFee();
    error TransferFailed();
    error ZeroAddress();
    error RaiseTooLow();
    error RaiseTooHigh();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address _platform,
        address _router,
        address _synthID,
        uint256 _creationFee,
        uint256 _minRaiseBnb,
        uint256 _maxRaiseBnb,
        uint256 _mintFeeRate
    ) {
        require(_platform != address(0), "zero platform");
        require(_router != address(0), "zero router");
        require(_maxRaiseBnb >= _minRaiseBnb, "bad raise limits");
        require(_mintFeeRate <= 1000, "max 10% mint fee");
        owner = msg.sender;
        platform = _platform;
        router = _router;
        synthID = _synthID;
        creationFee = _creationFee;
        minRaiseBnb = _minRaiseBnb;
        maxRaiseBnb = _maxRaiseBnb;
        mintFeeRate = _mintFeeRate;
    }

    // ── Create Token ────────────────────────────────────────────

    struct CreateParams {
        string  name;
        string  symbol;
        uint256 totalSupply;     // total tokens (not in wei, factory multiplies)
        uint256 mintPrice;       // BNB per token in wei
        uint256 perWalletLimit;  // max tokens per wallet
        uint256 lpRatioBps;      // LP ratio in bps (e.g., 2000 = 20%)
        uint256 duration;        // mint duration in seconds
        address beneficiary;     // agent fee recipient
        bool    agentOnly;       // require SynthID to mint
    }

    /// @notice Deploy a new FairMintToken. Starts immediately.
    function createToken(CreateParams calldata p) external payable returns (address token) {
        if (msg.value < creationFee) revert InsufficientFee();

        address _synthID = p.agentOnly ? synthID : address(0);

        require(p.duration >= 1 hours, "min 1h duration");
        require(p.duration <= 30 days, "max 30d duration");

        // Convert user-facing whole tokens to wei (18 decimals)
        uint256 totalSupplyWei = p.totalSupply * 1e18;
        uint256 perWalletLimitWei = p.perWalletLimit * 1e18;

        // Check total raise within allowed range
        // mintableSupply = totalSupply * (10000 - lpRatioBps) / 10000
        uint256 mintableSupply = (p.totalSupply * (10000 - p.lpRatioBps)) / 10000;
        uint256 totalRaise = mintableSupply * p.mintPrice;
        if (totalRaise < minRaiseBnb) revert RaiseTooLow();
        if (totalRaise > maxRaiseBnb) revert RaiseTooHigh();

        FairMintToken t = new FairMintToken(
            p.name,
            p.symbol,
            totalSupplyWei,              // in wei
            p.mintPrice,                 // BNB per whole token
            perWalletLimitWei,           // in wei
            p.lpRatioBps,
            block.timestamp,             // start now (no past startTime)
            block.timestamp + p.duration, // end after duration
            p.beneficiary,
            platform,
            router,
            _synthID,
            msg.sender,
            mintFeeRate                  // mint fee rate in bps
        );

        token = address(t);
        allTokens.push(token);
        isToken[token] = true;
        tokensByCreator[msg.sender].push(token);

        emit TokenCreated(
            token,
            msg.sender,
            p.name,
            p.symbol,
            p.totalSupply,
            p.mintPrice,
            p.agentOnly
        );

        // Refund excess fee
        if (msg.value > creationFee) {
            (bool ok, ) = msg.sender.call{value: msg.value - creationFee}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ── Views ───────────────────────────────────────────────────

    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    function getTokensByCreator(address _creator) external view returns (address[] memory) {
        return tokensByCreator[_creator];
    }

    /// @notice Get paginated token list
    function getTokens(uint256 offset, uint256 limit) external view returns (address[] memory tokens) {
        uint256 total = allTokens.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        tokens = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            tokens[i - offset] = allTokens[i];
        }
    }

    // ── Admin ───────────────────────────────────────────────────

    function setOwner(address _owner) external onlyOwner {
        if (_owner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }

    function setPlatform(address _platform) external onlyOwner {
        if (_platform == address(0)) revert ZeroAddress();
        platform = _platform;
        emit PlatformChanged(_platform);
    }

    function setRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert ZeroAddress();
        router = _router;
        emit RouterChanged(_router);
    }

    function setCreationFee(uint256 _fee) external onlyOwner {
        creationFee = _fee;
        emit CreationFeeChanged(_fee);
    }

    function setRaiseLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_max >= _min, "bad limits");
        minRaiseBnb = _min;
        maxRaiseBnb = _max;
        emit RaiseLimitsChanged(_min, _max);
    }

    function setMintFeeRate(uint256 _rate) external onlyOwner {
        require(_rate <= 1000, "max 10%");
        mintFeeRate = _rate;
        emit MintFeeRateChanged(_rate);
    }

    function withdrawFees(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = address(this).balance;
        (bool ok, ) = to.call{value: bal}("");
        if (!ok) revert TransferFailed();
        emit FeesWithdrawn(to, bal);
    }

    receive() external payable {}
}
