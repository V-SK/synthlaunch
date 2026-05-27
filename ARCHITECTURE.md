# SynthLaunch Architecture

This document covers the system architecture for both **SynthLaunch core** (agent-native token launch + Onchain OS terminal) and **Synth SportFi Arena** (the X Cup prediction-receipt branch built on top).

---

## System Overview

```mermaid
flowchart TB
    User[User Wallet<br/>MetaMask / OKX]

    subgraph Frontend["Next.js Frontend (Vercel)"]
        Studio["/fanfi/xcup<br/>Prediction Arena Studio"]
        Terminal["/ai<br/>AI Terminal"]
        Audit["/fanfi/xcup/audit<br/>Readiness Board"]
    end

    subgraph API["API Routes (Next.js)"]
        FanFiAPI["/api/fanfi/*<br/>(receipts, missions, campaigns,<br/>copilot, market-proofs)"]
        OKXAPI["/api/okx/*<br/>(search, balances, quote, swap)"]
        SettleAPI["/api/admin/fanfi-settle<br/>(deployer-signed)"]
        TokensAPI["/api/tokens?chainId=196"]
    end

    subgraph Auth["Auth Layer"]
        EIP191["EIP-191 verifyMessage<br/>30 min replay window"]
        AdminSig["Admin wallet signature<br/>(deployer 0x0198...)"]
    end

    subgraph Storage["Persistence"]
        Supabase[("Supabase<br/>fanfi_campaigns<br/>fanfi_market_proofs<br/>fanfi_profiles<br/>fanfi_completions<br/>tokens")]
        LocalFS[(".local-data<br/>(dev fallback only)")]
    end

    subgraph Onchain["X Layer Mainnet (chain 196)"]
        XLayer["X Layer RPC<br/>(viem getTransaction +<br/>getTransactionReceipt)"]
        Contracts["Custody / SynthID / NFAv2<br/>Flap Portal / Token impls"]
    end

    subgraph OKX["OKX Onchain OS"]
        Skills["Token Search · Balances<br/>Total Value · Quote · Swap"]
    end

    User -->|connect + sign| Frontend
    Studio -->|signed receipts| FanFiAPI
    Terminal -->|skill calls| OKXAPI
    FanFiAPI --> EIP191
    SettleAPI --> AdminSig
    EIP191 --> Supabase
    AdminSig --> Supabase
    FanFiAPI -->|tx hash verify| XLayer
    OKXAPI -->|HMAC| Skills
    Supabase --> TokensAPI
    LocalFS -.dev only.-> FanFiAPI
    Contracts -.referenced.-> XLayer
```

---

## SportFi Prediction Arena: Data Flow

### 1. Submit a Signed Receipt

```mermaid
sequenceDiagram
    actor User
    participant Studio as XCupCampaignStudio
    participant Wallet as User Wallet
    participant API as /api/fanfi/market-proofs
    participant Auth as fanfiProofAuth
    participant Store as fanfi_market_proofs (Supabase)
    participant XLayer as X Layer RPC

    User->>Studio: pick template + fill direction/probability/reason
    Studio->>Studio: buildArenaObjective() bundles fields
    Studio->>Studio: buildFanFiReceiptMessage() canonicalizes
    Studio->>Wallet: signMessage(receiptMessage)
    Wallet->>User: approve
    User->>Wallet: confirm
    Wallet-->>Studio: signature
    Studio->>API: POST { fanId, templateId, objective, ..., signature, signatureMessage, timestamp, xLayerTxHash? }
    API->>Auth: verifyFanFiReceiptSignature
    Auth->>Auth: rebuild expected message
    Auth->>Auth: check message equality
    Auth->>Auth: verifyMessage(EIP-191)
    Auth->>Auth: timestamp within 30 min
    alt xLayerTxHash provided
        API->>XLayer: getTransaction + getTransactionReceipt
        XLayer-->>API: tx + receipt
        API->>API: assert from == wallet, status == success
        API->>API: assert calldata refs receipt_hash OR target is known Synth contract
    end
    API->>Store: INSERT (idempotent via unique wallet_signature index)
    Store-->>API: row
    API-->>Studio: { launch, campaign, launches, progress }
    Studio->>User: rendered receipt + leaderboard refresh event
```

