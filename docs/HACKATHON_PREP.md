# SynthLaunch Hackathon Prep

This document consolidates:

- Judge-oriented repository and README recommendations
- OKX Build X Hackathon submission requirements
- A practical checklist for preparing SynthLaunch as a stronger X Layer submission

## 1. Current Project Read

SynthLaunch already has meaningful product depth:

- AI agent token launch flow
- agent-linked fee routing and custody
- identity primitives such as SynthID / NFA
- frontend + contracts + API + scanning/indexing logic
- partial X Layer support already present in the codebase

The main issue is not lack of substance. The main issue is presentation and consistency.

From a judge’s perspective, the current repo still looks mixed:

- some core config supports both **BSC** and **X Layer**
- some API routes and data pipelines still behave as **BSC-first**
- the current README is still framed as a **BNB Chain** project

That means the project can be stronger than it appears, but the repo currently does not make that obvious.

## 2. Judge View: What Reviewers Usually Want First

Most judges will not deeply reverse-engineer the whole repo. They usually want five answers very quickly:

1. What is this project?
2. Why is it relevant to the hackathon?
3. Why is it an X Layer project?
4. What is actually built and working?
5. How can I verify that in under a few minutes?

So the repository should optimize for clarity, not exhaustiveness.

## 3. Judge-Oriented README Recommendations

### Recommended README structure

The README should be restructured so the first screen answers the core judging questions immediately.

Suggested top-level structure:

1. Project title + one-line positioning
2. Hackathon relevance
3. Live links
4. What the product does
5. Why it matters
6. Why X Layer
7. Core user flow
8. Architecture
9. Contract / deployment table by chain
10. Quick start
11. Judge quick evaluation steps
12. What was built during the hackathon

### Recommended positioning sentence

Use a sentence close to:

> SynthLaunch is an agent-native token launch and monetization protocol on X Layer and BSC.

That framing is stronger than “AI agent launchpad” because it highlights:

- onchain identity
- revenue routing
- agent economy
- protocol depth

### README priorities

The README should emphasize:

- **X Layer** as the primary hackathon submission chain
- **agent-owned economy** as the product thesis
- **what is already live**
- **how judges can validate it**
- **which parts use Onchain OS or Uniswap-related capabilities**

### README problems to fix

Current issues that should be corrected:

- README currently opens with **BNB Chain** framing
- contract table is BSC-only
- there is no short “judge quick evaluation” section
- the hackathon-specific delta is not clearly separated from older project history

## 4. Judge-Oriented README Draft

Use the following as the base README draft.

```md
# SynthLaunch

**Agent-native token launch and monetization protocol on X Layer and BSC**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![X Layer](https://img.shields.io/badge/Chain-X%20Layer-black.svg)](https://www.oklink.com/x-layer)
[![BSC](https://img.shields.io/badge/Chain-BSC-yellow.svg)](https://bscscan.com)
[![Open Source](https://img.shields.io/badge/Open%20Source-100%25-brightgreen.svg)](https://github.com/V-SK/synthlaunch)

SynthLaunch is an agent-native launch and monetization protocol that enables AI agents to create tokens, bind identity, route protocol fees, and operate as autonomous economic actors across **X Layer** and **BSC**.

Built for the **OKX Build X Hackathon**, SynthLaunch focuses on a simple but powerful idea:

**AI agents should not only talk. They should own assets, earn revenue, and participate in onchain economies.**

## Live Demo

- Website: [https://synthlaunch.fun](https://synthlaunch.fun)
- Hackathon entry: OKX Build X Hackathon
- Primary chain for submission: **X Layer**
- Source code: [https://github.com/V-SK/synthlaunch](https://github.com/V-SK/synthlaunch)

## What SynthLaunch Does

SynthLaunch gives AI agents an onchain operating layer:

- **Launch tokens for agents**
- **Route trading fees to agent-linked custody**
- **Bind agent identity to wallets**
- **Let agents claim and manage revenue**
- **Support agent evolution through identity, logic, and monetization primitives**

In practice, this means an AI agent can become more than an interface. It can become an economic actor with identity, treasury flow, and onchain activity.

## Why This Matters

Most AI agents today can generate text, post content, or call APIs, but they do not have native economic coordination.

SynthLaunch turns that into an onchain primitive:

- Agents can launch assets
- Agents can accumulate fees
- Agents can bind identity
- Agents can claim value
- Agents can evolve into long-lived onchain participants

This is the core thesis of the project: **agent-owned economies**.

## Why X Layer

For this hackathon, our primary submission path is **X Layer**.

We chose X Layer because this project is fundamentally about high-frequency onchain interaction for AI-native products:

- token launch flows
- onchain identity coordination
- fee routing and claiming
- agent treasury activity
- AI-assisted wallet and market workflows

SynthLaunch is designed so these agent actions can happen onchain in a way that is visible, composable, and easy to verify.

## Hackathon Highlights

This repository includes:

- **Multi-chain launch support** for **X Layer** and **BSC**
- **Agent token launch flow** with fee routing
- **Custody contract** for agent-linked revenue accounting
- **SynthID** soulbound identity primitive for AI agents
- **NFA / Non-Fungible Agents** infrastructure for agent logic and identity extension
- **OKX/X Layer AI assistant flows** for wallet and token interactions
- **Frontend + contracts + API + indexing/scanning** in one codebase

## Core User Flow

1. User selects a chain, including **X Layer**
2. User launches a token for an AI agent
3. Token fees are routed to the configured custody / beneficiary flow
4. Agent identity is linked through SynthID / binding flows
5. Revenue can be tracked and claimed
6. Agent becomes a monetized onchain entity rather than just a chat interface

## Architecture

```text
User / Agent
   |
   v
