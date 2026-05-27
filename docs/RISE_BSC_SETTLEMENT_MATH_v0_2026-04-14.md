# RISE 风格 BSC 仿品结算与数学说明 v0

**日期**：2026-04-14
**版本**：v0
**状态**：用于指导 Solidity 实现、quote 逻辑、测试和审计
**关联文档**：

- [RISE_BSC_CLONE_SPEC_v1_2026-04-14.md](/Users/narissastreasure/Documents/Playground/anima/synthlaunch/docs/RISE_BSC_CLONE_SPEC_v1_2026-04-14.md)
- [RISE_BSC_CONTRACT_INTERFACES_v0_2026-04-14.md](/Users/narissastreasure/Documents/Playground/anima/synthlaunch/docs/RISE_BSC_CONTRACT_INTERFACES_v0_2026-04-14.md)

---

## 1. 目标

这份文档不讨论产品定位，而是把实现中最容易分歧的地方定下来：

- 内部精度如何统一
- `buy / sell / redeemAtFloor / borrow / repay / withdrawCollateral` 怎么结算
- fee 在什么时候扣
- `reserveBalance`、`floorReserveAllocated`、`availableLiquidity` 如何定义
- floor 什么时候 raise，raise 到多少
- rounding 怎么定

如果没有这份文档，接口虽然能写，但核心逻辑会因为数学口径不一致而反复返工。

---

## 2. 统一符号

### 2.1 价格与数量符号

- `s`：当前 `totalSupply`
- `s'`：结算后的 `totalSupply`
- `f`：当前 `currentFloorPrice`
- `f'`：结算后的 `currentFloorPrice`
- `p(s)`：给定 supply 时的 spot price
- `B`：backing asset 数量
- `T`：market token 数量
- `R`：`reserveBalance`
- `R_floor`：`floorReserveAllocated`
- `D`：`totalDebt`
- `C`：`totalCollateral`

### 2.2 费率符号

- `fee_trade`：`tradingFeeBps / 10000`
- `fee_borrow`：`borrowOriginationFeeBps / 10000`

---

## 3. 内部精度规范

### 3.1 固定内部精度

所有内部价格计算统一到 `1e18` 定点数：

- `currentPrice`：`1e18`
- `currentFloorPrice`：`1e18`
- 曲线斜率与截距：`1e18`

### 3.2 token / backing 数量

用户输入输出的 token amount 和 backing amount 保持各自原生 decimals：

- token amount 使用 token decimals
- backing amount 使用 backing decimals

进入数学函数前统一做 normalize：

```solidity
normalizedAmount = rawAmount * 1e18 / 10**assetDecimals
```

输出前再 denormalize。

### 3.3 精度原则

- 所有核心曲线计算在 normalized 精度层进行
- 所有状态存储仍使用原生资产单位，避免前端/索引器歧义
- quote 与实际执行必须调用同一套内部数学函数

---

## 4. 曲线定义

### 4.1 首版曲线

首版采用分段线性曲线：

```text
if s <= x2:
    p(s) = f + m1 * s
else:
    p(s) = f + m2 * s + b2
```

其中：

- `m1 >= m2 >= 0`
- `f > 0`
- `b2` 用于保证 `x2` 处连续

### 4.2 连续性条件

为保证 `x2` 处连续，必须满足：

```text
f + m1 * x2 = f + m2 * x2 + b2
=> b2 = (m1 - m2) * x2
```

如果实现里显式传入 `b2`，创建 market 时必须校验这一关系。

### 4.3 价格下界

任意时刻必须满足：

```text
p(s) >= f
```

这意味着：

- 斜率不能导致负偏移
- 任何 sell 后价格也不能跌破 floor

---

## 5. 买入数学

### 5.1 输入与输出

输入：

- `backingInRaw`

输出：

- `tokenOutRaw`
- `tradeFeeRaw`
- `priceAfter`
- `floorAfter`

### 5.2 fee 扣除顺序

`buy` 在输入侧扣 fee：

```text
tradeFee = backingIn * fee_trade
netBackingIn = backingIn - tradeFee
```

原因：

- 前端更容易展示“你支付多少，实际用于买多少”
- 和许多 launch/trade UI 的心智一致

### 5.3 buy 的积分关系

买入的本质是解下式：

```text
netBackingIn = integral from s to s+Δs of p(u) du
```

求得：

```text
tokenOut = Δs
```

### 5.4 线性段积分

若当前和结算后都在同一线性段：

```text
integral of (f + m*u) du
= f * Δs + (m / 2) * ((s + Δs)^2 - s^2)
```

### 5.5 跨段买入

