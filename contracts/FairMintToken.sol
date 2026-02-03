// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FairMintToken
 * @notice Fixed-price fair mint ERC-20 with auto PancakeSwap LP creation.
 *
 * ALL token amounts in this contract are in wei (18 decimals).
 * Factory converts user-facing "whole token" amounts to wei before deployment.
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
 *   6. If <50% sold → auto refund mode (batch refund by platform)
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

interface IPancakePair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
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

    uint256 public immutable mintPrice;      // BNB per token in wei (price for 1e18 token units)
    uint256 public immutable perWalletLimit;  // max tokens per wallet (in wei)
    uint256 public immutable mintableSupply;  // tokens available for public mint (in wei)
    uint256 public immutable lpSupply;        // tokens reserved for LP (in wei)
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    bool    public immutable agentOnly;       // requires SynthID to mint

    // ── Fee basis points (out of 10000) ─────────────────────────
    uint256 public constant AGENT_FEE_BPS    = 1000; // 10%
    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10%
    uint256 public constant LP_BPS           = 8000; // 80%
    uint256 public constant SOFT_CAP_BPS     = 5000; // 50% minimum sold to finalize
    uint256 public constant MALICIOUS_RESERVE_THRESHOLD = 0.1 ether; // min reserve to consider pair legit

    // ── State ───────────────────────────────────────────────────
    uint256 public totalMinted;              // total tokens minted (in wei)
    mapping(address => uint256) public mintedBy; // per-wallet minted (in wei)
    bool    public finalized;
    address public lpPair;

    // Minter tracking for batch refund
    address[] public minters;
    mapping(address => bool) private isMinter;

    // Emergency refund
    mapping(address => bool) public refundClaimed;
    bool public emergencyMode;
    uint256 public refundPerTokenWei;  // cached BNB refund per 1e18 token wei

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
    error PairHasLiquidity();
    error NotEmergency();
    error AlreadyClaimed();
    error NoMintedTokens();

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupplyWei,   // total tokens in wei (already scaled by 1e18)
        uint256 _mintPrice,        // BNB per whole token in wei (e.g., 0.001 BNB = 1e15)
        uint256 _perWalletLimitWei, // max tokens per wallet in wei
        uint256 _lpRatioBps,       // LP ratio in bps (e.g., 2000 = 20%)
        uint256 _startTime,
        uint256 _endTime,
        address _beneficiary,
        address _platform,
        address _router,
        address _synthID,          // address(0) for public mint
        address _creator
    ) ERC20(_name, _symbol) {
        require(_totalSupplyWei > 0, "zero supply");
        require(_mintPrice > 0, "zero price");
        require(_perWalletLimitWei > 0, "zero limit");
        require(_endTime > _startTime, "bad times");
        // Max 44.44% LP ratio to guarantee listing price >= mint price
        // Math: listingPrice/mintPrice = 0.8*(1-R)/R >= 1 → R <= 0.8/1.8 ≈ 44.44%
        require(_lpRatioBps > 0 && _lpRatioBps <= 4444, "lp ratio 1-44.44%");
        require(_beneficiary != address(0), "zero beneficiary");
        require(_platform != address(0), "zero platform");
        require(_router != address(0), "zero router");

        lpSupply = (_totalSupplyWei * _lpRatioBps) / 10000;
        mintableSupply = _totalSupplyWei - lpSupply;

        mintPrice = _mintPrice;
        perWalletLimit = _perWalletLimitWei;
        startTime = _startTime;
        endTime = _endTime;
        beneficiary = _beneficiary;
        platform = _platform;
        router = _router;
        synthID = _synthID;
        agentOnly = _synthID != address(0);
        creator = _creator;

        // Mint total supply to this contract (already in wei)
        _mint(address(this), _totalSupplyWei);
    }

    // ── Mint ────────────────────────────────────────────────────

    /// @notice Mint tokens at fixed price.
    /// @param amountWei Number of tokens to mint in wei (1 token = 1e18)
    function mint(uint256 amountWei) external payable nonReentrant {
        if (amountWei == 0) revert ZeroAmount();
        if (block.timestamp < startTime) revert MintNotStarted();
        if (block.timestamp > endTime) revert MintEnded();
        if (finalized) revert MintAlreadyFinalized();

        // SynthID gate
        if (agentOnly) {
            if (ISynthID(synthID).balanceOf(msg.sender) == 0) revert SynthIDRequired();
        }

        // Check limits (all in wei)
        uint256 newMinted = mintedBy[msg.sender] + amountWei;
        if (newMinted > perWalletLimit) revert ExceedsWalletLimit();
        if (totalMinted + amountWei > mintableSupply) revert ExceedsSupply();

        // Check payment: cost = (amountWei / 1e18) * mintPrice = amountWei * mintPrice / 1e18
        uint256 cost = (amountWei * mintPrice) / 1e18;
        if (msg.value < cost) revert InsufficientPayment();

        // Track unique minters for batch refund
        if (!isMinter[msg.sender]) {
            isMinter[msg.sender] = true;
            minters.push(msg.sender);
        }

        // Update state
        mintedBy[msg.sender] = newMinted;
        totalMinted += amountWei;

        // Transfer tokens from contract to user (already in wei, no scaling needed)
        _transfer(address(this), msg.sender, amountWei);

        // Refund excess BNB
        if (msg.value > cost) {
            (bool ok, ) = msg.sender.call{value: msg.value - cost}("");
            if (!ok) revert TransferFailed();
        }

        emit Minted(msg.sender, amountWei, cost);
    }

    // ── Finalize ────────────────────────────────────────────────

    /// @notice Create PancakeSwap LP pair after mint ends. Anyone can call.
    /// If less than 50% sold, automatically enters emergency refund mode.
    function finalize() external nonReentrant {
        if (finalized) revert AlreadyFinalized();
        // Allow finalize if: time ended OR sold out
        if (block.timestamp <= endTime && totalMinted < mintableSupply) revert MintNotComplete();

        finalized = true;

        // If nobody minted, just burn all tokens and exit
        if (totalMinted == 0) {
            _burn(address(this), balanceOf(address(this)));
            emit Finalized(address(0), 0, 0, 0);
            return;
        }

        // Soft cap check: if less than 50% sold, enable refund mode instead of LP
        uint256 softCap = (mintableSupply * SOFT_CAP_BPS) / 10000;
        if (totalMinted < softCap) {
            emergencyMode = true;
            if (totalMinted > 0) {
                refundPerTokenWei = (address(this).balance * 1e18) / totalMinted;
            }
            emit Finalized(address(0), 0, 0, 0);
            return;
        }

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

        // Calculate LP token amount (all in wei already)
        uint256 lpTokenAmount = lpSupply;
        if (totalMinted < mintableSupply) {
            // Scale LP tokens proportionally to how much was actually minted
            lpTokenAmount = (lpSupply * totalMinted) / mintableSupply;
            // Burn unsold mintable tokens + unused LP tokens
            uint256 unsoldMintable = mintableSupply - totalMinted;
            uint256 unusedLP = lpSupply - lpTokenAmount;
            _burn(address(this), unsoldMintable + unusedLP);
        }

        // Approve router to spend LP tokens
        _approve(address(this), router, lpTokenAmount);

        IPancakeRouter pancakeRouter = IPancakeRouter(router);
        address weth = pancakeRouter.WETH();
        address factory = pancakeRouter.factory();

        // Anti-DoS: check if pair was maliciously pre-created
        address existingPair = IPancakeFactory(factory).getPair(address(this), weth);
        if (existingPair != address(0)) {
            // Pair exists — check if it has meaningful liquidity
            (uint112 r0, uint112 r1, ) = IPancakePair(existingPair).getReserves();
            uint256 totalReserve = uint256(r0) + uint256(r1);
            // If reserves are tiny (< 0.1 BNB equivalent), it's a malicious placeholder
            // Enter emergency refund mode instead of reverting forever
            if (totalReserve > MALICIOUS_RESERVE_THRESHOLD) {
                revert PairHasLiquidity(); // legit pair exists, something is wrong
            }
            // Malicious low-liquidity pair — enter refund mode
            emergencyMode = true;
            if (totalMinted > 0) {
                refundPerTokenWei = (address(this).balance * 1e18) / totalMinted;
            }
            emit Finalized(address(0), 0, 0, 0);
            return;
        }

        // Add liquidity to PancakeSwap (new pair, no slippage needed)
        (, , uint256 liquidity) = pancakeRouter.addLiquidityETH{value: lpBNB}(
            address(this),       // token
            lpTokenAmount,       // amountTokenDesired
            0,                   // amountTokenMin (new pair, no slippage)
            0,                   // amountETHMin (new pair, no slippage)
            address(this),       // LP tokens go to THIS contract (locked forever)
            block.timestamp + 300
        );

        // Get LP pair address
        lpPair = IPancakeFactory(factory).getPair(address(this), weth);

        emit Finalized(lpPair, liquidity, agentFee, platformFee);
    }

    // ── Emergency Refund ────────────────────────────────────────

    /// @notice Enable emergency mode. Anyone can call after endTime + 7 days if not finalized.
    function enableEmergency() external {
        require(!finalized, "already finalized");
        require(block.timestamp > endTime + 7 days, "too early");
        emergencyMode = true;
        // Cache refund rate so balance changes from partial refunds don't affect later ones
        if (totalMinted > 0 && refundPerTokenWei == 0) {
            refundPerTokenWei = (address(this).balance * 1e18) / totalMinted;
        }
    }

    /// @notice Self-claim refund (user calls themselves).
    function claimRefund() external nonReentrant {
        _refundUser(msg.sender);
    }

    /// @notice Batch push refunds to minters. Anyone can call (platform pays gas).
    /// @param start Start index in minters array
    /// @param end End index (exclusive) in minters array
    function batchRefund(uint256 start, uint256 end) external nonReentrant {
        if (!emergencyMode) revert NotEmergency();
        if (end > minters.length) end = minters.length;
        for (uint256 i = start; i < end; i++) {
            address user = minters[i];
            if (!refundClaimed[user] && mintedBy[user] > 0) {
                _refundUser(user);
            }
        }
    }

    /// @notice Internal: refund a single user
    function _refundUser(address user) internal {
        if (!emergencyMode) revert NotEmergency();
        if (refundClaimed[user]) revert AlreadyClaimed();
        uint256 userMinted = mintedBy[user];
        if (userMinted == 0) revert NoMintedTokens();

        refundClaimed[user] = true;

        // Use cached rate for fairness: refundBNB = userMinted * refundPerTokenWei / 1e18
        uint256 refundBNB = (userMinted * refundPerTokenWei) / 1e18;

        // Burn user's tokens if they still hold them
        uint256 userBalance = balanceOf(user);
        if (userBalance > 0) {
            _burn(user, userBalance);
        }

        // Push BNB refund
        if (refundBNB > 0) {
            (bool ok, ) = user.call{value: refundBNB}("");
            // If push fails (contract recipient rejects), mark as claimed
            // They lose refund — this prevents griefing via revert
            emit Refunded(user, ok ? refundBNB : 0);
        }
    }

    /// @notice Total number of unique minters
    function mintersCount() external view returns (uint256) {
        return minters.length;
    }

    // ── Views ───────────────────────────────────────────────────

    /// @notice Returns mint progress
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

    /// @notice Remaining tokens available to mint (in wei)
    function remaining() external view returns (uint256) {
        return mintableSupply - totalMinted;
    }

    /// @notice How much BNB needed to mint `amountWei` tokens
    function mintCost(uint256 amountWei) external view returns (uint256) {
        return (amountWei * mintPrice) / 1e18;
    }

    /// @notice Check if finalize() can be called
    function canFinalize() external view returns (bool) {
        if (finalized) return false;
        return block.timestamp > endTime || totalMinted >= mintableSupply;
    }

    // Allow BNB from router (LP change refund)
    receive() external payable {
        require(msg.sender == router || msg.sender == address(this), "use mint()");
    }
}