Next.js Frontend
   |
   v
API Layer (token registration, metadata, chain-aware flows)
   |
   +--> Flap / Portal launch contracts
   |
   +--> Custody contracts for fee routing and claiming
   |
   +--> Identity layer (SynthID / NFA)
   |
   +--> Supabase indexing / token registry
```

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Web3**: wagmi, viem
- **Contracts**: Solidity, Hardhat, OpenZeppelin
- **Data / Indexing**: Supabase
- **Infra**: Vercel
- **Chains**: X Layer, BSC

## Contract Overview

### X Layer

Add your latest deployed contract addresses here.

| Contract | Address | Description |
|----------|---------|-------------|
| Flap / Launch Integration | `TBD` | Token launch entrypoint |
| SynthLaunchCustody | `TBD` | Fee routing and custody |
| SynthID | `TBD` | Agent identity |
| NFA / NFAv2 | `TBD` | Agent logic / non-fungible agent primitive |

### BSC

| Contract | Address | Description |
|----------|---------|-------------|
| SynthLaunchCustody v11 | [`0x3Fa33A0fb85f11A901e3616E10876d10018f43B7`](https://bscscan.com/address/0x3Fa33A0fb85f11A901e3616E10876d10018f43B7#code) | Fee custody with timelock |
| SynthTimelock | [`0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D`](https://bscscan.com/address/0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D#code) | 48h delay for admin actions |
| NFAv2 | [`0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19`](https://bscscan.com/address/0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19#code) | Non-Fungible Agents |
| SynthID | [`0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb`](https://bscscan.com/address/0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb#code) | Soulbound AI identity |

## Repository Guide

Important folders for judges and reviewers:

- `src/` — frontend and API routes
- `contracts/` — Solidity contracts
- `scripts/` — deployment, scanning, and ops scripts
- `docs/` — product and protocol documentation
- `test/` — contract tests

## Quick Start

```bash
git clone git@github.com:V-SK/synthlaunch.git
cd synthlaunch
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Setup

Create a local env file and configure the required values:

```bash
cp .env.example .env.local
```

Typical environment variables include:

- RPC endpoints
- Supabase credentials
- Wallet / signer configuration
- optional OKX-related API configuration
- app secrets for protected API routes

## Judge Quick Evaluation

If you are reviewing this project for the hackathon, here is the fastest path:

1. Open the live app
2. Check the chain selector and switch to **X Layer**
3. Review the launch flow and token creation UX
4. Inspect custody / fee-routing logic in the contracts
5. Review SynthID / NFA identity primitives
6. Inspect chain-aware configuration in the codebase
7. Review AI / OKX / X Layer interaction flows in the API layer

## Security Notes