**Key invariants enforced:**
- Signature must match a server-reconstructed canonical message (any mutation breaks verification).
- Timestamp must be within 30 min (replay protection).
- Idempotency: `wallet_signature` is a unique index in Supabase. Replaying the same signed receipt returns the existing row, not a duplicate.
- X Layer tx (when provided) is independently verified via RPC: the tx must have been sent **by** the submitting wallet, must be successful, and must either reference the receipt hash in its calldata or target a known SynthLaunch X Layer contract.

### 2. Resolve an Arena (Settlement)

```mermaid
sequenceDiagram
    actor Admin as Deployer Wallet
    participant Curl as cURL / Admin UI
    participant API as /api/admin/fanfi-settle
    participant Auth as verifyAdmin
    participant Scoring as fanfiSettle.scoreReceipt
    participant Store as fanfi_market_proofs

    Admin->>Curl: build settle message<br/>(templateId, outcome, timestamp)
    Admin->>Curl: sign with deployer wallet
    Curl->>API: POST { templateId, targetMatch, outcome, dryRun? }<br/>headers: x-admin-signature, x-admin-message
    API->>Auth: verifyAdmin(req, body)
    Auth->>Auth: assert msg includes Template + Outcome from body
    Auth->>Auth: timestamp within 5 min
    Auth->>Auth: verifyMessage against deployer address
    Auth-->>API: ok
    API->>Store: SELECT * WHERE template_id = $1 AND status = 'open'
    Store-->>API: receipts[]
    loop for each receipt
        API->>Scoring: scoreReceipt(receipt, outcome)
        Scoring->>Scoring: direction match? +80
        Scoring->>Scoring: probability distance? +0-60
        Scoring->>Scoring: submitted before cutoff? +20
        Scoring->>Scoring: reason quality? +0-40
        Scoring-->>API: { directionPoints, probabilityPoints, ..., total }
        alt not dryRun
            API->>Store: UPDATE settlement_status='resolved',<br/>resolved_at, resolved_outcome,<br/>reputation_points, reputation_breakdown
        end
    end
    API-->>Curl: { ok, settled[], count, scoringRules, errors? }
```

**Why this is admin-only:** Settlement is a write-amplification operation (one call can update many receipts). The signature requirement prevents anyone from forging a "resolved" state. The admin signature also binds to the specific (templateId, outcome) combination — so signing one settle and trying to replay it as a different settle is rejected.

---

## Persistence Layer

```
                     ┌────────────────────────────────┐
                     │       Application Layer        │
                     │   src/lib/localFanfi*Store.ts  │
                     │   ─ getFanFi*                  │
                     │   ─ upsertFanFi*               │
                     │   ─ createFanFiMarketProof     │
                     └──────────────┬─────────────────┘
                                    │
                  isSupabaseConfigured() ?
                                    │
                       ┌────────────┴────────────┐
                       │                         │
                       ▼                         ▼
            ┌──────────────────────┐  ┌──────────────────────┐
            │      Supabase        │  │   .local-data/       │
            │ (production / staging│  │   (dev only)         │
            │  / preview)          │  │                      │
            │                      │  │  fanfi-*.json files  │
            │  fanfi_campaigns     │  │                      │
            │  fanfi_market_proofs │  │                      │
            │  fanfi_profiles      │  │                      │
            │  fanfi_completions   │  │                      │
            └──────────────────────┘  └──────────────────────┘
```

**Migration**: [`supabase/migrations/009_fanfi_tables.sql`](supabase/migrations/009_fanfi_tables.sql)

**Fallback rule**: Every store function calls `isSupabaseConfigured()` (true iff `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_KEY` are both present). When true, all reads and writes go to Supabase. When false (rare in production, common in local dev), the same calls fall back to JSON files under `.local-data/` (or `/tmp/synthlaunch/` in production with `DISABLE_LOCAL_FANFI_STORE` not set, but production is expected to have Supabase configured).

The fallback exists so developers can run the full FanFi flow locally without Supabase. It is not intended for production.

---

## OKX Onchain OS Integration

