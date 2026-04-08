# TASK: NFAv2 前端更新

**指派**: Eva (via Codex)
**优先级**: 高
**创建**: 2026-02-07 07:44 EST by Alice

## 背景

NFAv2 合约已写好并审计通过，加入了 logicAddress 白名单机制。
合约文件: `/Users/v/Desktop/synthlaunch/contracts/NFAv2.sol`

## 任务内容

### 1. 部署 NFAv2 到 BSC 主网
- 写部署脚本 `scripts/deploy-nfav2.js`
- Treasury 地址: `0x8028227C43947F41bB431571002D512815D77C4F`
- 部署后在 BscScan 验证

### 2. 前端改动 (方案 A — 最小改动)

**文件**: `/Users/v/Desktop/synthlaunch/src/app/nfa/page.tsx`

改动:
1. 删除 `logic` 输入框 (line 180 左右的 InputField)
2. 删除 `logic` state (line 161)
3. 调用 mint 时 logic 参数固定为 `"0x0000000000000000000000000000000000000000"`

**文件**: `/Users/v/Desktop/synthlaunch/src/hooks/useNFA.ts`
- 更新合约地址为新的 NFAv2 地址
- 如果 ABI 有变化，更新 ABI

**文件**: `/Users/v/Desktop/synthlaunch/src/lib/nfa.ts`
- 更新合约地址

### 3. 部署前端
```bash
cd /Users/v/Desktop/synthlaunch
vercel --prod --yes -t oiqnV3r0ctVLCifgy38ymPSP
```

## NFAv2 vs NFA v1 的区别

- `setLogicAddress()` 现在要求地址在白名单中 (或 address(0))
- 新增 `approveLogic(address, reason)` — admin 添加白名单
- 新增 `revokeLogic(address, reason)` — admin 移除白名单
- 新增 `forceResetLogic(tokenId, reason)` — admin 强制重置
- 新增 `getApprovedLogicList()` — 查询白名单
- 禁用了 `renounceOwnership()`

## 验收标准

1. [ ] NFAv2 部署到 BSC 主网并验证
2. [ ] 前端 /nfa 页面移除 logic 输入框
3. [ ] mint 功能正常工作
4. [ ] 前端部署到 vercel

## 备注

旧 NFA 合约: `0x396333F75f4e4CE0d9b614BE04b692496C6C18b3`
不需要迁移数据，v1 和 v2 是独立的。
