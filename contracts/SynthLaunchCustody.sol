// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SynthLaunchCustody
 * @notice 托管 AI Agent 的 token 交易税费，支持验证后提取
 * @dev Flap 的 tax fee 是纯 BNB 转账到 beneficiary，合约通过 receive() 接收
 *      owner 通过 recordFee() 从链下扫描后记账，agent 绑定钱包后 claim 提取
 */
contract SynthLaunchCustody is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ 状态变量 ============

    /// @notice 后端签名者地址（用于验证 agent 身份）
    address public signer;

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

    // ============ 事件 ============

    event TokenRegistered(address indexed token, string agentName);
    event FeeRecorded(address indexed token, uint256 amount);
    event WalletBound(string agentName, address wallet);
    event FeeClaimed(address indexed token, string agentName, address wallet, uint256 amount);
    event SignerUpdated(address oldSigner, address newSigner);

    // ============ 构造函数 ============

    constructor(address _signer) Ownable(msg.sender) {
        require(_signer != address(0), "Invalid signer");
        signer = _signer;
    }

    // ============ 接收 BNB ============

    /// @notice 接收 fee 时指定 token 地址（如果调用方支持）
    /// @param token 产生 fee 的 token 合约地址
    function receiveFee(address token) external payable {
        require(msg.value > 0, "No fee sent");
        require(bytes(tokenAgent[token]).length > 0, "Token not registered");
        tokenFees[token] += msg.value;
        emit FeeRecorded(token, msg.value);
    }

    /// @notice 接收 Flap 自动发的纯 BNB 转账（无法区分 token）
    /// @dev BNB 存在合约里，由 owner 通过 recordFee 记账归属到具体 token
    receive() external payable {}

    // ============ Owner 记账 ============

    /// @notice 后端扫链后记账（BNB 已在合约里，只更新映射）
    /// @param token Token 合约地址
    /// @param amount 这笔 fee 的金额（wei）
    function recordFee(address token, uint256 amount) external onlyOwner {
        require(bytes(tokenAgent[token]).length > 0, "Token not registered");
        tokenFees[token] += amount;
        emit FeeRecorded(token, amount);
    }

    /// @notice 批量记账
    function recordFeeBatch(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(tokens.length == amounts.length, "Length mismatch");
        for (uint i = 0; i < tokens.length; i++) {
            if (bytes(tokenAgent[tokens[i]]).length > 0) {
                tokenFees[tokens[i]] += amounts[i];
                emit FeeRecorded(tokens[i], amounts[i]);
            }
        }
    }

    // ============ 管理函数 ============

    /// @notice 注册 token 和对应的 agent（仅 owner）
    /// @param token Token 合约地址
    /// @param agentName Moltbook agent 用户名
    function registerToken(address token, string calldata agentName) external onlyOwner {
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
    ) external onlyOwner {
        require(tokens.length == agentNames.length, "Length mismatch");
        for (uint i = 0; i < tokens.length; i++) {
            if (bytes(tokenAgent[tokens[i]]).length == 0 && bytes(agentNames[i]).length > 0) {
                tokenAgent[tokens[i]] = agentNames[i];
                emit TokenRegistered(tokens[i], agentNames[i]);
            }
        }
    }

    /// @notice 更新签名者地址
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
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

    /// @notice Agent 提取 token 的累计 fee
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

        (bool success, ) = wallet.call{value: amount}("");
        require(success, "Transfer failed");

        emit FeeClaimed(token, agentName, wallet, amount);
    }

    /// @notice 批量 claim 多个 token
    function claimBatch(address[] calldata tokens) external nonReentrant {
        for (uint i = 0; i < tokens.length; i++) {
            string memory agentName = tokenAgent[tokens[i]];
            if (bytes(agentName).length == 0) continue;

            address wallet = agentWallet[agentName];
            if (wallet == address(0) || msg.sender != wallet) continue;

            uint256 amount = tokenFees[tokens[i]] - tokenClaimed[tokens[i]];
            if (amount == 0) continue;

            tokenClaimed[tokens[i]] += amount;

            (bool success, ) = wallet.call{value: amount}("");
            if (success) {
                emit FeeClaimed(tokens[i], agentName, wallet, amount);
            }
        }
    }

    // ============ 查询函数 ============

    /// @notice 查询 token 可提取金额
    function claimable(address token) external view returns (uint256) {
        return tokenFees[token] - tokenClaimed[token];
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

    /// @notice 紧急提取（仅 owner，用于合约升级或紧急情况）
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