Five skills are wired into the application:

| Skill | OKX Endpoint | App Route | UI surface |
|---|---|---|---|
| Token Search | `/api/v6/dex/market/token/search` | `/api/okx/token-search` | `XCupTradingProofPanel`, AI Terminal |
| Balances | `/api/v6/dex/balance/all-token-balances-by-address` | `/api/okx/balances` | `XCupTradingProofPanel`, AI Terminal |
| Total Value | `/api/v6/dex/balance/total-value-by-address` | `/api/okx/balances` (combined) | `XCupTradingProofPanel`, AI Terminal |
| Quote | `/api/v6/dex/aggregator/quote` | `/api/okx/quote` | `XCupTradingProofPanel`, AI Terminal |
| Swap | `/api/v6/dex/aggregator/swap` | `/api/okx/swap` | AI Terminal (signed by user wallet) |

**HMAC signing** lives in [`src/lib/okx.ts`](src/lib/okx.ts). The API key, secret, passphrase, and project ID are server-side environment variables and never leave the Next.js server.

**Non-custodial swap execution**: the swap aggregator returns an unsigned transaction. The frontend asks the user's wallet to sign it. The app never holds a private key.

---

## Key Files (SportFi branch)

| Path | Purpose |
|---|---|
| `src/app/fanfi/xcup/page.tsx` | Arena landing route |
| `src/app/fanfi/xcup/audit/page.tsx` | Readiness board |
| `src/components/fanfi/XCupFanFiPageContent.tsx` | Hero, countdown, sample arena board, story sections |
| `src/components/fanfi/XCupCampaignStudio.tsx` | Create / save / sign prediction receipts |
| `src/components/fanfi/XCupLivePanel.tsx` | Live X Layer asset feed + leaderboard (filters FanFi receipts from market cap aggregate) |
| `src/components/fanfi/XCupSettlementPanel.tsx` | Live settlement stats + scoring rules + receipt schema |
| `src/components/fanfi/XCupMissionsPanel.tsx` | Mission tracker with per-mission EIP-191 signatures |
| `src/components/fanfi/XCupTradingProofPanel.tsx` | OKX Onchain OS skill panel |
| `src/lib/fanfiCampaigns.ts` | Template registry (5 X Cup presets) |
| `src/lib/fanfiCopilot.ts` | Deterministic AI persona / mission / launch pack generator |
| `src/lib/fanfiMissions.ts` | Mission registry |
| `src/lib/fanfiProofSignature.ts` | Canonical EIP-191 message builders (3 contexts: receipt, mission, campaign) |
| `src/lib/fanfiProofAuth.ts` | Server-side signature verification + replay guard |
| `src/lib/fanfiSettle.ts` | Reputation scoring engine (+80/+0-60/+20/+0-40) |
| `src/lib/localFanfiStore.ts` | Profile + completion + leaderboard store (Supabase or local) |
| `src/lib/localFanfiCampaignStore.ts` | Campaign draft store (Supabase or local) |
| `src/lib/localFanfiMarketProofStore.ts` | Market proof store + X Layer tx verification (Supabase or local) |
| `src/app/api/fanfi/*` | 9 REST endpoints |
| `src/app/api/admin/fanfi-settle/route.ts` | Settlement endpoint |
| `supabase/migrations/009_fanfi_tables.sql` | Persistence schema |
| `SECURITY.md` | Threat model |

---

## Build / Deploy

- **Framework**: Next.js 14 (App Router)
- **Web3**: wagmi v2 + viem
- **Auth**: EIP-191 (`personal_sign`)
- **Persistence**: Supabase (Postgres) + `@supabase/supabase-js`
- **Hosting**: Vercel auto-preview per branch
- **Chain**: X Layer (chain ID 196), BSC (chain ID 56) supported
- **TypeScript**: strict mode; build is `npm run build`, type check is `npx tsc --noEmit`

**Vercel auto-preview**: Every push to the `codex/fanfi-xcup-sportfi` branch triggers a Preview deployment. The Preview URL stays stable (the `*-git-codex-fanfi-xcup-sportfi-*.vercel.app` alias) across re-deploys.
