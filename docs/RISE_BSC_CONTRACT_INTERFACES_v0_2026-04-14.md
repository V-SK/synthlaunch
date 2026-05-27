# RISE 风格 BSC 仿品合约接口草图 v0

**日期**：2026-04-14
**版本**：v0
**状态**：用于 Solidity 接口设计、存储布局设计与测试拆分
**关联规格**： [RISE_BSC_CLONE_SPEC_v1_2026-04-14.md](/Users/narissastreasure/Documents/Playground/anima/synthlaunch/docs/RISE_BSC_CLONE_SPEC_v1_2026-04-14.md)

---

## 1. 目标

本文件把协议规格翻译成可落地的合约接口层，目标是回答以下问题：

- 需要哪些合约
- 每个合约暴露哪些函数
- 哪些字段属于 storage
- 哪些函数负责结算
- 哪些函数只做 quote / view
- 哪些事件和 error 必须存在

这份接口草图默认使用：

- Solidity `0.8.20`
- OZ `Ownable / AccessControl / ReentrancyGuard / Pausable` 体系
- market 级状态集中存放在 `MarketCore`
- position 级状态集中存放在 `PositionManager`

---

## 2. 建议文件布局

建议在 `contracts/` 下新增以下文件：

- `RiseMarketFactory.sol`
- `RiseMarketCore.sol`
- `RisePositionManager.sol`
- `RiseFeeRouter.sol`
- `RiseProtocolConfig.sol`
- `RiseMarketToken.sol`
- `interfaces/IRiseMarketFactory.sol`
- `interfaces/IRiseMarketCore.sol`
- `interfaces/IRisePositionManager.sol`
- `interfaces/IRiseFeeRouter.sol`
- `interfaces/IRiseProtocolConfig.sol`
- `interfaces/IRiseMarketToken.sol`
- `libraries/RiseErrors.sol`
- `libraries/RiseEvents.sol`
- `libraries/RiseTypes.sol`
- `libraries/RiseMath.sol`
- `libraries/RiseFloorMath.sol`
- `libraries/RiseQuoteMath.sol`

如果首版想压缩文件数，也可以先把 `Errors / Events / Types` 合并。

---

## 3. 角色与调用边界

### 3.1 外部用户

外部用户直接调用：

- `createMarket`
- `buy`
- `sell`
- `redeemAtFloor`
- `depositCollateral`
- `borrow`
- `repay`
- `withdrawCollateral`
- `claimCreatorFees`
- 各类 `quote*` / `get*` view

### 3.2 creator

creator 只拥有：

- 读取 market 数据
- 提取 creator accrued fee

creator 不拥有：

- 修改 fee
- 修改 floor
- 修改 curve
- 操作 reserve

### 3.3 governance / timelock

governance + timelock 只允许变更全局可变参数：

- backing asset 白名单
- pause 状态
- implementation 升级
- creation fee
- 默认 cooldown 配置

---

## 4. 核心类型定义

建议统一放在 `RiseTypes.sol`。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library RiseTypes {
    enum MarketStatus {
        Pending,
        Active,
        Paused,
        Deprecated
    }

    struct CurveParams {
        uint256 x2;
        uint256 m1;
        uint256 m2;
        int256 b2;
    }

    struct FeeParams {
        uint16 tradingFeeBps;
        uint16 borrowOriginationFeeBps;
        uint16 creatorShareBps;
        uint16 treasuryShareBps;
        uint16 floorShareBps;
    }

    struct FloorConfig {
        uint256 initialFloorPrice;
        uint256 threshold1;
        uint256 threshold2;
        uint256 threshold3;
        uint256 threshold4;
        uint32 cooldown0;
        uint32 cooldown1;
        uint32 cooldown2;
        uint32 cooldown3;
        uint32 cooldown4;
    }

    struct Market {
        uint256 marketId;
        address token;
        address backingAsset;
        address creator;
        uint64 createdAt;
        uint64 startTime;
        MarketStatus status;
        bool disableSell;
        uint64 disableSellUntil;
        uint8 tokenDecimals;
        uint8 backingDecimals;
        CurveParams curve;
        FeeParams fees;
        FloorConfig floorConfig;
        uint256 initialFloorPrice;
        uint256 currentFloorPrice;
        uint256 currentPrice;
        uint256 totalSupply;
        uint256 reserveBalance;
        uint256 floorReserveAllocated;
        uint256 creatorFeeAccrued;
        uint256 treasuryFeeAccrued;
        uint256 floorFeeAccrued;
        uint256 totalDebt;
        uint256 totalCollateral;
        uint256 netInflows;
        uint64 lastFloorRaiseAt;
    }

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct CreateMarketParams {
        string name;
        string symbol;
        string description;
        string metadataURI;
        string logoURI;
        string[4] socialLinks;
        address backingAsset;
        address creator;
        CurveParams curve;
        FeeParams fees;
        FloorConfig floorConfig;
        uint256 initialFloorPrice;
        uint64 startTime;
        bool disableSellAtLaunch;
        uint64 disableSellUntil;
    }

    struct QuoteResult {
        uint256 backingInOrOut;
        uint256 tokenInOrOut;
        uint256 feeAmount;
        uint256 priceAfter;
        uint256 floorAfter;
    }
}
```

---

## 5. `RiseMarketFactory`

### 5.1 职责

- 创建 market
- 部署 market token
- 注册 marketId
- 校验初始参数
- 收取 creation fee

### 5.2 建议接口

```solidity
interface IRiseMarketFactory {
    function createMarket(
        RiseTypes.CreateMarketParams calldata params
    ) external payable returns (uint256 marketId, address token);

