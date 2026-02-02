// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Flap tax processor interface
interface ITaxProcessor {
    function taxToken() external view returns (address);
}

/**
 * @title SynthLaunchCustody
 * @notice 托管 AI Agent 的 token 交易税费，支持验证后提取，含平台手续费
 * @dev Flap 的 tax fee 是纯 BNB 转账到 beneficiary，合约通过 receive() 接收
 *      owner 通过 recordFee() 从链下扫描后记账，agent 绑定钱包后 claim 提取
 *      平台从每笔 claim 中收取 platformFeeRate/10000 的手续费
 */
contract SynthLaunchCustody is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ 状态变量 ============

    /// @notice 后端签名者地址（用于验证 agent 身份）
    address public signer;

    /// @notice 操作员地址（用于日常操作如 registerToken，避免暴露 owner）
    address public operator;

    /// @notice token 地址 => agent 名称
    mapping(address => string) public tokenAgent;

    /// @notice token 地址 => 累计收到的 fee（由 owner 记账）
    mapping(address => uint256) public tokenFees;

    /// @notice token 地址 => 已提取的 fee
    mapping(address => uint256) public tokenClaimed;

    /// @notice agent 名称 => 绑定的钱包地址
    mapping(string => address) public agentWallet;

    /// @notice 已使用的 nonce（防重放）
    mapping(bytes32 => bool) public usedNonces;

    /// @notice 累计记录的 fee 总额
    uint256 public totalRecorded;

    /// @notice 累计已 claim 的总额
    uint256 public totalClaimedAmount;

    /// @notice 平台手续费率（basis points，10000 = 100%）
    uint256 public platformFeeRate;

    /// @notice 平台手续费余额（可提取）
    uint256 public platformFeeBalance;

    /// @notice token 地址 => 已收取的平台手续费
    mapping(address => uint256) public platformFeeCollected;

    /// @notice 最大平台手续费率 30%
    uint256 public constant MAX_PLATFORM_FEE = 3000;

    // ============ 事件 ============

    event TokenRegistered(address indexed token, string agentName);
    event FeeRecorded(address indexed token, uint256 amount);
    event WalletBound(string indexed agentName, address indexed wallet);
    event FeeClaimed(address indexed token, string agentName, address wallet, uint256 amount);
    event SignerUpdated(address oldSigner, address newSigner);
    event PlatformFeeCollected(address indexed token, uint256 amount);
    event PlatformFeeUpdated(uint256 oldRate, uint256 newRate);
    event PlatformFeeWithdrawn(address to, uint256 amount);
    event EmergencyWithdrawn(address to, uint256 amount);
    event OperatorUpdated(address oldOperator, address newOperator);

    // ============ 构造函数 ============

    /// @notice 仅 operator 或 owner 可调用
    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner(), "Not operator");
        _;
    }

    constructor(address _signer, address _operator, uint256 _platformFeeRate) Ownable(msg.sender) {
        require(_signer != address(0), "Invalid signer");
        require(_operator != address(0), "Invalid operator");
        require(_platformFeeRate <= MAX_PLATFORM_FEE, "Fee too high");
        signer = _signer;
        operator = _operator;
        platformFeeRate = _platformFeeRate;
    }

    // ============ 禁用 renounceOwnership ============

    /// @notice 禁止放弃 owner 权限，防止误操作
    function renounceOwnership() public pure override {
        revert("Disabled");
    }

    // ============ 接收 BNB ============

    /// @notice 接收 fee 时指定 token 地址（如果调用方支持）
    /// @param token 产生 fee 的 token 合约地址
    function receiveFee(address token) external payable {
        require(msg.value > 0, "No fee sent");
        require(bytes(tokenAgent[token]).length > 0, "Token not registered");
        tokenFees[token] += msg.value;
        totalRecorded += msg.value;
        emit FeeRecorded(token, msg.value);
    }

    /// @notice 接收 Flap 自动发的 BNB 转账，自动识别 token 并记账
    /// @dev 调用 msg.sender（Flap tax processor）的 taxToken() 获取 token 地址
    receive() external payable {
        if (msg.value == 0) return;

        // 尝试从 Flap tax processor 获取 token 地址
        try ITaxProcessor(msg.sender).taxToken() returns (address token) {
            if (bytes(tokenAgent[token]).length > 0) {
                tokenFees[token] += msg.value;
                totalRecorded += msg.value;
                emit FeeRecorded(token, msg.value);
            }
            // token 未注册的情况：BNB 留在合约里，可通过 emergencyWithdraw 提取
        } catch {
            // msg.sender 不是 tax processor（普通转账），BNB 留在合约里
        }
    }

    // ============ 管理函数 ============

    /// @notice 注册 token 和对应的 agent（仅 owner）
    /// @param token Token 合约地址
    /// @param agentName Moltbook agent 用户名
    function registerToken(address token, string calldata agentName) external onlyOperator {
        require(token != address(0), "Invalid token");
        require(bytes(agentName).length > 0, "Invalid agent name");
        require(bytes(tokenAgent[token]).length == 0, "Token already registered");

        tokenAgent[token] = agentName;
        emit TokenRegistered(token, agentName);
    }

    /// @notice 批量注册 token
    function registerTokenBatch(
        address[] calldata tokens,
        string[] calldata agentNames
    ) external onlyOperator {
        require(tokens.length == agentNames.length, "Length mismatch");
        for (uint i = 0; i < tokens.length; i++) {
            if (bytes(tokenAgent[tokens[i]]).length == 0 && bytes(agentNames[i]).length > 0) {
                tokenAgent[tokens[i]] = agentNames[i];
                emit TokenRegistered(tokens[i], agentNames[i]);
            }
        }
    }

    /// @notice 取消注册 token（仅在无待 claim 时）
    function unregisterToken(address token) external onlyOwner {
        require(bytes(tokenAgent[token]).length > 0, "Token not registered");
        require(tokenFees[token] == tokenClaimed[token], "Has pending claims");
        delete tokenAgent[token];
        delete tokenFees[token];
        delete tokenClaimed[token];
        delete platformFeeCollected[token];
    }

    /// @notice 更新签名者地址
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    /// @notice 更新操作员地址（仅 owner）
    function setOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator");
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }

    /// @notice 更新平台手续费率
    function setPlatformFeeRate(uint256 _rate) external onlyOwner {
        require(_rate <= MAX_PLATFORM_FEE, "Fee too high");
        emit PlatformFeeUpdated(platformFeeRate, _rate);
        platformFeeRate = _rate;
    }

    // ============ Agent 绑定钱包 ============

    /// @notice Agent 绑定提款钱包（需要后端签名）
    /// @param agentName Moltbook 用户名
    /// @param wallet 要绑定的 BSC 钱包地址
    /// @param nonce 唯一标识符（防重放）
    /// @param signature 后端签名
    function bindWallet(
        string calldata agentName,
        address wallet,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(wallet != address(0), "Invalid wallet");
        require(!usedNonces[nonce], "Nonce already used");
        require(agentWallet[agentName] == address(0), "Wallet already bound");

        // 验证签名
        bytes32 messageHash = keccak256(abi.encodePacked(
            "SynthLaunch:BindWallet",
            address(this),
            agentName,
            wallet,
            nonce,
            block.chainid
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        require(recovered == signer, "Invalid signature");

        usedNonces[nonce] = true;
        agentWallet[agentName] = wallet;

        emit WalletBound(agentName, wallet);
    }

    /// @notice 更换绑定的钱包（需要当前钱包调用 + 后端签名）
    /// @param agentName Moltbook 用户名
    /// @param newWallet 新钱包地址
    /// @param nonce 唯一标识符（防重放）
    /// @param signature 后端签名
    function rebindWallet(
        string calldata agentName,
        address newWallet,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(msg.sender == agentWallet[agentName], "Not current wallet");
        require(newWallet != address(0), "Invalid wallet");
        require(!usedNonces[nonce], "Nonce already used");

        bytes32 messageHash = keccak256(abi.encodePacked(
            "SynthLaunch:RebindWallet",
            address(this),
            agentName,
            newWallet,
            nonce,
            block.chainid
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        require(ethSignedHash.recover(signature) == signer, "Invalid signature");

        usedNonces[nonce] = true;
        agentWallet[agentName] = newWallet;

        emit WalletBound(agentName, newWallet);
    }

    // ============ Claim Fee ============

    /// @notice Agent 提取 token 的累计 fee（扣除平台手续费）
    /// @param token Token 地址
    function claim(address token) external nonReentrant {
        string memory agentName = tokenAgent[token];
        require(bytes(agentName).length > 0, "Token not registered");

        address wallet = agentWallet[agentName];
        require(wallet != address(0), "Wallet not bound");
        require(msg.sender == wallet, "Not authorized");

        uint256 amount = tokenFees[token] - tokenClaimed[token];
        require(amount > 0, "Nothing to claim");

        tokenClaimed[token] += amount;
        totalClaimedAmount += amount;

        // 计算平台手续费
        uint256 fee = amount * platformFeeRate / 10000;
        uint256 alreadyCollected = platformFeeCollected[token];
        uint256 newFee = fee > alreadyCollected ? fee - alreadyCollected : 0;
        platformFeeBalance += newFee;
        platformFeeCollected[token] = 0;

        uint256 payout = amount - fee;

        (bool success, ) = wallet.call{value: payout}("");
        require(success, "Transfer failed");

        emit FeeClaimed(token, agentName, wallet, amount);
    }

    /// @notice 批量 claim 多个 token（扣除平台手续费）
    function claimBatch(address[] calldata tokens) external nonReentrant {
        require(tokens.length <= 20, "Too many tokens");
        for (uint i = 0; i < tokens.length; i++) {
            string memory agentName = tokenAgent[tokens[i]];
            if (bytes(agentName).length == 0) continue;

            address wallet = agentWallet[agentName];
            if (wallet == address(0) || msg.sender != wallet) continue;

            uint256 amount = tokenFees[tokens[i]] - tokenClaimed[tokens[i]];
            if (amount == 0) continue;

            tokenClaimed[tokens[i]] += amount;
            totalClaimedAmount += amount;

            // 计算平台手续费
            uint256 fee = amount * platformFeeRate / 10000;
            uint256 alreadyCollected = platformFeeCollected[tokens[i]];
            uint256 newFee = fee > alreadyCollected ? fee - alreadyCollected : 0;
            platformFeeBalance += newFee;
            platformFeeCollected[tokens[i]] = 0;

            uint256 payout = amount - fee;

            (bool success, ) = wallet.call{value: payout}("");
            require(success, "Transfer failed");
            emit FeeClaimed(tokens[i], agentName, wallet, amount);
        }
    }

    // ============ 平台手续费 ============

    /// @notice 收取单个 token 的平台手续费（预扣）
    function collectPlatformFee(address token) external onlyOwner nonReentrant {
        require(bytes(tokenAgent[token]).length > 0, "Token not registered");

        uint256 amount = tokenFees[token] - tokenClaimed[token];
        uint256 fee = amount * platformFeeRate / 10000;
        uint256 alreadyCollected = platformFeeCollected[token];
        uint256 newFee = fee > alreadyCollected ? fee - alreadyCollected : 0;

        require(newFee > 0, "Nothing to collect");

        platformFeeCollected[token] += newFee;
        platformFeeBalance += newFee;

        emit PlatformFeeCollected(token, newFee);
    }

    /// @notice 批量收取平台手续费
    function collectPlatformFeeBatch(address[] calldata tokens) external onlyOwner nonReentrant {
        require(tokens.length <= 20, "Too many tokens");
        for (uint i = 0; i < tokens.length; i++) {
            if (bytes(tokenAgent[tokens[i]]).length == 0) continue;

            uint256 amount = tokenFees[tokens[i]] - tokenClaimed[tokens[i]];
            uint256 fee = amount * platformFeeRate / 10000;
            uint256 alreadyCollected = platformFeeCollected[tokens[i]];
            uint256 newFee = fee > alreadyCollected ? fee - alreadyCollected : 0;

            if (newFee == 0) continue;

            platformFeeCollected[tokens[i]] += newFee;
            platformFeeBalance += newFee;

            emit PlatformFeeCollected(tokens[i], newFee);
        }
    }

    /// @notice 提取平台手续费
    function withdrawPlatformFee(address to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(platformFeeBalance > 0, "No fees to withdraw");

        uint256 amount = platformFeeBalance;
        platformFeeBalance = 0;

        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");

        emit PlatformFeeWithdrawn(to, amount);
    }

    // ============ 查询函数 ============

    /// @notice 查询 token 可提取金额（未扣 fee）
    function claimable(address token) external view returns (uint256) {
        return tokenFees[token] - tokenClaimed[token];
    }

    /// @notice 查询扣除平台手续费后的可提取金额
    function claimableAfterFee(address token) external view returns (uint256 payout, uint256 fee) {
        uint256 amount = tokenFees[token] - tokenClaimed[token];
        fee = amount * platformFeeRate / 10000;
        payout = amount - fee;
    }

    /// @notice 查询 agent 的所有 token 可提取总额
    /// @dev 需要传入 token 列表（链下查询后传入）
    function claimableTotal(
        string calldata agentName,
        address[] calldata tokens
    ) external view returns (uint256 total) {
        for (uint i = 0; i < tokens.length; i++) {
            if (keccak256(bytes(tokenAgent[tokens[i]])) == keccak256(bytes(agentName))) {
                total += tokenFees[tokens[i]] - tokenClaimed[tokens[i]];
            }
        }
    }

    /// @notice 查询 agent 是否已绑定钱包
    function isWalletBound(string calldata agentName) external view returns (bool) {
        return agentWallet[agentName] != address(0);
    }

    /// @notice 查询 agent 绑定的钱包地址
    function getAgentWallet(string calldata agentName) external view returns (address) {
        return agentWallet[agentName];
    }

    /// @notice 查询 token 的完整信息
    function getTokenInfo(address token) external view returns (
        string memory agentName,
        uint256 totalFees,
        uint256 claimed,
        uint256 pendingClaim,
        address wallet
    ) {
        agentName = tokenAgent[token];
        totalFees = tokenFees[token];
        claimed = tokenClaimed[token];
        pendingClaim = totalFees - claimed;
        wallet = agentWallet[agentName];
    }

    // ============ 紧急函数 ============

    /// @notice 紧急提取未记录的多余 BNB（仅 owner）
    function emergencyWithdraw(address to) external onlyOwner {
        uint256 unclaimed = totalRecorded - totalClaimedAmount;
        uint256 accounted = platformFeeBalance + unclaimed;
        uint256 excess = address(this).balance > accounted ? address(this).balance - accounted : 0;

        require(to != address(0), "Invalid address");
        require(excess > 0, "No unrecorded funds");

        (bool success, ) = to.call{value: excess}("");
        require(success, "Transfer failed");

        emit EmergencyWithdrawn(to, excess);
    }
}
