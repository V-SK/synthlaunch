# SynthLaunch Timelock 提款计划

**创建时间**: 2026-02-22 15:21 EST  
**执行时间**: 2026-02-24 15:16 - 15:26 EST  
**总金额**: 0.98 BNB

---

## ✅ 提案状态

### 提案#1: withdrawPlatformFee
- **金额**: 0.53 BNB
- **函数**: `withdrawPlatformFee(address)`
- **收款地址**: `0x5c9E31B8E3fDc7356D7398165457423854C72C8e`
- **提案ID**: `0xdec2beb11c856a644e4eb3fbba9b305b47c7f345a3245ceefa036d832f82cb44`
- **执行时间**: 2026/2/24 15:16:45 EST
- **Queue交易**: https://bscscan.com/tx/0x21502e1efb000adfaf0ce4fc8843e8e67ff647ccee1b9b5abdcc5e956e127440
- **状态**: ✅ 在队列中

### 提案#2: emergencyWithdraw
- **金额**: 0.45 BNB
- **函数**: `emergencyWithdraw(address)`
- **收款地址**: `0x5c9E31B8E3fDc7356D7398165457423854C72C8e`
- **提案ID**: `0xfd810dd08c0ce3b442ad5d6d1b2c9c121a5ef45548257374326982aa51cf5a64`
- **执行时间**: 2026/2/24 15:26:35 EST
- **Queue交易**: https://bscscan.com/tx/0xe1131e6929478d4fa0a7877811be55c802ffc2757b07618ef460c63fd41a16bb
- **状态**: ✅ 在队列中

---

## 📋 48小时后执行步骤

### 第1步: 执行提案#1 (2月24日 15:16之后)

```bash
cd /Users/v/Desktop/synthlaunch
node scripts/execute-proposal-1.js
```

**预期结果**: 提取 0.53 BNB 到 0x5c9E31B8E3fDc7356D7398165457423854C72C8e

### 第2步: 执行提案#2 (2月24日 15:26之后)

```bash
cd /Users/v/Desktop/synthlaunch
node scripts/execute-proposal-2.js
```

**预期结果**: 提取 0.45 BNB 到 0x5c9E31B8E3fDc7356D7398165457423854C72C8e

---

## 💰 资金分布说明

**Custody总余额**: 2.68 BNB

分解：
1. **平台费** (0.53 BNB) → 提案#1提取 ✅
2. **"多余"资金** (0.45 BNB) → 提案#2提取 ✅
3. **Agent未claim费用** (1.71 BNB) → **不能提取**（属于agents）

**可提取总额**: 0.98 BNB  
**保留**: 1.71 BNB (属于SynthLaunch的agents)

---

## 🔒 安全说明

### Timelock机制
- **延迟**: 48小时（硬编码，无法绕过）
- **目的**: 防止私钥被盗时资金瞬间转走
- **Admin**: `0x8028227C43947F41bB431571002D512815D77C4F` (Deployer)

### 提案验证
两个提案都已验证在链上队列中（`queuedTransactions` mapping）。

### 合约地址
- **Timelock**: `0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D`
- **Custody**: `0x3Fa33A0fb85f11A901e3616E10876d10018f43B7`
- **Deployer**: `0x8028227C43947F41bB431571002D512815D77C4F`

---

## ⏰ 重要时间节点

- **Queue时间**: 2026-02-22 15:21 EST
- **执行窗口开始**: 2026-02-24 15:16 EST
- **执行窗口结束**: 2026-03-10 (14天grace period后)

**建议**: 在2月24日当天执行，不要拖太久。

---

## ❓ 常见问题

**Q: 能不能提前执行？**  
A: ❌ 不能。Timelock的48小时延迟是硬编码的，没有bypass机制。

**Q: 如果忘记执行会怎样？**  
A: 提案有14天grace period，过期后需要重新queue。

**Q: 剩余1.71 BNB能提取吗？**  
A: ❌ 不能。这是agents的费用，他们需要通过`claim()`函数自己提取。

**Q: 执行需要gas费吗？**  
A: 是的，Deployer钱包需要有BNB支付gas（约0.001-0.005 BNB）。

---

## 📝 备注

- 执行脚本已创建并保存在 `scripts/` 目录
- 两个提案都经过验证，确保在队列中
- 收款地址: `0x5c9E31B8E3fDc7356D7398165457423854C72C8e`
- 执行后资金直接到达收款地址

---

**创建者**: Alice  
**审核**: V  
**日期**: 2026-02-22