若买入跨过 `x2`，则拆成两段积分：

1. `s -> x2`
2. `x2 -> s + Δs`

实现上不要直接写一个大分支公式，建议：

- 先计算到段末最多能买多少
- 不够再进第二段继续求解

### 5.6 rounding

`buy` 输出 `tokenOut` 一律向下取整：

- 避免多 mint
- quote 和执行都必须使用同样的 rounding

### 5.7 buy 后状态更新

```text
R' = R + backingIn
s' = s + tokenOut
currentPrice' = p(s')
```

注意：

- `reserveBalance` 加的是用户实际支付的总 backingIn，而不是净额
- fee 只是 reserve 内部重新记账，不是凭空消失

---

## 6. 卖出数学

### 6.1 输入与输出

输入：

- `tokenInRaw`

输出：

- `backingOutRaw`
- `tradeFeeRaw`
- `priceAfter`
- `floorAfter`

### 6.2 sell 的积分关系

卖出的毛输出：

```text
grossBackingOut = integral from s-Δs to s of p(u) du
```

其中：

```text
Δs = tokenIn
```

### 6.3 fee 扣除顺序

`sell` 在输出侧扣 fee：

```text
tradeFee = grossBackingOut * fee_trade
netBackingOut = grossBackingOut - tradeFee
```

### 6.4 跨段卖出

若卖出跨越 `x2`，同样拆两段：

1. `s -> x2`
2. `x2 -> s - Δs`

### 6.5 rounding

`sell` 输出 `backingOut` 一律向下取整：

- 防止超付 reserve
- 与 `redeemAtFloor` 保持一致

### 6.6 sell 后状态更新

```text
R' = R - netBackingOut
s' = s - tokenIn
currentPrice' = p(s')
```

然后再记 `tradeFee` 的内部分账。

注意：

- 用户拿到的是 `netBackingOut`
- `tradeFee` 仍留在 market reserve 体系里，后续拆到 creator / treasury / floor 三类账本

---

## 7. `redeemAtFloor` 数学

### 7.1 核心定义

`redeemAtFloor` 不走曲线积分，直接按 floor 线性结算：

```text
grossBackingOut = tokenIn * f
```

### 7.2 fee 扣除

首版建议默认复用 trading fee：

```text
redeemFee = grossBackingOut * fee_trade
netBackingOut = grossBackingOut - redeemFee
```

如果后续要单独配置 `redeemFeeBps`，再扩展。

### 7.3 执行前检查

必须满足：

```text
netBackingOut <= availableRedemptionLiquidity
```

其中：

```text
availableRedemptionLiquidity = R - reservedForTreasuryAndCreator
```

### 7.4 rounding

`redeemAtFloor` 的 `netBackingOut` 向下取整。

### 7.5 redeem 后状态

```text
R' = R - netBackingOut
s' = s - tokenIn
```

floor 本身不因赎回下降。

---

## 8. fee 分账数学

### 8.1 share 约束

必须满足：

```text
creatorShareBps + treasuryShareBps + floorShareBps = 10000
```

### 8.2 拆分公式

对于任一 feeAmount：

```text
creatorShare  = feeAmount * creatorShareBps  / 10000
treasuryShare = feeAmount * treasuryShareBps / 10000
floorShare    = feeAmount - creatorShare - treasuryShare
```

`floorShare` 放在最后吃 rounding remainder，保证总和精确等于 `feeAmount`。

### 8.3 账本更新

```text
creatorFeeAccrued'  = creatorFeeAccrued + creatorShare
treasuryFeeAccrued' = treasuryFeeAccrued + treasuryShare
floorFeeAccrued'    = floorFeeAccrued + floorShare
R_floor'            = R_floor + floorShare
```

### 8.4 未支付 fee 的 reserve 含义

`creatorFeeAccrued` 和 `treasuryFeeAccrued` 在 claim 前仍然物理存在于 `reserveBalance` 中，但逻辑上不再属于“可自由用于新风险”的流动性。

---

## 9. reserve 分层定义

### 9.1 总 reserve

```text
R = reserveBalance
```

### 9.2 floor backing reserve

```text
R_floor = floorReserveAllocated
```

它表示已经被协议确认用于支撑 floor 的 reserve 部分。

### 9.3 未支付外部 accrued

```text
R_unpaid = creatorFeeAccrued + treasuryFeeAccrued
```

### 9.4 可用于新增 borrow 的流动性

建议定义：

```text
availableBorrowLiquidity = R - R_floor - R_unpaid - safetyBuffer
```

其中 `safetyBuffer` 首版可以为：

