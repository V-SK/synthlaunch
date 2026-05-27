# OKX Code Boundaries

This file assigns repository code to the two OKX submissions so automated and human reviewers do not mix their evidence.

## Project A — Synth SportFi Prediction Arena

**Competition**: OKX X Cup 2026

**Live route**: `/fanfi/xcup`

**Code ownership**:

| Owned by X Cup | Purpose |
|---|---|
| `src/app/fanfi/page.tsx` | Redirect to X Cup arena |
| `src/app/fanfi/xcup/page.tsx` | Main X Cup arena route |
| `src/app/fanfi/xcup/audit/page.tsx` | Final checklist / readiness board |
| `src/components/fanfi/*` | X Cup UI, arena studio, proof panel, settlement panel, missions, leaderboard |
| `src/lib/fanfi*.ts` | Campaigns, signatures, auth, settlement, copilot, missions |
| `src/app/api/fanfi/*` | X Cup campaign/proof/progress APIs |
| `src/app/api/admin/fanfi-settle/route.ts` | Admin-signed settlement |
| `supabase/migrations/009_fanfi_tables.sql` | X Cup persistence tables |
| `supabase/migrations/010_fanfi_owner_wallet.sql` | Fan profile ownership enforcement |
| `public/fanfi-hero.png`, `public/fanfi-logo.png` | X Cup assets |

**Do not use for Hook scoring**: X Cup receipt signatures, FanFi routes, FanFi API endpoints, and SportFi settlement logic are not Uniswap v4 Hook code.

## Project B — SynthAgent Hook

**Competition**: OKX Build X Hackathon — Hook edition

**Live route**: `/build-x-hook`

**Code ownership**:

| Owned by Hook edition | Purpose |
|---|---|
| `hook/src/SynthAgentHook.sol` | Uniswap v4 Hook implementation |
| `hook/src/DemoERC20.sol` | Demo ERC20 tokens for on-chain proof |
| `hook/script/*` | CREATE2 mining, deployment, registration, one-shot X Layer demo |
| `hook/test/*` | Unit and integration tests against v4 PoolManager behavior |
| `hook/deployments/xlayer-agent-demo.json` | X Layer deployment evidence |
| `hook/demo/*` | Source static submission console |
| `public/build-x-hook/*` | Vercel-served mirror of Hook submission console |
| `next.config.mjs` `/build-x-hook` rewrite | Public route for the Hook console |
| `hook/SUBMISSION.md` | Hook submission packet |
| `hook/TWEET_DRAFTS.md` | Hook tweet copy |

**Do not use for X Cup scoring**: Hook v4 pool logic, Hook proof swaps, and `public/build-x-hook` are not the X Cup Prediction Arena.

## Shared Base

The following areas are shared infrastructure and should not be treated as exclusive proof for either submission unless referenced by that submission document:

| Shared area | Reason |
|---|---|
| `src/components/Header.tsx` | Global SynthLaunch navigation |
| `src/app/layout.tsx` | Global app shell |
| `src/lib/okx.ts`, `src/app/api/okx/*` | OKX Onchain OS wrappers used by core app and X Cup handoff |
| `src/components/ai/*`, `src/app/ai/page.tsx` | AI Terminal shared by SynthLaunch and X Cup |
| `deployments/xlayer.json` | Existing SynthLaunch X Layer contracts, not the Hook deployment artifact |
| `public/logo.jpg`, `public/synth-wallet/*` | Brand / previous wallet surface |

## Reviewer Instruction

Start from [`OKX_SUBMISSIONS_INDEX.md`](../OKX_SUBMISSIONS_INDEX.md). Then open the specific submission document. Do not infer one project's completion from the other project's route, deployment, or code.
