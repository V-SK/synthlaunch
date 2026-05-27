# OKX X Cup Submission — Synth SportFi Prediction Arena

## English

### One-line pitch

Synth SportFi Prediction Arena turns World Cup fan attention into wallet-signed prediction receipts on X Layer, with transparent reputation scoring, settlement, leaderboard state, and OKX Onchain OS trading handoff.

### Competition

OKX X Cup 2026 — World Cup Season.

### Live routes

| Surface | URL |
|---|---|
| Production app | `https://synthlaunch.fun` |
| X Cup arena | `https://synthlaunch.fun/fanfi/xcup` |
| Audit/readiness board | `https://synthlaunch.fun/fanfi/xcup/audit` |
| AI Terminal | `https://synthlaunch.fun/ai` |
| Source repository | `https://github.com/V-SK/synthlaunch` |

### What the project ships

- AI-generated Prediction Arena Studio with five World Cup templates.
- Wallet-signed prediction receipts using canonical EIP-191 messages.
- Optional X Layer tx anchoring and receipt verification.
- Supabase-backed persistence for campaigns, market proofs, fan profiles, and completions.
- Admin-signed settlement endpoint with deterministic REP scoring.
- Live leaderboard and receipt surfaces.
- OKX Onchain OS trading proof panel and AI Terminal handoff.

### Core code boundary

| Area | Files |
|---|---|
| Routes | `src/app/fanfi/page.tsx`, `src/app/fanfi/xcup/page.tsx`, `src/app/fanfi/xcup/audit/page.tsx` |
| UI | `src/components/fanfi/*` |
| Receipt signatures | `src/lib/fanfiProofSignature.ts`, `src/lib/fanfiProofAuth.ts` |
| Settlement | `src/lib/fanfiSettle.ts`, `src/lib/fanfiSettleSignature.ts`, `src/app/api/admin/fanfi-settle/route.ts` |
| Persistence | `src/lib/localFanfiStore.ts`, `src/lib/localFanfiCampaignStore.ts`, `src/lib/localFanfiMarketProofStore.ts`, `supabase/migrations/009_fanfi_tables.sql`, `supabase/migrations/010_fanfi_owner_wallet.sql` |
| APIs | `src/app/api/fanfi/*` |
| Shared OKX handoff | `src/lib/okx.ts`, `src/app/api/okx/*`, `src/components/ai/*` |

### Judging fit

- **Innovation**: Prediction receipts are signed, replay-guarded, and optionally anchored to X Layer transaction evidence.
- **Market potential**: World Cup attention is large, recurring, and social; the arena converts fan participation into reputation and OKX trading handoff.
- **Completion**: The product has live routes, UI flow, APIs, persistence, settlement, audit board, and bilingual UI.
- **Verifiability**: Every receipt has a canonical signed message; settlement uses deterministic scoring; audit/readiness state is exposed on `/fanfi/xcup/audit`.

### Honest boundaries

- Prediction receipts are not tradeable ERC-20 assets.
- Reason quality scoring is transparent v1 heuristic logic, not an undisclosed black-box model.
- Admin settlement requires a deployer-wallet signature and should be run after match outcomes are known.

## 中文

### 一句话介绍

Synth SportFi Prediction Arena 把世界杯球迷注意力转化为 X Layer 上的钱包签名预测 receipt，并提供透明 REP 评分、结算、排行榜和 OKX Onchain OS 交易承接。

### 比赛

OKX X Cup 2026 — World Cup Season。

### 线上入口

| 页面 | URL |
|---|---|
| 生产站点 | `https://synthlaunch.fun` |
| X Cup Arena | `https://synthlaunch.fun/fanfi/xcup` |
| 审计/准备看板 | `https://synthlaunch.fun/fanfi/xcup/audit` |
| AI Terminal | `https://synthlaunch.fun/ai` |
| 源码仓库 | `https://github.com/V-SK/synthlaunch` |

### 交付内容

- 5 个世界杯模板的 AI Prediction Arena Studio。
- 基于 EIP-191 的钱包签名预测 receipt。
- 可选 X Layer 交易锚定和 receipt 验证。
- Supabase 持久化：campaigns、market proofs、fan profiles、completions。
- Admin 签名结算端点和确定性 REP 评分。
- 实时排行榜和 receipt 页面。
- OKX Onchain OS trading proof panel 与 AI Terminal 承接。

### 代码边界

X Cup 项目的核心代码在 `src/app/fanfi/xcup`、`src/components/fanfi`、`src/lib/fanfi*`、`src/app/api/fanfi` 和 `src/app/api/admin/fanfi-settle`。这些代码属于 X Cup，不属于 Build X Hook 项目。

### 评分映射

- **创新性**：预测 receipt 有签名、有 replay guard，并可绑定 X Layer 交易证据。
- **市场价值**：世界杯是全球注意力场景，Arena 把 fan participation 转化为 reputation 和 OKX 交易承接。
- **完成度**：已有线上路由、产品 UI、API、持久化、结算、审计面板和双语 UI。
- **可验证性**：每条 receipt 都有规范签名消息；结算是确定性评分；准备状态在 `/fanfi/xcup/audit` 可见。