- 固定比例
- 或暂时为 `0`，但审计前应明确

### 9.5 可用于 floor 提升的冗余

建议定义：

```text
excessReserveForFloor = R - D - R_unpaid - (f * s)
```

更稳妥的实现口径是：

```text
maxSafeFloor = floor((R - D - R_unpaid) / s)
```

只要：

```text
maxSafeFloor > currentFloorPrice
```

就说明 floor 理论上可以被抬高。

注意：

- 这里把未偿还债务 `D` 视作已经对 reserve 构成未来索取权
- 这是首版偏保守的定义，更适合审计

---

## 10. borrow 数学

### 10.1 基础公式

对单用户 position：

```text
floorValue = collateralAmount * f
maxBorrowable = floorValue
availableToBorrow = maxBorrowable - existingDebt
```

### 10.2 fee 扣除方式

用户输入想借的债务名义值 `borrowAmountGross`：

```text
borrowFee = borrowAmountGross * fee_borrow
borrowAmountNet = borrowAmountGross - borrowFee
```

存储债务时：

```text
newDebt = oldDebt + borrowAmountGross
```

用户实际拿到：

```text
borrowAmountNet
```

这点必须固定，否则前端、quote、仓位页会混乱。

### 10.3 reserve 检查

执行 borrow 前必须满足：

```text
borrowAmountNet <= availableBorrowLiquidity
```

### 10.4 borrow 后状态

```text
D' = D + borrowAmountGross
R' = R - borrowAmountNet
```

然后把 `borrowFee` 记入 fee 分账账本。

### 10.5 borrow 不变量

对每个 position：

```text
debtAmount <= collateralAmount * f
```

对整个 market：

```text
sum(position.debtAmount) = totalDebt
```

---

## 11. repay 数学

### 11.1 repay 规则

用户输入 `repayAmount`：

```text
effectiveRepay = min(repayAmount, debtAmount)
```

### 11.2 repay 后状态

```text
positionDebt' = positionDebt - effectiveRepay
D' = D - effectiveRepay
R' = R + effectiveRepay
```

首版：

- 不收 repay fee
- repay 不触发额外债务重算

### 11.3 rounding

`repay` 不应因为 rounding 产生残余 dust debt。实现时要允许：

- 当 `repayAmount >= debtAmount` 时，直接清零

---

## 12. `withdrawCollateral` 数学

### 12.1 约束

设提取后的抵押为：

```text
collateralAfter = collateralBefore - withdrawAmount
```

则必须满足：

```text
debtAmount <= collateralAfter * f
```

### 12.2 最大可提取量

```text
minRequiredCollateral = ceil(debtAmount / f)
maxWithdrawable = collateralBefore - minRequiredCollateral
```

### 12.3 特例

如果：

```text
debtAmount == 0
```

则：

```text
maxWithdrawable = collateralBefore
```

---

## 13. floor raise 数学

### 13.1 可安全 floor 上限

首版建议使用保守定义：

```text
maxSafeFloor = floor((R - D - R_unpaid) / s)
```

其中：

- `R`：当前 reserve
- `D`：总债务
- `R_unpaid`：尚未支付的 creator + treasury accrued
- `s`：总 supply

边界：

- 当 `s == 0` 时，不 raise floor
- 当 `R <= D + R_unpaid` 时，不 raise floor

### 13.2 raise 条件

只有同时满足以下条件时才 raise：

1. `maxSafeFloor > currentFloorPrice`
2. cooldown 已满足
3. market 状态允许

### 13.3 新 floor 取值

建议直接取：

```text
newFloor = maxSafeFloor
```

这是最简单也最接近“只要足够安全就提升到位”的实现。

如果后续需要更平滑，可以改成：

```text
newFloor = min(maxSafeFloor, currentFloorPrice + maxStepPerRaise)
```

但首版不建议再增加额外参数。

### 13.4 floor backing reserve 更新

raise 后：

```text
R_floor' = newFloor * s
```

这里的核心语义是：

- `R_floor` 只是协议内部确认已用于支撑 floor 的逻辑账本
- 它不能超过 `R - D - R_unpaid`

### 13.5 cooldown 档位

建议按 `netInflows` 所处分段决定：

```text
if netInflows < threshold1: cooldown = cooldown0
else if netInflows < threshold2: cooldown = cooldown1
else if netInflows < threshold3: cooldown = cooldown2
else if netInflows < threshold4: cooldown = cooldown3
else: cooldown = cooldown4
```

默认值：

- `0s`
- `30s`
- `60s`
- `90s`
- `120s`

### 13.6 `netInflows` 定义

首版建议：

