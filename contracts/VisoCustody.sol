// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VisoCustody
 * @notice 托管合约 - 接收发币税收，创作者 80% / 平台 20%
 * @dev 内置 48 小时 Timelock 保护关键操作
 * @dev 创作者通过发币入口自动注册，无需签名验证
 */
contract VisoCustody is Ownable, ReentrancyGuard {
    
    uint256 public constant CREATOR_SHARE_BPS = 8000; // 80%
    uint256 public constant PLATFORM_SHARE_BPS = 2000; // 20%
    uint256 public constant TIMELOCK_DELAY = 48 hours;
    
    // 代币地址 => 创作者地址
    mapping(address => address) public tokenCreator;
    
    // 代币地址 => 创作者提款钱包
    mapping(address => address) public tokenWallet;
    
    // 代币地址 => 累计收入
    mapping(address => uint256) public tokenTotalReceived;
    
    // 代币地址 => 创作者已领取
    mapping(address => uint256) public tokenCreatorClaimed;
    
    // 平台已领取总额
    uint256 public platformClaimed;
    
    // 平台总收入 (20%)
    uint256 public platformTotalEarned;
    
    // 平台钱包
    address public platformWallet;
    
    // Timelock: 待生效的平台钱包变更
    address public pendingPlatformWallet;
    uint256 public pendingPlatformWalletTime;
    
    event CreatorRegistered(address indexed token, address indexed creator, address indexed wallet);
    event WalletUpdated(address indexed token, address indexed oldWallet, address indexed newWallet);
    event FeeReceived(address indexed token, uint256 amount);
    event CreatorClaimed(address indexed token, address indexed creator, uint256 amount);
    event PlatformClaimed(address indexed to, uint256 amount);
    event PlatformWalletChangeProposed(address oldWallet, address newWallet, uint256 effectiveTime);
    event PlatformWalletChangeExecuted(address newWallet);
    event PlatformWalletChangeCancelled();
    
    constructor(address _platformWallet) Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
    }
    
    /**
     * @notice 接收 BNB (税收)
     */
    receive() external payable {}
    
    // ============ 创作者注册 ============
    
    /**
     * @notice 注册创作者 (发币时自动调用)
     * @dev 只有 owner 可以调用，前端发币成功后自动注册
     * @param token 代币地址
     * @param creator 创作者地址
     * @param wallet 提款钱包 (建议使用 EOA，不要用合约地址)
     */
    function registerCreator(
        address token,
        address creator,
        address wallet
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(creator != address(0), "Invalid creator");
        require(wallet != address(0), "Invalid wallet");
        require(tokenCreator[token] == address(0), "Already registered");
        
        tokenCreator[token] = creator;
        tokenWallet[token] = wallet;
        
        emit CreatorRegistered(token, creator, wallet);
    }
    
    /**
     * @notice 创作者更新提款钱包
     * @param token 代币地址
     * @param newWallet 新钱包地址
     */
    function updateWallet(address token, address newWallet) external {
        require(tokenCreator[token] == msg.sender, "Not creator");
        require(newWallet != address(0), "Invalid wallet");
        
        address oldWallet = tokenWallet[token];
        tokenWallet[token] = newWallet;
        
        emit WalletUpdated(token, oldWallet, newWallet);
    }
    
    // ============ 税收记录 ============
    
    /**
     * @notice 记录某个代币的税收收入
     * @param token 代币地址
     * @param amount 金额
     */
    function recordFee(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        
        tokenTotalReceived[token] += amount;
        platformTotalEarned += (amount * PLATFORM_SHARE_BPS) / 10000;
        
        emit FeeReceived(token, amount);
    }
    
    /**
     * @notice 批量记录税收 (节省 gas)
     */
    function recordFeeBatch(
        address[] calldata tokens, 
        uint256[] calldata amounts
    ) external onlyOwner {
        require(tokens.length == amounts.length, "Length mismatch");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0) && amounts[i] > 0) {
                tokenTotalReceived[tokens[i]] += amounts[i];
                platformTotalEarned += (amounts[i] * PLATFORM_SHARE_BPS) / 10000;
                emit FeeReceived(tokens[i], amounts[i]);
            }
        }
    }
    
    // ============ 领取收益 ============
    
    /**
     * @notice 创作者领取收益
     * @param token 代币地址
     */
    function claim(address token) external nonReentrant {
        address creator = tokenCreator[token];
        require(creator == msg.sender, "Not creator");
        
        address wallet = tokenWallet[token];
        require(wallet != address(0), "Wallet not set");
        
        uint256 totalReceived = tokenTotalReceived[token];
        uint256 creatorTotal = (totalReceived * CREATOR_SHARE_BPS) / 10000;
        uint256 claimed = tokenCreatorClaimed[token];
        uint256 pending = creatorTotal - claimed;
        
        require(pending > 0, "Nothing to claim");
        require(address(this).balance >= pending, "Insufficient balance");
        
        // 先更新状态，再转账 (防重入)
        tokenCreatorClaimed[token] = creatorTotal;
        
        (bool success, ) = wallet.call{value: pending}("");
        require(success, "Transfer failed");
        
        emit CreatorClaimed(token, creator, pending);
    }
    
    /**
     * @notice 平台领取收益
     */
    function claimPlatform() external onlyOwner nonReentrant {
        uint256 pending = platformTotalEarned - platformClaimed;
        require(pending > 0, "Nothing to claim");
        require(address(this).balance >= pending, "Insufficient balance");
        
        // 先更新状态，再转账 (防重入)
        platformClaimed = platformTotalEarned;
        
        (bool success, ) = platformWallet.call{value: pending}("");
        require(success, "Transfer failed");
        
        emit PlatformClaimed(platformWallet, pending);
    }
    
    // ============ 查询函数 ============
    
    /**
     * @notice 查询创作者待领取金额
     */
    function pendingCreator(address token) external view returns (uint256) {
        uint256 totalReceived = tokenTotalReceived[token];
        uint256 creatorTotal = (totalReceived * CREATOR_SHARE_BPS) / 10000;
        return creatorTotal - tokenCreatorClaimed[token];
    }
    
    /**
     * @notice 查询平台待领取金额
     */
    function pendingPlatform() external view returns (uint256) {
        return platformTotalEarned - platformClaimed;
    }
    
    /**
     * @notice 查询代币信息
     */
    function getTokenInfo(address token) external view returns (
        address creator,
        address wallet,
        uint256 totalReceived,
        uint256 creatorClaimed,
        uint256 creatorPending
    ) {
        creator = tokenCreator[token];
        wallet = tokenWallet[token];
        totalReceived = tokenTotalReceived[token];
        creatorClaimed = tokenCreatorClaimed[token];
        uint256 creatorTotal = (totalReceived * CREATOR_SHARE_BPS) / 10000;
        creatorPending = creatorTotal - creatorClaimed;
    }
    
    // ============ Timelock 管理 ============
    
    /**
     * @notice 提议更新平台钱包 (48小时后生效)
     */
    function proposePlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid wallet");
        require(pendingPlatformWalletTime == 0, "Pending change exists");
        
        pendingPlatformWallet = newWallet;
        pendingPlatformWalletTime = block.timestamp + TIMELOCK_DELAY;
        
        emit PlatformWalletChangeProposed(platformWallet, newWallet, pendingPlatformWalletTime);
    }
    
    /**
     * @notice 执行平台钱包变更
     */
    function executePlatformWalletChange() external onlyOwner {
        require(pendingPlatformWalletTime != 0, "No pending change");
        require(block.timestamp >= pendingPlatformWalletTime, "Timelock not expired");
        
        platformWallet = pendingPlatformWallet;
        
        delete pendingPlatformWallet;
        delete pendingPlatformWalletTime;
        
        emit PlatformWalletChangeExecuted(platformWallet);
    }
    
    /**
     * @notice 取消平台钱包变更
     */
    function cancelPlatformWalletChange() external onlyOwner {
        require(pendingPlatformWalletTime != 0, "No pending change");
        
        delete pendingPlatformWallet;
        delete pendingPlatformWalletTime;
        
        emit PlatformWalletChangeCancelled();
    }
    
    // ============ 紧急操作 ============
    
    /**
     * @notice 紧急提款 (仅 owner)
     * @dev 建议将 owner 设为多签钱包
     */
    function emergencyWithdraw(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        (bool success, ) = to.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
}
