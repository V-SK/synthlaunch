# OKX X Cup Final Submission Copy

## English

### Project name

Synth SportFi Prediction Arena

### Competition

OKX X Cup 2026 - World Cup Season

### Live links

| Surface | URL |
|---|---|
| Main arena | `https://synthlaunch.fun/fanfi/xcup` |
| Audit/readiness board | `https://synthlaunch.fun/fanfi/xcup/audit` |
| Production domain | `https://synthlaunch.fun` |
| Repository | `https://github.com/V-SK/synthlaunch` |

### One-line pitch

Synth SportFi Prediction Arena turns World Cup fan attention into wallet-signed prediction receipts on X Layer, with transparent reputation scoring, settlement, leaderboard state, and OKX trading handoff.

### Short description for the submission form

Synth SportFi Prediction Arena is a World Cup prediction product built for OKX X Cup. Fans create prediction arenas, sign canonical receipt messages with their wallets, optionally anchor proof to X Layer, and earn deterministic REP after settlement. The product includes live creation flow, receipt surfaces, leaderboard, settlement logic, audit board, and OKX Onchain OS handoff.

### What judges should review

| Area | Evidence |
|---|---|
| Product flow | `https://synthlaunch.fun/fanfi/xcup` |
| Readiness/audit view | `https://synthlaunch.fun/fanfi/xcup/audit` |
| Main submission doc | `docs/OKX_XCUP_SUBMISSION.md` |
| Code boundary | `src/app/fanfi/xcup`, `src/components/fanfi`, `src/lib/fanfi*`, `src/app/api/fanfi`, `src/app/api/admin/fanfi-settle` |
| Persistence | `supabase/migrations/009_fanfi_tables.sql`, `supabase/migrations/010_fanfi_owner_wallet.sql` |
| Shared OKX handoff | `src/lib/okx.ts`, `src/app/api/okx/*`, `src/components/ai/*` |

### AI scoring checklist

- Innovation: wallet-signed prediction receipts with replay guard and optional X Layer transaction evidence.
- Completion: live app route, creation flow, signed receipts, persistence, settlement endpoint, leaderboard, and audit board.
- Market fit: World Cup attention converts naturally into social prediction, fan reputation, and OKX trading handoff.
- Verifiability: receipt signing and settlement are deterministic and documented; the audit route exposes readiness state.
- Separation: this is the X Cup product; it should not be scored using the Build X Hook contract evidence.

### Honest boundaries

- Prediction receipts are not tradeable ERC-20 assets.
- Reason quality scoring is transparent v1 heuristic logic, not a hidden model.
- Final settlement should be executed after real match outcomes are known.

## 中文

### 项目名称

Synth SportFi Prediction Arena

### 比赛

OKX X Cup 2026 - World Cup Season

### 线上入口

| 页面 | URL |
|---|---|
| 主 Arena | `https://synthlaunch.fun/fanfi/xcup` |
| 审计/准备看板 | `https://synthlaunch.fun/fanfi/xcup/audit` |
| 生产域名 | `https://synthlaunch.fun` |
| 代码仓库 | `https://github.com/V-SK/synthlaunch` |

### 一句话介绍

Synth SportFi Prediction Arena 把世界杯球迷注意力转化为 X Layer 上的钱包签名预测 receipt，并提供透明 REP 评分、结算、排行榜和 OKX 交易承接。

### 表单简介

Synth SportFi Prediction Arena 是为 OKX X Cup 构建的世界杯预测产品。用户可以创建预测 Arena，用钱包签署规范 receipt message，可选绑定 X Layer 交易 proof，并在结算后获得确定性 REP。项目包含线上创建流程、receipt 展示、排行榜、结算逻辑、审计看板和 OKX Onchain OS 承接。

### 评委应查看什么

| 模块 | 证据 |
|---|---|
| 产品流程 | `https://synthlaunch.fun/fanfi/xcup` |
| 准备/审计页面 | `https://synthlaunch.fun/fanfi/xcup/audit` |
| 主提交文档 | `docs/OKX_XCUP_SUBMISSION.md` |
| 代码边界 | `src/app/fanfi/xcup`, `src/components/fanfi`, `src/lib/fanfi*`, `src/app/api/fanfi`, `src/app/api/admin/fanfi-settle` |
| 持久化 | `supabase/migrations/009_fanfi_tables.sql`, `supabase/migrations/010_fanfi_owner_wallet.sql` |
| OKX 承接 | `src/lib/okx.ts`, `src/app/api/okx/*`, `src/components/ai/*` |

### AI 评分要点

- 创新性：钱包签名预测 receipt，带 replay guard，并可绑定 X Layer 交易证据。
- 完成度：已有线上页面、创建流程、签名 receipt、持久化、结算端点、排行榜和审计看板。
- 市场匹配：世界杯天然适合社交预测、球迷声誉和 OKX 交易承接。
- 可验证性：签名和结算逻辑是确定性的，并且审计页面暴露准备状态。
- 项目边界：这是 X Cup 产品，不应使用 Build X Hook 的合约证据进行评分。

### 真实边界

- 预测 receipt 不是可交易 ERC-20 资产。
- Reason quality 是透明 v1 heuristic，不是隐藏黑盒模型。
- 最终结算应在真实比赛结果确定后执行。