    function totalMarkets() external view returns (uint256);
    function marketExists(uint256 marketId) external view returns (bool);
    function marketToken(uint256 marketId) external view returns (address);
    function marketCreator(uint256 marketId) external view returns (address);
    function getMarketIdsByCreator(address creator) external view returns (uint256[] memory);
}
```

### 5.3 关键校验

- backing asset 必须已白名单
- fee share 三者加总必须等于 `10000`
- `tradingFeeBps == 125` 或在协议允许范围内
- `borrowOriginationFeeBps == 300` 或在协议允许范围内
- `initialFloorPrice > 0`
- `curve` 连续且 `m1 >= m2`
- `startTime >= block.timestamp`
- `disableSellUntil` 不能无限期

### 5.4 建议事件

```solidity
event MarketCreated(
    uint256 indexed marketId,
    address indexed token,
    address indexed creator,
    address backingAsset,
    uint256 initialFloorPrice,
    uint64 startTime
);
```

---

## 6. `RiseMarketToken`

### 6.1 职责

- 每个 market 独立 ERC20
- 仅允许 `MarketCore` mint / burn
- 不允许 creator 或 admin 增发

### 6.2 建议接口

```solidity
interface IRiseMarketToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function marketId() external view returns (uint256);
    function core() external view returns (address);
}
```

### 6.3 实现建议

- 基于 `ERC20`
- 在 constructor 里固化 `marketId` 和 `core`
- 可选 `ERC20Permit`
- 不做 blacklist / freeze

---

## 7. `RiseMarketCore`

### 7.1 职责

- 管理 market 状态
- 执行 `buy`
- 执行 `sell`
- 执行 `redeemAtFloor`
- 处理 floor raise
- 输出 quote

### 7.2 建议接口

```solidity
interface IRiseMarketCore {
    function buy(
        uint256 marketId,
        uint256 backingIn,
        uint256 minTokenOut,
        address receiver
    ) external returns (
        uint256 tokenOut,
        uint256 feeAmount,
        uint256 priceAfter,
        uint256 floorAfter
    );

    function sell(
        uint256 marketId,
        uint256 tokenIn,
        uint256 minBackingOut,
        address receiver
    ) external returns (
        uint256 backingOut,
        uint256 feeAmount,
        uint256 priceAfter,
        uint256 floorAfter
    );

    function redeemAtFloor(
        uint256 marketId,
        uint256 tokenIn,
        uint256 minBackingOut,
        address receiver
    ) external returns (
        uint256 backingOut,
        uint256 feeAmount,
        uint256 floorAfter
    );

    function quoteBuy(
        uint256 marketId,
        uint256 backingIn
    ) external view returns (RiseTypes.QuoteResult memory);

    function quoteSell(
        uint256 marketId,
        uint256 tokenIn
    ) external view returns (RiseTypes.QuoteResult memory);

    function quoteRedeemAtFloor(
        uint256 marketId,
        uint256 tokenIn
    ) external view returns (RiseTypes.QuoteResult memory);

