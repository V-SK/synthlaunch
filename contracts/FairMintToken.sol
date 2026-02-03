// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FairMintToken
 * @notice Fixed-price fair mint ERC-20 with auto PancakeSwap LP creation.
 *
 * Flow:
 *   1. Creator deploys via FairMintFactory with parameters
 *   2. Users call mint() during the mint window, paying BNB
 *   3. After mint ends (time or sold out), anyone calls finalize()
 *   4. finalize() splits collected BNB:
 *      - 10% → agent (beneficiary)
 *      - 10% → platform
 *      - 80% → PancakeSwap LP (paired with reserved tokens)
 *   5. LP tokens are locked forever in this contract
 *
 * Token allocation:
 *   - mintableSupply (default 80%) → public mint
 *   - lpSupply      (default 20%) → reserved for LP
 */

interface IPancakeFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IPancakeRouter {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
}

interface ISynthID {
    function balanceOf(address owner) external view returns (uint256);
}

contract FairMintToken is ERC20, ReentrancyGuard {
    // ── Immutables ──────────────────────────────────────────────
    address public immutable creator;        // who deployed (via factory)
    address public immutable beneficiary;    // agent fee recipient
    address public immutable platform;       // platform fee recipient
    address public immutable router;         // PancakeSwap router
    address public immutable synthID;        // SynthID contract (address(0) if not agent-only)

    uint256 public immutable mintPrice;      // BNB per token (wei)
    uint256 public immutable perWalletLimit;  // max tokens per wallet
    uint256 public immutable mintableSupply;  // tokens available for public mint
    uint256 public immutable lpSupply;        // tokens reserved for LP
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    bool    public immutable agentOnly;       // requires SynthID to mint

    // ── Fee basis points (out of 10000) ─────────────────────────
    uint256 public constant AGENT_FEE_BPS    = 1000; // 10%
    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10%
    uint256 public constant LP_BPS           = 8000; // 80%

    // ── State ───────────────────────────────────────────────────
    uint256 public totalMinted;
    mapping(address => uint256) public mintedBy;
    bool    public finalized;
    address public lpPair;

    // ── Events ──────────────────────────────────────────────────
    event Minted(address indexed user, uint256 amount, uint256 cost);
    event Finalized(address indexed lpPair, uint256 lpTokens, uint256 agentFee, uint256 platformFee);
    event Refunded(address indexed user, uint256 amount);

    // ── Errors ──────────────────────────────────────────────────
    error MintNotStarted();
    error MintEnded();
    error MintAlreadyFinalized();
    error ExceedsWalletLimit();
    error ExceedsSupply();
    error InsufficientPayment();
    error MintNotComplete();
    error AlreadyFinalized();
    error SynthIDRequired();
    error TransferFailed();
    error ZeroAmount();

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,      // total tokens (mintable + LP)
        uint256 _mintPrice,        // price per token in wei
        uint256 _perWalletLimit,
        uint256 _lpRatioBps,       // LP ratio in bps (e.g., 2000 = 20%)
        uint256 _startTime,
        uint256 _endTime,
        address _beneficiary,
        address _platform,
        address _router,
        address _synthID,          // address(0) for public mint
        address _creator
    ) ERC20(_name, _symbol) {
        require(_totalSupply > 0, "zero supply");
        require(_mintPrice > 0, "zero price");
        require(_perWalletLimit > 0, "zero limit");
        require(_endTime > _startTime, "bad times");
        require(_lpRatioBps > 0 && _lpRatioBps <= 5000, "lp ratio 1-50%");
        require(_beneficiary != address(0), "zero beneficiary");
        require(_platform != address(0), "zero platform");
        require(_router != address(0), "zero router");

        lpSupply = (_totalSupply * _lpRatioBps) / 10000;
        mintableSupply = _totalSupply - lpSupply;

        mintPrice = _mintPrice;
        perWalletLimit = _perWalletLimit;
        startTime = _startTime;
        endTime = _endTime;
        beneficiary = _beneficiary;
        platform = _platform;
        router = _router;
        synthID = _synthID;
        agentOnly = _synthID != address(0);
        creator = _creator;

        // Mint total supply to this contract
        _mint(address(this), _totalSupply);
    }

    // ── Mint ────────────────────────────────────────────────────

    /// @notice Mint tokens at fixed price. Send exact BNB.
    /// @param amount Number of tokens to mint (in whole tokens, not wei — tokens have 18 decimals)
    function mint(uint256 amount) external payable nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp < startTime) revert MintNotStarted();
        if (block.timestamp > endTime) revert MintEnded();
        if (finalized) revert MintAlreadyFinalized();

        // SynthID gate
        if (agentOnly) {
            if (ISynthID(synthID).balanceOf(msg.sender) == 0) revert SynthIDRequired();
        }

        // Check limits
        uint256 newMinted = mintedBy[msg.sender] + amount;
        if (newMinted > perWalletLimit) revert ExceedsWalletLimit();
        if (totalMinted + amount > mintableSupply) revert ExceedsSupply();

        // Check payment (amount is in token units with 18 decimals)
        uint256 cost = amount * mintPrice;
        if (msg.value < cost) revert InsufficientPayment();

        // Update state
        mintedBy[msg.sender] = newMinted;
        totalMinted += amount;

        // Transfer tokens from contract to user
        _transfer(address(this), msg.sender, amount * 1e18);

        // Refund excess BNB
        if (msg.value > cost) {
            (bool ok, ) = msg.sender.call{value: msg.value - cost}("");
            if (!ok) revert TransferFailed();
        }

        emit Minted(msg.sender, amount, cost);
    }

    // ── Finalize ────────────────────────────────────────────────

    /// @notice Create PancakeSwap LP pair after mint ends. Anyone can call.
    function finalize() external nonReentrant {
        if (finalized) revert AlreadyFinalized();
        // Allow finalize if: time ended OR sold out
        if (block.timestamp <= endTime && totalMinted < mintableSupply) revert MintNotComplete();

        finalized = true;

        uint256 totalBNB = address(this).balance;

        // Split BNB: agent 10%, platform 10%, LP 80%
        uint256 agentFee   = (totalBNB * AGENT_FEE_BPS) / 10000;
        uint256 platformFee = (totalBNB * PLATFORM_FEE_BPS) / 10000;
        uint256 lpBNB       = totalBNB - agentFee - platformFee;

        // Pay agent
        if (agentFee > 0) {
            (bool ok1, ) = beneficiary.call{value: agentFee}("");
            if (!ok1) revert TransferFailed();
        }

        // Pay platform
        if (platformFee > 0) {
            (bool ok2, ) = platform.call{value: platformFee}("");
            if (!ok2) revert TransferFailed();
        }

        // Calculate LP token amount — use all reserved LP tokens
        // If not all mintable tokens sold, burn unsold + proportionally reduce LP tokens
        uint256 lpTokenAmount = lpSupply * 1e18;
        if (totalMinted < mintableSupply) {
            // Scale LP tokens proportionally to how much was actually minted
            lpTokenAmount = (lpSupply * totalMinted * 1e18) / mintableSupply;
            // Burn unsold mintable tokens + unused LP tokens
            uint256 unsoldMintable = (mintableSupply - totalMinted) * 1e18;
            uint256 unusedLP = (lpSupply * 1e18) - lpTokenAmount;
            _burn(address(this), unsoldMintable + unusedLP);
        }

        // Approve router to spend LP tokens
        _approve(address(this), router, lpTokenAmount);

        // Add liquidity to PancakeSwap
        IPancakeRouter pancakeRouter = IPancakeRouter(router);
        (, , uint256 liquidity) = pancakeRouter.addLiquidityETH{value: lpBNB}(
            address(this),       // token
            lpTokenAmount,       // amountTokenDesired
            lpTokenAmount * 95 / 100, // 5% slippage tolerance
            lpBNB * 95 / 100,         // 5% slippage tolerance
            address(this),       // LP tokens go to THIS contract (locked forever)
            block.timestamp + 300
        );

        // Get LP pair address
        lpPair = IPancakeFactory(pancakeRouter.factory()).getPair(
            address(this),
            pancakeRouter.WETH()
        );

        emit Finalized(lpPair, liquidity, agentFee, platformFee);
    }

    // ── Views ───────────────────────────────────────────────────

    /// @notice Returns mint progress as (minted, total, isSoldOut, isEnded)
    function mintProgress() external view returns (
        uint256 minted,
        uint256 total,
        bool isSoldOut,
        bool isEnded
    ) {
        return (
            totalMinted,
            mintableSupply,
            totalMinted >= mintableSupply,
            block.timestamp > endTime
        );
    }

    /// @notice Remaining tokens available to mint
    function remaining() external view returns (uint256) {
        return mintableSupply - totalMinted;
    }

    /// @notice How much BNB needed to mint `amount` tokens
    function mintCost(uint256 amount) external view returns (uint256) {
        return amount * mintPrice;
    }

    /// @notice Check if finalize() can be called
    function canFinalize() external view returns (bool) {
        if (finalized) return false;
        return block.timestamp > endTime || totalMinted >= mintableSupply;
    }

    // Prevent accidental BNB sends outside of mint
    receive() external payable {
        revert("use mint()");
    }
}