- Timelock protection is used for critical admin operations
- Revenue-handling contracts use explicit custody flows
- Contracts are structured with defensive ownership and fee-handling controls
- Verified contracts are published where available
- Additional audit and review materials are included in the repository

## What We Built During The Hackathon

Suggested section for final submission. Replace this with your exact delta.

Example format:

- Expanded SynthLaunch into a hackathon-ready **X Layer** submission
- Added or refined **chain-aware launch support**
- Integrated **X Layer-specific agent and market interaction flows**
- Improved agent monetization and fee-routing experience
- Structured the repo and UX for judge evaluation and reproducibility

## Roadmap

- Complete deeper multi-chain parity between X Layer and BSC
- Expand agent treasury and claim tooling
- Improve AI-assisted onchain execution workflows
- Add clearer deployment dashboards and explorer-linked verification

## Links

- Website: [https://synthlaunch.fun](https://synthlaunch.fun)
- Whitepaper: [public/SynthLaunch-Whitepaper.md](public/SynthLaunch-Whitepaper.md)
- Twitter: [https://twitter.com/synth_fun](https://twitter.com/synth_fun)
- Repository: [https://github.com/V-SK/synthlaunch](https://github.com/V-SK/synthlaunch)

## License

[MIT](LICENSE)
```

## 5. Repository Cleanup Recommendations

### Why cleanup matters

Right now the repo contains a lot of useful work, but some of it is presented like an internal working directory instead of a polished submission.

That creates friction for judges.

### What to keep prominent at root

Keep these visible:

- `README.md`
- `LICENSE`
- `package.json`
- `src/`
- `contracts/`
- `scripts/`
- `docs/`
- `test/`

### What to reorganize

Move or regroup internal-looking files such as:

- `TASK-*.md`
- `TIMELOCK_WITHDRAWAL_PLAN.md`
- `audit-checklist.md`
- `check-claim-temp*.mjs`
- `check-synth-fun*.mjs`
- `audit-package.zip`

Suggested destinations:

- `docs/hackathon/`
- `docs/audits/`
- `docs/internal/`
- `scripts/debug/`
- `scripts/ops/`

### Why this helps

This makes the project look:

- more intentional
- easier to review
- less noisy
- more competition-ready

## 6. Dual-Chain Support Plan

The right goal is not just “show two chains in the UI.”

The real goal is:

- chain selection in the frontend
- chain-aware API behavior
- chain-aware token registration
- chain-aware stats and leaderboard
- chain-aware background jobs
- chain-aware data storage

### Current state

Already present:

- frontend chain config supports **56** and **196**
- wagmi config supports **BSC** and **X Layer**
- launch flow can already choose chain config in parts of the frontend

Still BSC-first:

- token list API
- leaderboard API
- token register API
- fee collection route
- some scanner logic
- some default addresses and symbols

### Recommended implementation phases

#### Phase 1: Centralize chain config

Create a single source of truth for:

- chain ID
- RPC
- explorer
- portal / launch address
- custody address
- native symbol
- price source

#### Phase 2: Add `chain_id` to stored token records

This is critical.

Without `chain_id`, the project can show a chain switcher while still mixing both chains in the same dataset.

Recommended:

- add `chain_id` to token storage
- backfill older BSC entries with `56`
- require `chain_id` on all new registrations

#### Phase 3: Make token registration chain-aware

The register flow should:

- receive `chainId`
- resolve the correct public client
- verify the token on the correct chain
- register it to the correct custody contract
- save `chain_id` to storage

#### Phase 4: Make query APIs chain-aware

These APIs should accept `chainId`:

- `/api/tokens`
- `/api/leaderboard`
- `/api/stats`

And they should:

- query only token rows for that chain
- read chain state from that chain’s RPC
- render metrics with the chain’s native token and explorer

#### Phase 5: Make backend jobs chain-aware

This includes:

- fee collection
- scanners
- backfill scripts

Each background job should know which chain it is operating on.

#### Phase 6: Clean up chain-specific language

Avoid hardcoded BNB/BSC wording in user-facing surfaces where the selected chain may be X Layer.

## 7. Submission Strategy Recommendation

For SynthLaunch, the stronger fit is:

- **X Layer Arena**

Why:

- this is a product, not just a standalone skill
- the core thesis is an **agentic onchain application**
- the repo already contains launch flow, identity, fee routing, and agent-related infrastructure

## 8. OKX Build X Hackathon Requirements

The official hackathon page indicates the following for the current event window.

### Timing

The submission deadline is:

- **April 15, 2026 at 23:59 UTC**
- which is **April 15, 2026 at 19:59 in America/New_York**

### X Layer Arena mandatory requirements

Officially required:

1. At least one part of the project must be built on **X Layer**
2. Create an **Agentic Wallet** as the project’s main onchain identity
3. If multiple agents are deployed, explain their relationship in the README
4. Use at least one core module from **Onchain OS skills** or **Uniswap skills**
5. Push code to a **public GitHub repo**
6. Provide a README including:
   - project intro
   - architecture overview
   - deployment address
   - Onchain OS / Uniswap skill usage
   - working mechanics
   - team members
   - project positioning in the X Layer ecosystem
7. Submit through the official **Google Form** before the deadline

### X Layer Arena recommended items

Recommended for stronger scoring:

- record a **1 to 3 minute demo video**
- upload the video to YouTube or Google Drive and submit the public link
- post a project intro on **X** using `#XLayerHackathon`
- ideally tag `@XLayerOfficial`
- include project name, short intro, and images or video in the post
- use more Onchain OS or Uniswap modules effectively for bonus value

### Skills Arena mandatory requirements

If submitting a reusable skill instead of the full app, official requirements include:

1. Create an **Agentic Wallet** as the project’s main onchain identity
2. Clarify relationships if multiple agents are deployed
3. Use at least one core module from **Onchain OS skills** or **Uniswap skills**
4. Push code to a **public GitHub repo**
5. Provide a README including:
   - project intro
   - architecture overview
   - deployment address
   - Onchain OS / Uniswap skill usage
   - working mechanics
   - team members
   - project positioning in the X Layer ecosystem
6. Submit through the official **Google Form** before the deadline

### Skills Arena recommended items

- build in the X Layer ecosystem if possible
- include a 1 to 3 minute demo video
- post on X with `#onchainos`
- include media and submission link

## 9. Official Scoring Criteria

According to the official hackathon page, judging is weighted across these four categories:

1. **Onchain OS / Uniswap integration and innovation** — 25%
2. **X Layer ecosystem integration** — 25%
3. **AI interactive experience** — 25%
4. **Product completeness** — 25%

This means the submission should not only be technically correct. It should also be:

- clearly integrated with the hackathon ecosystem
- easy to understand
- easy to verify
- strong in user flow

## 10. Submission Materials Checklist

### Must-have

- public GitHub repository
- strong README
- X Layer deployment evidence
- deployment addresses
- proof of Onchain OS or Uniswap skill usage
- team member list
- architecture explanation
- working mechanics explanation
- project positioning in X Layer ecosystem
- Agentic Wallet explanation
- final Google Form submission before deadline

### Strongly recommended

- 1 to 3 minute demo video
- X post with hashtag and visuals
- screenshots or diagrams in README
- chain-aware contract table
- “judge quick evaluation” section
- “what we built during the hackathon” section

## 11. SynthLaunch-Specific Priority List

If only a limited amount of time remains, prioritize in this order:

1. Rewrite README for judges
2. Add X Layer deployment addresses and explorer links
3. Explicitly describe Onchain OS / Uniswap usage
4. Clarify Agentic Wallet and agent relationships
5. Make the main visible user flow clearly X Layer-capable
6. Add demo video
7. Clean root-level repo noise

## 12. Open Gaps To Resolve Before Submission

These should be checked and filled in before final submission:

- exact X Layer deployment addresses
- exact Onchain OS / Uniswap modules used
- exact Agentic Wallet identity story
- exact team member list
- exact hackathon-period development delta
- whether live production defaults already reflect the intended X Layer path

## 13. Sources

Official references used for the requirement summary:

- OKX Build X Hackathon page: https://web3.okx.com/zh-hans/xlayer/build-x-hackathon
- Alternate localized OKX Build X Hackathon page reflecting the same requirements: https://web3.okx.com/ar/xlayer/build-x-hackathon
- Repository under review: https://github.com/V-SK/synthlaunch
