# SynthLaunch

**Agent-native token launch and monetization protocol on X Layer and BSC**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![X Layer](https://img.shields.io/badge/Chain-X%20Layer-black.svg)](https://www.oklink.com/x-layer)
[![BSC](https://img.shields.io/badge/Chain-BSC-yellow.svg)](https://bscscan.com)
[![OKX Onchain OS](https://img.shields.io/badge/OKX-Onchain%20OS-blue.svg)](https://web3.okx.com)

SynthLaunch is an **agent-native** token launch and monetization protocol that gives AI agents a full onchain stack: a soulbound identity, a dedicated treasury, a fee-routing custody, an evolvable NFT body, and a chat terminal backed by **OKX Onchain OS**.

Built for the **OKX Build X Hackathon — X Layer Arena**, SynthLaunch focuses on a single thesis:

> **AI agents should not just talk. They should own assets, earn revenue, and participate in onchain economies.**

---

## 🔗 Live Links

| | |
|---|---|
| 🌐 Website | https://synthlaunch.fun |
| 🛠 Source | https://github.com/V-SK/synthlaunch |
| 🐦 X / Twitter | [@synth_fun](https://twitter.com/synth_fun) |
| 🏁 Hackathon | OKX Build X Hackathon — **X Layer Arena** |
| 🧭 Primary chain | **X Layer (196)** |
| 🧭 Secondary chain | BSC (56) |

---

## 🎯 What SynthLaunch Does

SynthLaunch turns an AI agent into a first-class onchain economic actor by stacking four primitives:

1. **SynthID** — soulbound ERC-721 identity for an agent (name, platform, avatar, description). ERC-8004 compatible agent URI.
2. **SynthLaunchCustody** — per-agent treasury that collects a share of every token trade and lets only the agent's bound wallet claim it.
3. **NFAv2 (Non-Fungible Agent)** — BAP-578 style NFT body with balance, XP, and a whitelisted logic address so the agent can execute onchain actions safely.
4. **AI Terminal (`/ai`)** — an on-site chat interface for the agent backed by **OKX Onchain OS skills**: search tokens, read balances, quote swaps, execute swaps, all from the same wallet that owns the agent.

Put together, an agent becomes an **Agentic Wallet**: an identity with a treasury, a body, and the ability to act onchain through Onchain OS.

---

## 🏆 X Cup Edition: SportFi Prediction Arena

> **Live route**: `/fanfi/xcup` · Audit board: `/fanfi/xcup/audit`
> **Branch**: [`codex/fanfi-xcup-sportfi`](https://github.com/V-SK/synthlaunch/tree/codex/fanfi-xcup-sportfi)

**Synth SportFi Arena** is a Prediction Arena protocol built on top of SynthLaunch's agent-native primitives, targeting the **OKX X Cup** World Cup Season. It turns football fan attention into wallet-signed, X Layer-anchored prediction receipts with reputation-first settlement.

### What this branch ships

| Capability | Status | Where |
|---|---|---|
| AI-generated Prediction Arena Studio (5 templates) | ✅ live | `/fanfi/xcup` + [`src/components/fanfi/XCupCampaignStudio.tsx`](src/components/fanfi/XCupCampaignStudio.tsx) |
| Wallet-signed prediction receipts (EIP-191, 30 min replay window) | ✅ live | [`src/lib/fanfiProofAuth.ts`](src/lib/fanfiProofAuth.ts) |
| Real X Layer tx hash verification via RPC | ✅ live | [`src/lib/localFanfiMarketProofStore.ts`](src/lib/localFanfiMarketProofStore.ts#L74-L154) `verifyXLayerTxHash` |
| Production persistence (Supabase) | ✅ live | [`supabase/migrations/009_fanfi_tables.sql`](supabase/migrations/009_fanfi_tables.sql) |
| Settlement Engine (admin-signed resolve + REP scoring) | ✅ live | [`src/lib/fanfiSettle.ts`](src/lib/fanfiSettle.ts) + [`src/app/api/admin/fanfi-settle/route.ts`](src/app/api/admin/fanfi-settle/route.ts) |
| 5 OKX Onchain OS skills wired into arena | ✅ live | [`src/components/fanfi/XCupTradingProofPanel.tsx`](src/components/fanfi/XCupTradingProofPanel.tsx) |
| LLM-graded reason quality | 🔄 next phase | v1 uses transparent length heuristic |

### Why this fits X Cup judging

- **Innovation** — First wallet-signed prediction receipt protocol on X Layer with both EIP-191 message-binding **and** optional X Layer transaction anchoring.
- **X Layer Native** — Every receipt is anchored to chain 196: tx hashes are verified against X Layer RPC (`getTransactionReceipt`), and the receipt hash is required to appear in tx calldata OR the tx must target a known Synth X Layer contract (Custody / SynthID / NFAv2 / Token impls).
- **Market Value** — World Cup is the largest recurring global attention event. Predictions are the universal language of fans, and SportFi turns that into auditable onchain activity.
- **Completion** — Create → Sign → Settle → Score → Rank runs end-to-end. The five OKX Onchain OS skills are wired into the same surface so users go from prediction to swap in one tab.
- **Verifiability** — Every prediction is a signed EIP-191 message stored alongside its signature. The settle endpoint is also admin-signed (matches the existing `alice-distribute` admin pattern). Every state transition has an on-chain or off-chain audit trail.

### Quick judge eval path (5 minutes)

1. Visit **`/fanfi/xcup`** — see the World Cup countdown, 5 prediction templates, settlement explainer with live stats, OKX Trading Proof panel.
2. Open the **AI Terminal** (`/ai`) — run a real OKX Onchain OS quote query.
3. Visit **`/fanfi/xcup/audit`** — see the explicit ready/wired/next state for every component.
4. Read **[ARCHITECTURE.md](ARCHITECTURE.md)** for the dataflow.
5. Read **[SECURITY.md](SECURITY.md)** for the threat model.

### Setup

1. Apply Supabase migration 009 — paste the contents of [`supabase/migrations/009_fanfi_tables.sql`](supabase/migrations/009_fanfi_tables.sql) into the Supabase dashboard SQL editor. Creates 4 tables (`fanfi_campaigns`, `fanfi_market_proofs`, `fanfi_profiles`, `fanfi_completions`), all `IF NOT EXISTS` and idempotent.
2. Existing env vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OKX_*`) are sufficient. No new secrets required.
3. Settle is triggered by the SynthLaunch deployer wallet via wallet-signed `POST /api/admin/fanfi-settle` (no shared secret).

### Honest caveats

- **Reason quality scoring** is a v1 length heuristic (transparent thresholds 10/50/100 chars). LLM grading is next-phase work, clearly labeled in the UI.
- **Early-receipt bonus** awards full +20 REP for any receipt submitted before `settlement_cutoff`; per-edit and per-second granularity is next-phase.
- **Arena Board** on the landing page is **sample preview data**, labeled as such in the UI. The production board (`XCupLivePanel`) pulls live receipts from `/api/fanfi/market-proofs`.
- **Prediction receipts are not tradeable ERC-20s.** The `tokenAddress` field on a receipt is a deterministic receipt-identity hash (SHA-256 of the signature + signed message), used to anchor cross-references. Receipts surface on `/tokens` for visibility, but financial fields (`marketCap`, `price`) are explicitly zero — they are signed proofs, not assets.

---

## 🤖 Agentic Wallet — how it works

The hackathon requires an "Agentic Wallet as the project's main onchain identity". In SynthLaunch this is not a single contract — it's a composition designed so that identity, treasury, body, and execution are separated but linked:

```
                ┌──────────────────────────────────────────┐
                │            USER WALLET                   │
                │  (connected via wagmi + MetaMask / OKX)  │
                └───────────────┬──────────────────────────┘
                                │
          ┌─────────────────────┼──────────────────────────┐
          │                     │                          │
          ▼                     ▼                          ▼
  ┌───────────────┐    ┌────────────────┐      ┌───────────────────┐
  │   SynthID     │    │     NFAv2      │      │  SynthLaunchCustody│
  │ (soulbound)   │◄───┤ (NFT body +    │◄─────┤ (per-agent treasury│
  │ ERC-8004 URI  │    │  XP / logic)   │      │  signature-bound)  │
  └──────┬────────┘    └───────┬────────┘      └─────────┬──────────┘
         │                     │                         │
         │  agent identity     │  agent actions          │  agent revenue
         │                     │                         │
         ▼                     ▼                         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                    AI TERMINAL  ( /ai )                       │
  │   Backed by OKX Onchain OS skills:                            │
  │     - token search  - balances  - total value                 │
  │     - quote         - swap aggregator                         │
  └──────────────────────────────────────────────────────────────┘
```

**Binding**: An agent's owner calls `SynthLaunchCustody.bindWallet(agentName, wallet, nonce, signature)`. The signature is verified against a protocol signer, which pins the wallet to the agent name. Only that wallet can `claim(token)` the fees collected for that agent. This wallet is the Agentic Wallet.

**Multi-agent relationship**: One user can own many agents. Each agent has:
- exactly one `SynthID` (soulbound, cannot be moved)
- optionally a `NFAv2` body (with a whitelisted logic contract, see `AgentLogic` / `AgentLogicPro`)
- exactly one bound wallet in `SynthLaunchCustody` (resettable by owner via signature)

Agents are first-class and independent. A user's dashboard simply aggregates agents they own.

---

## 🧭 Why X Layer

We chose **X Layer** as our primary hackathon submission chain because SynthLaunch is fundamentally about **high-frequency onchain interaction for AI-native products**:

- **AI agents generate lots of small transactions** — token launches, tax claims, treasury moves, swap actions. X Layer's low-cost EVM environment makes these economic instead of toy.
- **OKX Onchain OS lives natively on X Layer** — the same tab that holds the agent's chat terminal can introspect balances, search tokens, and execute swaps through Onchain OS DEX aggregator without leaving the app.
- **Composable with the OKX wallet + OKB ecosystem** — users already in the OKX environment can launch an agent, bind a wallet, and start earning in a few clicks.

The repository supports BSC as a secondary chain for continuity with SynthLaunch's existing user base, but the primary hackathon submission path is X Layer.

---

## 🧠 OKX Onchain OS Integration

SynthLaunch uses **five** Onchain OS core skills, wired end-to-end from a user-facing `/ai` chat terminal to signed onchain execution.

| Skill | OKX DEX endpoint | Where it lives in code | User-facing surface |
|---|---|---|---|
| Token Search | `/api/v6/dex/market/token/search` | [`src/lib/okx.ts`](src/lib/okx.ts) `okxTokenSearch()` | `/ai` — "price of X", "search Y" |
| Balances | `/api/v6/dex/balance/all-token-balances-by-address` | `okxBalances()` | `/ai` — "what's in my wallet?" |
| Total Value | `/api/v6/dex/balance/total-value-by-address` | `okxTotalValue()` | `/ai` — portfolio summary |
| Quote | `/api/v6/dex/aggregator/quote` | `okxQuote()` | `/ai` — "how much Y for 1 X?" |
| Swap Aggregator | `/api/v6/dex/aggregator/swap` | `okxSwap()` | `/ai` — "swap 1 OKB for USDC" → user signs → broadcast |

The full flow — intent detection, skill invocation, and on-screen rendering — lives in:

- [`src/app/api/ai/chat/route.ts`](src/app/api/ai/chat/route.ts) — LLM intent → OKX skill → tool result
- [`src/components/ai/AiTerminalPage.tsx`](src/components/ai/AiTerminalPage.tsx) — chat UI
- [`src/components/ai/AiToolCard.tsx`](src/components/ai/AiToolCard.tsx) — renders each OKX tool result
- [`src/app/api/okx/*`](src/app/api/okx) — thin REST wrappers for each skill

Swap execution is **non-custodial**: the aggregator returns an unsigned tx, the user's wallet signs it, and the frontend broadcasts via viem. SynthLaunch never touches the private key.

---

## 📦 Smart Contracts

### X Layer (primary — 196)

All contracts below were deployed and verified on OKLink as part of this hackathon submission.

| Contract | Address | Purpose |
|---|---|---|
| SynthLaunchCustody | [`0xb381e840AAB505132506781eAFD3c38398B58462`](https://www.oklink.com/x-layer/address/0xb381e840AAB505132506781eAFD3c38398B58462) | Agent treasury + fee routing + signature-bound claim |
| SynthID | [`0xE7369f4bA311f59C7476e4A0279d42F767cddd20`](https://www.oklink.com/x-layer/address/0xE7369f4bA311f59C7476e4A0279d42F767cddd20) | Soulbound ERC-721 agent identity (ERC-8004 URI) |
| NFAv2 | [`0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E`](https://www.oklink.com/x-layer/address/0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E) | Non-Fungible Agent body with logic allowlist |
| Flap Portal | [`0xb30D8c4216E1f21F27444D2FfAee3ad577808678`](https://www.oklink.com/x-layer/address/0xb30D8c4216E1f21F27444D2FfAee3ad577808678) | Token launch entrypoint (ecosystem) |

Deployment receipts and constructor args are committed in [`deployments/xlayer.json`](deployments/xlayer.json).

### BSC (secondary — 56)

| Contract | Address | Purpose |
|---|---|---|
| SynthLaunchCustody v11 | [`0x3Fa33A0fb85f11A901e3616E10876d10018f43B7`](https://bscscan.com/address/0x3Fa33A0fb85f11A901e3616E10876d10018f43B7#code) | Fee custody with 48h Timelock |
| SynthTimelock | [`0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D`](https://bscscan.com/address/0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D#code) | Timelock controller |
| SynthID | [`0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb`](https://bscscan.com/address/0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb#code) | Soulbound agent identity |
| NFAv2 | [`0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19`](https://bscscan.com/address/0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19#code) | Non-Fungible Agent body |

---

## 🧱 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User / AI Agent                          │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────▼──────────────┐
          │     Next.js 14 Frontend      │
          │  (chain selector: 56 / 196)  │
          └──────────────┬──────────────┘
                         │
     ┌───────────────────┼──────────────────┐
     │                   │                  │
     ▼                   ▼                  ▼
┌──────────┐   ┌────────────────┐   ┌────────────────┐
│  API     │   │ Onchain OS     │   │  wagmi + viem  │
│  Routes  │   │ Skills         │   │  direct calls  │
│ (Next.js)│   │ (src/lib/okx)  │   │                │
└────┬─────┘   └───────┬────────┘   └───────┬────────┘
     │                 │                    │
     │                 ▼                    │
     │         ┌────────────────┐           │
     │         │   OKX DEX API  │           │
     │         │  (Onchain OS)  │           │
     │         └────────────────┘           │
     │                                      │
     ▼                                      ▼
┌─────────────┐                 ┌──────────────────────┐
│  Supabase   │                 │  X Layer / BSC RPC   │
│  (index +   │                 │  Custody / SynthID / │
│   sessions) │                 │  NFAv2 / Flap        │
└─────────────┘                 └──────────────────────┘
```

**Tech stack**:
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem
- Contracts: Solidity 0.8.20, Hardhat, OpenZeppelin v5
- Data: Supabase (Postgres)
- Infra: Vercel (frontend), BSC + X Layer (contracts)

---

## 🛣️ Core User Flow

1. User lands on [synthlaunch.fun](https://synthlaunch.fun) and connects wallet (OKX Wallet / MetaMask).
2. User switches chain to **X Layer** in the UI chain selector.
3. User mints a **SynthID** for their agent (soulbound identity).
4. User launches a token via the Flap Portal, routing trade tax to **SynthLaunchCustody**.
5. User binds a claim wallet to the agent via `bindWallet(signature)`.
6. User mints an **NFAv2** body for the agent and attaches a whitelisted logic.
7. User opens the **AI Terminal** at `/ai` and interacts with their agent. The terminal uses OKX Onchain OS skills to check balances, search tokens, quote and execute swaps.
8. Trade fees accumulate in Custody. The bound wallet calls `claim(token)` to withdraw the agent's share.

---

## 🚀 Quick Start

```bash
git clone https://github.com/V-SK/synthlaunch.git
cd synthlaunch
npm install
cp .env.example .env.local
# fill in the values (see .env.example for the list)
npm run dev
```

Open http://localhost:3000 and switch the chain selector to X Layer.

### Contract development

```bash
# Compile
npx hardhat compile

# Deploy to X Layer (Custody + SynthID + NFAv2)
TS_NODE_PROJECT=tsconfig.hardhat.json \
  npx hardhat run scripts/deploy-xlayer.ts --network xlayer

# Result is written to deployments/xlayer.json
```

Environment required for X Layer deploy:
- `EVA_PRIVATE_KEY` — deployer private key (funded with OKB)
- Optional: `SIGNER_ADDRESS`, `OPERATOR_ADDRESS`, `PLATFORM_FEE_RATE`, `NFA_TREASURY`

---

## 👩‍⚖️ Judge Quick Evaluation

If you are reviewing this project for the hackathon, here is the fastest path to verify everything:

1. **Open the live app** → https://synthlaunch.fun and switch the chain selector to **X Layer**.
2. **Open the AI Terminal** → https://synthlaunch.fun/ai — this is the Onchain OS surface.
3. Type a few prompts in the terminal:
   - `balance` → exercises `okxBalances()` + `okxTotalValue()`
   - `price of USDC` → exercises `okxTokenSearch()`
   - `swap 0.01 OKB to USDC` → exercises `okxQuote()` + `okxSwap()`, returns an unsigned tx for your wallet to sign
4. **Verify contracts on OKLink**:
   - [Custody](https://www.oklink.com/x-layer/address/0xb381e840AAB505132506781eAFD3c38398B58462)
   - [SynthID](https://www.oklink.com/x-layer/address/0xE7369f4bA311f59C7476e4A0279d42F767cddd20)
   - [NFAv2](https://www.oklink.com/x-layer/address/0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E)
5. **Read the Onchain OS glue code** in [`src/lib/okx.ts`](src/lib/okx.ts) and [`src/app/api/ai/chat/route.ts`](src/app/api/ai/chat/route.ts).
6. **Read the multi-chain config** in [`src/lib/contracts.ts`](src/lib/contracts.ts) (see `CHAIN_CONFIG[196]`).
7. **Read the deployment receipts** in [`deployments/xlayer.json`](deployments/xlayer.json).

Total time: around 5 minutes.

---

## 🧩 Repository Layout

```
contracts/           Solidity (Custody, SynthID, NFAv2, Flap helpers, …)
deployments/         Deployment receipts per chain (xlayer.json)
docs/
  hackathon/         Internal planning docs (TASK-*, audit, timelock plan)
  audits/            Audit package and checklist
scripts/
  deploy-xlayer.ts   One-shot X Layer deployment
  debug/             Ad-hoc chain query scripts
  ops/               Ops scripts (twitter bot runner, etc.)
src/
  app/               Next.js App Router pages + API routes
    ai/              AI terminal page
    api/
      ai/chat        Intent detection + OKX skill dispatch
      okx/           REST wrappers for OKX Onchain OS skills
      launch/        Chain-aware token launch endpoint
  components/
    ai/              AI terminal UI (split into ChatPane/Sidebar/StatusBar/ToolCard)
  lib/
    okx.ts           OKX Onchain OS client (signed HMAC)
    contracts.ts     Multi-chain contract config (BSC + X Layer)
    wagmi.ts         wagmi chain registration
supabase/migrations/ Postgres schema
test/                Contract tests (hardhat)
```

---

## 🔐 Security Notes

- All fund-handling contracts use OpenZeppelin `ReentrancyGuard`.
- `renounceOwnership` is disabled on SynthLaunchCustody.
- The X Layer Custody is signer-bound: a wallet can only claim after presenting a valid EIP-191 signature from the protocol signer.
- The BSC Custody is additionally protected by a 48-hour Timelock on all owner operations.
- NFAv2 uses a `logicAddress` allowlist — arbitrary contracts cannot be attached as agent logic.
- OKX API secrets are server-side only (`src/lib/okx.ts`), never sent to the browser.
- No private keys are committed; all deploy scripts read from `.env.local`.

---

## 👤 Team

**Soren Lin** — sole builder
- GitHub: [@V-SK](https://github.com/V-SK)
- X: [@synth_fun](https://twitter.com/synth_fun)

---

## 🛠️ What We Built During The Hackathon

This is the delta we added to turn SynthLaunch into a stronger X Layer submission:

- **Deployed the full SynthLaunch stack to X Layer** (Custody, SynthID, NFAv2), all verified on OKLink. See `deployments/xlayer.json`.
- **Rebuilt the AI terminal** around OKX Onchain OS skills: split `AiTerminalPage` into focused components (`AiChatPane`, `AiSidebar`, `AiStatusBar`, `AiToolCard`), wired intent detection in `/api/ai/chat` to the five OKX skills.
- **Multi-chain config**: extended `CHAIN_CONFIG` to carry chain-specific Flap / Custody / token implementations for both BSC (56) and X Layer (196).
- **Repository hardening**: moved internal docs into `docs/hackathon/`, audit materials into `docs/audits/`, one-shot debug scripts into `scripts/debug/`, and removed committed build artifacts.
- **Rewrote this README** around the four judging criteria (Onchain OS integration, X Layer ecosystem, AI experience, product completeness) so that evaluating the project takes minutes instead of hours.
- **Agentic Wallet framing**: articulated the SynthID + NFAv2 + Custody composition as a single Agentic Wallet primitive (see section above).

---

## 🗺️ Roadmap

- Deepen multi-chain data parity (chain-aware tokens / leaderboard APIs)
- Unify BSC and X Layer fee scanners into a single multi-chain service
- Expand Onchain OS coverage: position queries, historical PnL, limit orders
- Open SynthID and NFAv2 up to third-party agent frameworks (ERC-8004 adapters)

---

## 📜 License

[MIT](LICENSE)

---

Built for the **OKX Build X Hackathon — X Layer Arena**.
