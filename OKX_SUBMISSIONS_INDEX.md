# OKX Submissions Index

This repository contains **two separate OKX hackathon submissions**. They share the SynthLaunch brand, production domain, and some base infrastructure, but they must be reviewed as independent projects.

## Submission A — OKX X Cup 2026

| Field | Value |
|---|---|
| Project name | Synth SportFi Prediction Arena |
| Competition | OKX X Cup 2026 — World Cup Season |
| Primary live route | `https://synthlaunch.fun/fanfi/xcup` |
| Submission document | [`docs/OKX_XCUP_SUBMISSION.md`](docs/OKX_XCUP_SUBMISSION.md) |
| Final form copy | [`docs/OKX_XCUP_FINAL_SUBMISSION.md`](docs/OKX_XCUP_FINAL_SUBMISSION.md) |
| Core code | `src/app/fanfi/xcup`, `src/components/fanfi`, `src/lib/fanfi*`, `src/app/api/fanfi`, `src/app/api/admin/fanfi-settle` |
| Main proof type | Wallet-signed prediction receipts, X Layer tx anchoring, deterministic REP settlement |

## Submission B — Build X Hook Edition

| Field | Value |
|---|---|
| Project name | SynthAgent Hook |
| Competition | OKX Build X Hackathon — Hook edition |
| Primary live route | `https://synthlaunch.fun/build-x-hook` |
| Local/source console | [`hook/demo/index.html`](hook/demo/index.html) |
| Submission document | [`hook/SUBMISSION.md`](hook/SUBMISSION.md) |
| Final form copy | [`hook/OKX_BUILD_X_HOOK_FINAL_SUBMISSION.md`](hook/OKX_BUILD_X_HOOK_FINAL_SUBMISSION.md) |
| Deployment evidence | [`hook/deployments/xlayer-agent-demo.json`](hook/deployments/xlayer-agent-demo.json) |
| Core code | `hook/src`, `hook/script`, `hook/test`, `hook/demo`, `public/build-x-hook` |
| Main proof type | Deployed Uniswap v4 Hook + v4 Pool on X Layer mainnet, two proof swaps, on-chain XP updates |

## Review Boundary

- Do **not** merge the two submissions into one scoring narrative.
- X Cup is a SportFi prediction-receipt product built inside the main SynthLaunch Next.js app.
- Hook edition is a Uniswap v4 Hook project isolated under `hook/`, with a public Vercel-facing static console mirrored to `public/build-x-hook`.
- Shared brand assets are allowed. Core logic, deployment evidence, routes, and submission documents are intentionally separated.
- For AI scoring, start with this file, then open the project-specific submission document.

## 中文说明

这个仓库同时包含两个 OKX 参赛项目。它们共享 SynthLaunch 品牌和生产域名，但评审时应该作为两个独立项目处理：

- **X Cup 项目**：`Synth SportFi Prediction Arena`，入口是 `/fanfi/xcup`，提交文档是 `docs/OKX_XCUP_SUBMISSION.md`。
- **Hook 项目**：`SynthAgent Hook`，入口是 `/build-x-hook`，提交文档是 `hook/SUBMISSION.md`，Hook 合约和 Foundry 工作区在 `hook/`。

AI 评分时请不要把两个项目的代码、部署地址、证明交易或叙事混在一起。