    function maybeRaiseFloor(uint256 marketId) external returns (bool raised, uint256 newFloor);

    function getMarket(uint256 marketId) external view returns (RiseTypes.Market memory);
    function getCurrentPrice(uint256 marketId) external view returns (uint256);
    function getCurrentFloorPrice(uint256 marketId) external view returns (uint256);
    function getReserveBalance(uint256 marketId) external view returns (uint256);
}
```

### 7.3 `buy` 结算顺序建议

1. 校验 market 状态
2. 拉取 backing asset
3. 计算 trading fee
4. 计算净输入
5. 按曲线算 `tokenOut`
6. 校验 `tokenOut >= minTokenOut`
7. mint token
8. 更新 `reserveBalance / totalSupply / currentPrice`
9. 按 fee share 记账
10. 尝试 `maybeRaiseFloor`
11. 发事件

### 7.4 `sell` 结算顺序建议

1. 校验 sell 是否允许
2. 转入 token
3. 先计算曲线毛输出
4. 扣 trading fee
5. 校验 `backingOut >= minBackingOut`
6. burn token
7. 向用户打 backing asset
8. 更新 `reserveBalance / totalSupply / currentPrice`
9. fee 记账
10. 尝试 `maybeRaiseFloor`
11. 发事件

### 7.5 `redeemAtFloor` 结算顺序建议

1. 校验 market 状态允许退出
2. 计算 `grossOut = tokenIn * currentFloorPrice`
3. 计算 redeem fee，或默认复用 `tradingFeeBps`
4. 校验 reserve 足够
5. 校验 `netOut >= minBackingOut`
6. burn token
7. 向用户打 backing asset
8. 更新 `reserveBalance / totalSupply`
9. 发事件

### 7.6 `maybeRaiseFloor` 触发

建议在以下函数末尾调用：

- `buy`
- `sell`
- `borrow`
- `repay`
- `redeemAtFloor`

这样 floor 会随着市场行为自然更新。

### 7.7 关键事件

```solidity
event Bought(
    uint256 indexed marketId,
    address indexed user,
    uint256 backingIn,
    uint256 tokenOut,
    uint256 feeAmount,
    uint256 priceAfter,
    uint256 floorAfter
);

event Sold(
    uint256 indexed marketId,
    address indexed user,
    uint256 tokenIn,
    uint256 backingOut,
    uint256 feeAmount,
    uint256 priceAfter,
    uint256 floorAfter
);

event RedeemedAtFloor(
    uint256 indexed marketId,
    address indexed user,
    uint256 tokenIn,
    uint256 backingOut,
    uint256 feeAmount,
    uint256 floorAfter
);

event FloorRaised(
    uint256 indexed marketId,
    uint256 oldFloor,
    uint256 newFloor,
    uint64 raisedAt
);
```

---

## 8. `RisePositionManager`

### 8.1 职责

- 记录 position
- 托管 collateral token
- 执行 borrow / repay / withdraw
- 保证 debt 不超过 floor value

### 8.2 建议接口

```solidity
interface IRisePositionManager {
    function depositCollateral(
        uint256 marketId,
        uint256 amount,
        address owner
    ) external returns (uint256 newCollateralAmount);

    function borrow(
        uint256 marketId,
        uint256 amount,
        address receiver
    ) external returns (
        uint256 netAmountOut,
        uint256 feeAmount,
        uint256 newDebtAmount
    );

    function repay(
        uint256 marketId,
        uint256 amount,
        address owner
    ) external returns (uint256 remainingDebt);

    function withdrawCollateral(
        uint256 marketId,
        uint256 amount,
        address receiver
    ) external returns (uint256 remainingCollateral);

    function getPosition(
        uint256 marketId,
        address owner
    ) external view returns (RiseTypes.Position memory);

    function maxBorrowable(
        uint256 marketId,
        address owner
    ) external view returns (uint256);

