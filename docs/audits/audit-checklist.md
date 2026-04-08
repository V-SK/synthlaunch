# FairMint 合约安全审计

## 检查清单

### 1. 重入攻击
- [ ] mint() 有 nonReentrant
- [ ] finalize() 有 nonReentrant
- [ ] claimRefund() 有 nonReentrant
- [ ] batchRefund() 有 nonReentrant
- [ ] 状态更新在外部调用之前

### 2. 整数溢出
- [ ] Solidity 0.8.20 自带溢出检查
- [ ] 除法前检查除数不为零

### 3. 权限控制
- [ ] Factory onlyOwner 函数正确
- [ ] 敏感操作需要权限

### 4. 资金安全
- [ ] 不会锁死资金
- [ ] 退款机制完整
- [ ] LP 锁定正确

### 5. 边界条件
- [ ] 零值检查
- [ ] 时间边界
- [ ] 供应量边界