```text
netInflows = cumulativeBuyBackingIn - cumulativeSellBackingOut - cumulativeBorrowNetOut + cumulativeRepayIn + donations
```

说明：

- 这是偏“现金流”口径
- 用于 cooldown 分段，而不是直接用于偿付计算

实现时必须单独维护累计值，不要临时从历史事件回推。

---

## 14. rounding 统一规则

### 14.1 原则

凡是可能导致协议超付的地方，一律向下取整。

### 14.2 具体规则

- `buy` 的 `tokenOut`：向下取整
- `sell` 的 `grossBackingOut` 和 `netBackingOut`：向下取整
- `redeemAtFloor` 的 `backingOut`：向下取整
- `borrowAmountNet`：向下取整
- `creator/treasury share`：向下取整
- `floor share`：吃余数
- `minRequiredCollateral`：向上取整

### 14.3 quote 一致性

所有 `quote*` 函数必须与执行路径共享同一 rounding 逻辑。

不允许：

- quote 用浮点近似
- execute 用整数离散

这会导致前端频繁滑点失败。

---

## 15. 关键结算顺序总表

### 15.1 `buy`

1. 拉 backing
2. 算 trade fee
3. 算净输入
4. 曲线解 `tokenOut`
5. mint token
6. 更新 reserve / supply / price
7. 记 fee
8. `maybeRaiseFloor`

### 15.2 `sell`

1. 拉 token
2. 曲线算毛输出
3. 扣 trade fee
4. burn token
5. 打用户净输出
6. 更新 reserve / supply / price
7. 记 fee
8. `maybeRaiseFloor`

### 15.3 `redeemAtFloor`

1. 算 floor 输出
2. 扣 fee
3. burn token
4. 打用户净输出
5. 更新 reserve / supply
6. 记 fee
7. `maybeRaiseFloor`

### 15.4 `borrow`

1. 算 `maxBorrowable`
2. 校验 debt 上限
3. 算 borrow fee
4. 校验 reserve 安全边界
5. 增加 debt
6. 打净额给用户
7. 记 fee
8. `maybeRaiseFloor`

### 15.5 `repay`

1. 拉 backing
2. 冲减 debt
3. 增加 reserve
4. `maybeRaiseFloor`

### 15.6 `withdrawCollateral`

1. 计算 `maxWithdrawable`
2. 校验提取量
3. 更新 collateral
4. 转 collateral token

---

## 16. 测试映射

### 16.1 buy / sell

必须验证：

- 同段买入
- 跨段买入
- 同段卖出
- 跨段卖出
- quote 与实际执行一致

### 16.2 floor

必须验证：

- floor 永不下降
- reserve 不足时不 raise
- cooldown 未到时不 raise
- 达到条件时 raise 到 `maxSafeFloor`

### 16.3 borrow

必须验证：

- 满借到 floor value
- 借款 fee 正确计入 debt / payout
- reserve 不足时 borrow 失败
- repay 后可恢复可借额度

### 16.4 withdraw

必须验证：

- 债务未清时只能提取到上限
- 清债后可全部提取
- rounding 不导致错误通过

---

## 17. 实现建议

### 17.1 数学函数拆分

建议在 `RiseMath.sol` / `RiseFloorMath.sol` 中至少拆出：

```solidity
function quoteBuyTokenOut(...) internal pure returns (uint256);
function quoteSellBackingOut(...) internal pure returns (uint256);
function quoteRedeemBackingOut(...) internal pure returns (uint256);
function computeBorrowFee(...) internal pure returns (uint256);
function computeTradeFee(...) internal pure returns (uint256);
function computeMaxBorrowable(...) internal pure returns (uint256);
function computeMaxSafeFloor(...) internal pure returns (uint256);
function computeCooldown(...) internal pure returns (uint32);
function computeMaxWithdrawable(...) internal pure returns (uint256);
```

### 17.2 共享逻辑

实际执行和 quote 必须都调用这些内部函数，而不是各写一套。

---

## 18. 当前结论

进入 Solidity 编码前，核心数学口径现在已经足够收敛到可实现状态。真正还需要你拍板的，只剩偏产品取舍而不是公式本身的几项：

1. backing asset 首发只上 `WBNB` 还是 `WBNB + USDT`
2. `borrowLtvBps` 是否坚持 `10000`
3. floor cooldown 是否严格按五档实现
4. `disableSellAtLaunch` 要不要保留

如果你让我继续，我下一步可以直接开始把这些文档落成实际 Solidity 骨架文件，先建 `interfaces/`、`libraries/Types/Errors` 和 `RiseMarketToken`。
