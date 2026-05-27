# RISE 风格 BSC 仿品协议规格 v1

**日期**：2026-04-14
**版本**：v1
**状态**：可用于进入接口设计与原型开发
**定位**：在 **BSC** 上实现一个与 `rise.rich` 公开机制高度相似的协议型产品，但不复用其品牌、视觉素材与文案。
**说明**：本文件不是白皮书，而是产品、合约、前端、测试、审计共用的实现规格。它基于以下两类输入整理而成：

- 现有内部文档 `bsc_protocol_spec_v0_2026-04-14.md`
- `RISE` 公开可见资料与文档页面

公开参考：

- [Introduction](https://docs.rise.rich/introduction)
- [Floor Price Mechanism](https://docs.rise.rich/protocol/floor-mechanism)
- [Bonding Curve](https://docs.rise.rich/protocol/bonding-curve)
- [Borrows & Loops](https://docs.rise.rich/protocol/borrows-and-loops)
- [Fee Structure](https://docs.rise.rich/protocol/fees)
- [Backing Tokens](https://docs.rise.rich/protocol/backing-tokens)
- [Create a Token](https://docs.rise.rich/guides/create-token)
- [Buy & Sell Tokens](https://docs.rise.rich/guides/buy-sell)
- [Borrow Against Your Tokens](https://docs.rise.rich/guides/borrow)

---

## 1. 产品目标

本产品的目标不是做一个普通发币页，而是在 **BSC** 上做一个与 `RISE` 公开机制对齐的 launchpad / trading / borrowing 一体化协议：

- permissionless `createMarket`
- 协议作为唯一对手方的 `buy` / `sell`
- 协议强制执行的 `floor price`
- 从 token 上线第一秒即可用的 `deposit + borrow`
- 无持续利息、无 liquidation engine 的借贷模型
- 用户可进行 `borrow -> buy more -> borrow again` 的 loop
- creator / protocol / floor 三方分账
- 全部流动性由协议持有，不依赖外部 LP

本产品不是：

- 只做营销站
- 外部 DEX 的路由器
- 靠外部预言机驱动的抵押借贷协议
- 可让管理员抽走 market reserve 的中心化托管系统

---

## 2. 首版对齐原则

### 2.1 对齐对象

首版要优先对齐 `RISE` 的公开可见产品核心，而不是自由发挥更多机制：

- floor 永不下降
- elastic supply：买入 mint、卖出 burn
- 协议是唯一对手方
- borrow 按 floor value 而不是 market value
- 无 liquidation
- 无持续 interest
- 交易 fee 和 borrow fee 持续反哺 floor
- token market 彼此隔离，互不共担风险

### 2.2 首版不做

以下内容不进入首版：

- referral
- points
- 排行榜
- 社交任务系统
- 多曲线治理切换
- 外部 LP 迁移
- 外部清算人网络
- 跨市场共享 reserve

---

## 3. BSC 版本范围

### 3.1 支持链

- `BSC Mainnet`

### 3.2 backing asset

每个 market 只能选择一个 backing asset，创建后不可修改。

首版建议白名单：

- `WBNB`
- `USDT`

首发策略建议：

- 第一阶段只开放 `WBNB`
- 稳定后再加 `USDT`

说明：

- 这对应 `RISE` 在 Solana 上的 `SOL / USDC` 二选一心智
- floor 始终以 backing asset 计价，不做协议内 USD 换算保证

---

## 4. 核心机制摘要

### 4.1 market 机制

每个 `Market` 都是一个独立池子，包含：

- 一种 market token
- 一种 backing asset
- 一条 bonding curve
- 一套 floor 状态
- 一组 reserve / fee / debt / collateral 账本

每个 market 独立结算：

- 不共享 reserve
- 不共享 debt
- 不互相承担 floor 偿付责任

### 4.2 elastic supply

协议采用 elastic supply 模型：

- `buy`：用户支付 backing asset，协议按曲线 mint 新 token
- `sell`：用户卖出 token，协议按规则 burn token 并返还 backing asset

这意味着：

- 协议一直持有支撑 supply 的核心流动性
- 不依赖外部 LP
- floor 可以被协议直接执行

### 4.3 sole counterparty

协议是以下动作的唯一对手方：

- `buy`
- `sell`
- `redeemAtFloor`
- `borrow`
- `repay`

这条原则必须在架构上保持成立，否则 floor 与无 liquidation borrow 的叙事会失真。

---

## 5. 合约模块

首版建议采用以下模块：

1. `MarketFactory`
   - 创建市场
   - 部署 market token
   - 校验 market 参数

2. `MarketCore`
   - 持有 market 主状态
   - 处理 `buy` / `sell` / `redeemAtFloor`
   - 维护 reserve、supply、floor、费用累计

3. `PositionManager`
   - 处理 `depositCollateral`
   - 处理 `borrow`
   - 处理 `repay`
   - 处理 `withdrawCollateral`

4. `FeeRouter`
   - 记录 creator accrued
   - 记录 treasury accrued
   - 记录 floor accrued
   - 处理 creator claim

5. `ProtocolConfig`
   - 存储全局 fee 上限
   - 存储 backing asset 白名单
   - 存储 floor cooldown 配置
   - 存储 pause 配置与角色地址

6. `TreasuryVault`
   - 接收 treasury 可提取收入

7. `TimelockController`
   - 承载治理变更与升级

---

## 6. Market 状态与字段

### 6.1 Market 基础字段

每个 `Market` 至少包含：

- `marketId`
- `token`
- `backingAsset`
- `creator`
- `createdAt`
- `status`
- `tokenDecimals`
- `backingDecimals`
- `curveParams`
- `initialFloorPrice`
- `currentFloorPrice`
- `currentPrice`
- `totalSupply`
- `reserveBalance`
- `floorReserveAllocated`
- `creatorFeeAccrued`
- `treasuryFeeAccrued`
- `floorFeeAccrued`
- `totalDebt`
- `totalCollateral`
- `netInflows`
- `floorRaiseCooldownSeconds`
- `lastFloorRaiseAt`
- `disableSellUntil`

### 6.2 Market 状态

每个 market 只允许处于以下状态之一：

- `Pending`
- `Active`
- `Paused`
- `Deprecated`

### 6.3 Paused 边界

`Paused` 状态下必须允许：

- `repay`
- `withdrawCollateral`，前提是仍满足借款约束
- `redeemAtFloor`，前提是协议 reserve 允许
- `claimCreatorFees`

`Paused` 状态下禁止：

- `createMarket`
- `buy`
- `borrow`
- 任何增加协议新增风险敞口的动作

---

## 7. Token 创建模型

### 7.1 createMarket 输入

首版最少包括：

- `name`
- `symbol`
- `description`
- `metadataURI`
- `logoURI`
- `socialLinks`
- `backingAsset`
- `creator`
- `curveParams`
- `initialFloorPrice`
- `startTime`
- `disableSellAtLaunch`

### 7.2 createMarket 约束

必须校验：

- `backingAsset` 在白名单内
- `initialFloorPrice > 0`
- `curveParams` 合法且连续
- 名称与 symbol 长度合法
- metadata 一经创建不可修改核心字段
- 一个 market 的 backing asset 创建后不可更改

### 7.3 创建费用

首版对齐 `RISE` 公开心智，采用固定 creation fee：

- 费用进入 `TreasuryVault`
- 不进入 floor
- 用于 anti-spam 与平台运营

具体数值：

- 以 `WBNB` 计价，后台可配置
- 前端显示为接近固定金额，而不是百分比

---

## 8. 定价与曲线模型

### 8.1 目标

首版使用易审计、可解释的单一曲线族，而不是复杂动态治理曲线。

### 8.2 关键性质

曲线必须满足：

- `buy` 过程中价格随 supply 上升
- `sell` 过程中价格随 supply 下降
- 任意时刻 `currentPrice >= currentFloorPrice`
- 曲线与 floor 组合后可计算确定性 quote

### 8.3 结算方向

`buy`：

- 用户输入 backing asset
- 扣除 trading fee
- 协议按曲线 mint token
- reserve 增加

`sell`：

- 用户输入 token
- 协议 burn token
- 按曲线返还 backing asset
- 对输出侧扣除 trading fee
- reserve 减少

### 8.4 slippage

必须支持：

- `buy(marketId, backingIn, minTokenOut)`
- `sell(marketId, tokenIn, minBackingOut)`
- `redeemAtFloor(marketId, tokenIn, minBackingOut)`

---

## 9. Floor 模型

### 9.1 定义

`floor` 是协议承诺可执行的最低赎回价格，不是营销概念。

它必须：

- 可被链上验证
- 被 reserve 覆盖
- 永不下降
- 参与 borrow 上限计算

### 9.2 对齐 `RISE` 的核心语义

首版必须遵守：

- floor 覆盖流通中的每一枚 token
- 即使所有 token 同时按 floor 退出，协议也不应失去偿付能力
- floor 只能在协议验证有足够 reserve 后上升

### 9.3 floor 的增长来源

只允许以下来源推动 floor：

- 市场流动性自然积累后可安全重分配的 reserve
- trading fee 中分配给 floor 的部分
- borrow fee 中分配给 floor 的部分
- 明确定义的 donation

禁止：

- admin 手工改 floor 数值
- 无资金支撑的人为拉升

### 9.4 floor raise 触发机制

首版采用与 `RISE` 公开文档一致的分阶段机制：

1. 早期保护阶段
   - 当 `netInflows < threshold1` 时
   - 只要存在足够 reserve 支撑更高 floor，就立即 raise

2. 成熟阶段
   - 当 `netInflows >= threshold1` 时
   - floor 按 cooldown 节奏提升，每次提升至当前“可安全提升的最大值”

建议默认阈值：

- `threshold1 = 100_000 USD equivalent` 的 backing asset 内部换算目标

如果首版不想引入链上 USD 换算，则替代做法是：

- 部署时为不同 backing asset 分别配置等效阈值常量

### 9.5 cooldown 规则

为贴近 `RISE` 公开规则，建议：

- 前 `100k` 净流入：`0s`
- `100k - 200k`：`30s`
- `200k - 300k`：`60s`
- `300k - 400k`：`90s`
- `>= 400k`：`120s`

如果 BSC 首版希望更简单，可先用：

- `0s / 30s / 60s / 120s` 四档

但前端与文档必须统一，不要一边宣传“照抄”，一边实现明显不同规则。

### 9.6 redeemAtFloor

首版将 `redeemAtFloor` 定义为必选接口，而不是可选增强：

- 它与普通 `sell` 区分
- 它按 floor 价格结算
- 它是 floor guarantee 的显式执行通道

### 9.7 floor 不变量

任意时刻必须满足：

1. `currentFloorPrice >= initialFloorPrice`
2. `currentPrice >= currentFloorPrice`
3. `floorPrice` 不下降
4. `floor redemption obligation <= floor-backed reserve capacity`

---

## 10. Reserve 与偿付模型

### 10.1 reserve 定义

`reserveBalance` 表示 market 当前持有的 backing asset 数量。

### 10.2 reserve 的用途

reserve 用于：

- `sell` 支付
- `redeemAtFloor` 支付
- `borrow` 放款

### 10.3 reserve 分层

为避免语义混乱，首版建议把 reserve 明确拆成三个逻辑层：

- `floor backing reserve`
- `free trading liquidity`
- `unpaid treasury/creator accrual`

链上可以不物理分仓，但账本上必须能区分。

### 10.4 偿付原则

协议必须优先满足：

- 用户的 floor redemption
- 已发生 borrow 的偿付边界
- 安全卖出需求

fee claim 的优先级低于用户偿付安全。

### 10.5 禁止行为

以下行为首版禁止：

- creator 直接提取 reserve
- admin 直接提取 reserve
- treasury 从主 reserve 任意抽水

---

## 11. Borrow 模型

### 11.1 借贷定位

借贷是协议内置功能，不接入外部 lending market。

### 11.2 collateral 与 debt

- 抵押物：对应 market token
- 借出资产：该 market 的 backing asset

### 11.3 Position

每个用户在每个 market 有一份独立仓位：

- `collateralAmount`
- `debtAmount`
- `createdAt`
- `updatedAt`

### 11.4 借款上限

本规格改为明确对齐 `RISE` 公开规则：

- `floorValue = collateralAmount * currentFloorPrice`
- `maxBorrowable = floorValue`

也就是：

- 默认 `borrowLtvBps = 10000`
- 不按 `marketPrice` 借款

如果安全评估认为首版必须保守，可临时降到 `9500 - 9800`，但这会偏离“高度仿制”的产品心智，需在对外文案上同步调整。

### 11.5 借款费用

首版默认：

- `borrowOriginationFeeBps = 300`
- 一次性收费
- 无持续 interest
- 无 repayment fee

### 11.6 borrow 流程

用户执行 `borrow` 时：

1. 校验 position collateral 足够
2. 计算 `floorValue`
3. 校验 `newDebt <= maxBorrowable`
4. 计算一次性 borrow fee
5. 用户收到净额 backing asset
6. market 记录 `totalDebt`
7. fee 按 creator / treasury / floor 分账

### 11.7 repay 流程

用户执行 `repay` 时：

- 支付 backing asset
- 先冲减 debt
- 无额外 repayment fee
- debt 清零后可全部提取 collateral

### 11.8 withdrawCollateral 条件

提取后必须保持：

- `remainingDebt <= remainingCollateral * currentFloorPrice`

如果全部提取：

- `debtAmount == 0`

### 11.9 liquidation

首版明确不做：

- price oracle
- liquidation engine
- keeper network
- forced unwind

这不是遗漏，而是产品设计本身。

### 11.10 loop

首版前端必须把 loop 作为一等使用路径来设计：

1. `depositCollateral`
2. `borrow`
3. `buy` 同 market token
4. 再次 `depositCollateral`

链上可以先做成分步操作，后续再扩展为组合交易路由。

---

## 12. 费用模型

### 12.1 费用类型

首版只保留：

- `creation fee`
- `trading fee`
- `borrow origination fee`

### 12.2 默认值

为贴近 `RISE` 公开资料，首版默认建议：

- `tradingFeeBps = 125`
- `borrowOriginationFeeBps = 300`
- `repayFeeBps = 0`
- `interestRate = 0`

### 12.3 trading fee 拆分

`buy` / `sell` 的交易费拆分到：

- `creator share`
- `treasury share`
- `floor share`

### 12.4 borrow fee 拆分

borrow origination fee 同样拆分到：

- `creator share`
- `treasury share`
- `floor share`

### 12.5 creator claim

creator 只能通过 `claimCreatorFees` 提取 creator accrued：

- 不能动主 reserve
- 必须有独立账本
- 必须发事件

---

## 13. 权限、暂停与升级

### 13.1 角色

首版只保留：

- `governanceMultisig`
- `timelock`
- `pauseGuardian`
- `marketCreator`

### 13.2 角色边界

`governanceMultisig`：

- 设置可变全局参数
- 管理 backing asset 白名单
- 升级代理实现
- 指定 `pauseGuardian`

`pauseGuardian`：

- 只能触发紧急暂停
- 不可改经济参数
- 不可提取资金

`marketCreator`：

- 只能领取 creator fee
- 不可调 fee
- 不可调 floor
- 不可追加 mint

### 13.3 参数可变性

为了贴近 `RISE` 的“创建后参数固定”心智，首版建议：

- market 创建后核心经济参数不可变

包括：

- backing asset
- curve params
- fee params
- initial floor config

### 13.4 timelock

允许变更的全局参数必须经过：

- timelock
- 事件披露
- 清晰延迟

建议延迟：

- `24 - 72 hours`

### 13.5 upgrade

首版允许升级，但要满足：

- transparent
- timelocked
- multisig-controlled
- event-emitted

如果要把“仿品”做得更像成熟协议而非实验品，升级能力建议只放在工厂与核心逻辑代理层，不要放在 market token 本体。

---

## 14. 前端信息架构

首版前端至少包含：

- 首页 / market 列表页
- create 页
- token 详情 / 交易页
- borrow / repay / collateral 管理区
- creator 面板

每个 token 页必须显式展示：

- 当前价格
- 当前 floor
- backing asset
- 可借上限
- 已抵押数量
- 当前债务
- trading fee
- borrow fee
- market 状态
- 是否处于 `disableSellAtLaunch` 窗口

交互上必须把以下三条路径独立表现：

- `Buy / Sell`
- `Redeem at Floor`
- `Borrow / Loop`

---

## 15. 事件模型

首版必须打出：

- `MarketCreated`
- `Bought`
- `Sold`
- `RedeemedAtFloor`
- `FloorRaised`
- `CollateralDeposited`
- `Borrowed`
- `Repaid`
- `CollateralWithdrawn`
- `CreatorFeesClaimed`
- `Paused`
- `Unpaused`
- `ParameterChangeQueued`
- `ParameterChanged`

事件要求：

- 带 `marketId`
- 带 `user`
- 带关键金额
- 带 fee 拆分
- 带操作后核心状态摘要

---

## 16. 不变量

开发和测试阶段必须持续验证：

1. `currentPrice >= currentFloorPrice`
2. `currentFloorPrice` 单调不减
3. `sum(positionDebt) == market.totalDebt`
4. `sum(positionCollateral) == market.totalCollateral`
5. `creatorAccrued + treasuryAccrued + floorAccrued <= totalCollectedFees`
6. `borrow` 后 `debt <= collateral * floor`
7. `withdrawCollateral` 后 `debt <= collateral * floor`
8. 任意时刻 market 仍可支撑全量 floor redemption
9. `Paused` 不会阻断 repay 与规则内退出

---

## 17. 测试与审计要求

### 17.1 单元测试

必须覆盖：

- `createMarket`
- `buy`
- `sell`
- `redeemAtFloor`
- `floor raise`
- `deposit / borrow / repay / withdraw`
- `claimCreatorFees`
- `pause / unpause`

### 17.2 fuzz

必须 fuzz：

- 随机买卖序列
- 随机借还序列
- 多用户 loop 序列
- 极端 supply / reserve / debt 边界

### 17.3 invariant

必须持续跑：

- floor 不变量
- debt 不变量
- reserve 偿付不变量

### 17.4 审计重点

外部审计重点必须放在：

- 曲线结算
- floor raise 计算
- `redeemAtFloor`
- `maxBorrowable` 边界
- reserve / fee 分账
- pause / upgrade / timelock

---

## 18. 当前未决事项

进入接口设计前，仍需拍板以下事项：

1. 首发 backing asset 只上 `WBNB` 还是同时上 `WBNB + USDT`
2. floor raise 阈值是否严格按 `100k / 200k / 300k / 400k` 分段
3. BSC 版本是否允许 `borrowLtvBps < 10000` 的保守偏移
4. `disableSellAtLaunch` 是否保留，以及持续多久
5. 是否首版就做组合式 `loop` 路由
6. 是否使用 upgradeable proxy

---

## 19. 下一步执行顺序

1. 基于本规格冻结未决事项
2. 输出 Solidity 接口草图
3. 输出 storage / state struct 草图
4. 输出结算顺序与 rounding 说明
5. 编写合约
6. 同步编写 invariant / fuzz
7. 准备审计包

---

## 20. 最终结论

这份 v1 规格的目标不是“抽象讨论 BSC 上能做什么”，而是把产品明确收敛为：

- 一个在 **BSC** 上运行的
- 与 `RISE` 公开机制高度相似的
- 以 floor、protocol-owned liquidity、interest-free borrow、liquidation-free loop 为核心卖点的
- 可直接进入接口设计与原型开发的协议实现文档

如果后续你要的是“更像原站页面和交互”，下一步应继续补两份文档：

- `contract_interfaces_v0.md`
- `frontend_information_architecture_v0.md`