    function availableToBorrow(
        uint256 marketId,
        address owner
    ) external view returns (uint256);
}
```

### 8.3 `borrow` 结算顺序建议

1. 读取 position
2. 读取 `currentFloorPrice`
3. 计算 `maxBorrowable = collateral * floor`
4. 校验 `existingDebt + amount <= maxBorrowable`
5. 计算 `borrowOriginationFee`
6. 校验 market reserve 在支付净额后仍满足安全边界
7. 更新 position debt
8. 更新 market `totalDebt`
9. 通过 `MarketCore` / `FeeRouter` 记账 fee
10. 把净额打给用户
11. 触发 `maybeRaiseFloor`

### 8.4 `repay` 规则

- 不收 repay fee
- 允许部分还款
- 允许在 pause 状态下执行
- 全额还款后允许提取全部 collateral

### 8.5 `withdrawCollateral` 规则

提取后必须满足：

```solidity
remainingDebt <= remainingCollateral * currentFloorPrice
```

### 8.6 关键事件

```solidity
event CollateralDeposited(
    uint256 indexed marketId,
    address indexed user,
    uint256 amount,
    uint256 totalCollateralAfter
);

event Borrowed(
    uint256 indexed marketId,
    address indexed user,
    uint256 borrowAmount,
    uint256 netAmountOut,
    uint256 feeAmount,
    uint256 debtAfter
);

event Repaid(
    uint256 indexed marketId,
    address indexed user,
    uint256 repaidAmount,
    uint256 debtAfter
);

event CollateralWithdrawn(
    uint256 indexed marketId,
    address indexed user,
    uint256 amount,
    uint256 collateralAfter
);
```

---

## 9. `RiseFeeRouter`

### 9.1 职责

- 按比例拆分 trading fee / borrow fee
- 记录 creator / treasury / floor 三类 accrued
- 允许 creator claim
- 向 treasury vault 转可提取金额

### 9.2 建议接口

```solidity
interface IRiseFeeRouter {
    function accrueTradingFee(
        uint256 marketId,
        uint256 feeAmount
    ) external returns (
        uint256 creatorShare,
        uint256 treasuryShare,
        uint256 floorShare
    );

    function accrueBorrowFee(
        uint256 marketId,
        uint256 feeAmount
    ) external returns (
        uint256 creatorShare,
        uint256 treasuryShare,
        uint256 floorShare
    );

    function claimCreatorFees(
        uint256 marketId,
        address receiver
    ) external returns (uint256 amountOut);

    function creatorClaimable(uint256 marketId) external view returns (uint256);
    function treasuryAccrued(uint256 marketId) external view returns (uint256);
    function floorAccrued(uint256 marketId) external view returns (uint256);
}
```

### 9.3 关键约束

- 不能直接从主 reserve 任意打款
- creator claim 只能提取 `creatorFeeAccrued`
- floor share 必须进入 floor backing 账本

---

## 10. `RiseProtocolConfig`

### 10.1 职责

- 管理角色
- 管理 backing asset 白名单
- 管理全局 fee 上限
- 管理 creation fee
- 管理 pause

### 10.2 建议接口

```solidity
interface IRiseProtocolConfig {
    function creationFee() external view returns (uint256);
    function treasuryVault() external view returns (address);
    function timelock() external view returns (address);
    function pauseGuardian() external view returns (address);
    function isBackingAssetAllowed(address asset) external view returns (bool);
    function isMarketPaused(uint256 marketId) external view returns (bool);

    function setBackingAssetAllowed(address asset, bool allowed) external;
    function setCreationFee(uint256 newFee) external;
    function pauseMarket(uint256 marketId) external;
    function unpauseMarket(uint256 marketId) external;
    function pauseAll() external;
    function unpauseAll() external;
}
```

### 10.3 实现建议

- 可用 `AccessControl`
- `pauseMarket` 给 `pauseGuardian`
- `unpauseMarket` 只给 timelock / governance
- backing asset 变更只能通过 timelock

---

## 11. View / Quote 设计

前端真正高频调用的不是写函数，而是 quote 与 dashboard view。建议首版把这些接口做完整。

### 11.1 Market 视图

```solidity
function getMarketSummary(uint256 marketId) external view returns (
    address token,
    address backingAsset,
    address creator,
    RiseTypes.MarketStatus status,
    uint256 currentPrice,
    uint256 currentFloorPrice,
    uint256 totalSupply,
    uint256 reserveBalance,
    uint256 totalDebt,
    uint256 totalCollateral
);
```

### 11.2 用户视图

```solidity
function getUserMarketView(
    uint256 marketId,
    address user
) external view returns (
    uint256 walletTokenBalance,
    uint256 walletBackingBalance,
    uint256 collateralAmount,
    uint256 debtAmount,
    uint256 maxBorrowableAmount,
    uint256 availableToBorrowAmount,
    uint256 creatorClaimableAmount
);
```

### 11.3 Quote 视图

```solidity
function quoteLoopStep(
    uint256 marketId,
    uint256 collateralAmount
) external view returns (
    uint256 maxBorrow,
    uint256 estimatedBuyTokenOut,
    uint256 priceAfter,
    uint256 floorAfter
);
```

这不是首版必须的链上写接口，但对前端体验很重要。

---

## 12. 自定义 Errors

建议单独放在 `RiseErrors.sol`。

```solidity
error NotAuthorized();
error MarketNotFound();
error InvalidMarketStatus();
error MarketNotActive();
error MarketPaused();
error SellDisabled();
error BackingAssetNotAllowed();
error InvalidFeeParams();
error InvalidCurveParams();
error InvalidFloorConfig();
error InvalidStartTime();
error InvalidReceiver();
error SlippageExceeded();
error InsufficientReserve();
error InsufficientFloorBacking();
error InsufficientCollateral();
error DebtExceedsBorrowLimit();
error DebtOutstanding();
error ZeroAmount();
error TransferFailed();
error CooldownNotMet();
error FloorCannotDecrease();
error FeeShareMismatch();
```

---

## 13. 数学实现约束

### 13.1 rounding

进入实现时必须统一以下原则：

- 对用户有利还是对协议有利的 rounding 必须固定
- `buy` 的 tokenOut 建议向下取整
- `sell` / `redeem` 的 backingOut 建议向下取整
- fee 建议向上取整或固定向下，但全协议必须一致

### 13.2 decimals

必须统一内部精度层：

- 建议所有 price 用 `1e18` 定点数
- token amount / backing amount 按原始 decimals 输入输出
- 结算前统一 normalize 到内部精度

### 13.3 floor 上调计算

建议提供：

```solidity
function computeMaxSafeFloor(
    uint256 reserveBalance,
    uint256 totalSupply,
    uint256 totalDebt,
    uint256 unpaidAccruals
) internal pure returns (uint256);
```

这部分在真正实现时必须先出数学说明，不要边写边猜。

---

## 14. 测试拆分建议

为了贴合接口层，测试文件可以先按模块拆：

- `test/RiseMarketFactory.t.sol`
- `test/RiseMarketCore.buySell.t.sol`
- `test/RiseMarketCore.floor.t.sol`
- `test/RisePositionManager.borrowRepay.t.sol`
- `test/RisePositionManager.loop.t.sol`
- `test/RiseFeeRouter.t.sol`
- `test/RiseInvariant.t.sol`
- `test/RiseFuzz.t.sol`

### 14.1 首批必须覆盖的接口测试

1. `createMarket` 参数校验
2. `buy` quote 与实际输出一致
3. `sell` 不突破 reserve
4. `redeemAtFloor` 强制按 floor 退出
5. `borrow` 不超过 `collateral * floor`
6. `repay` 后可解锁 collateral
7. `withdrawCollateral` 不会让 debt 超限
8. `pause` 后仍可 `repay` 与 `redeemAtFloor`

---

## 15. 实现顺序建议

### 15.1 第一阶段

- `RiseTypes`
- `RiseErrors`
- `RiseMarketToken`
- `RiseProtocolConfig`
- `RiseMarketFactory`

### 15.2 第二阶段

- `RiseMath`
- `RiseMarketCore`
- `quoteBuy / quoteSell / quoteRedeemAtFloor`

### 15.3 第三阶段

- `RisePositionManager`
- `RiseFeeRouter`
- floor raise 逻辑

### 15.4 第四阶段

- invariant
- fuzz
- timelock / pause drills

---

## 16. 当前建议结论

如果按这套接口落地，首版合约最关键的不是函数数量，而是三件事先定义清楚：

1. `buy/sell/redeem` 的精确 quote 数学
2. `floorReserveAllocated` 与 `reserveBalance` 的关系
3. `borrow` 后 reserve 安全边界到底怎么算

所以真正开始写 Solidity 前，建议下一份文档直接补：

- `RISE_BSC_SETTLEMENT_MATH_v0.md`

它要把曲线积分、fee、reserve、floor raise、borrow capacity 的公式全写死。没有这份文档，接口是能写，但核心实现会反复返工。
