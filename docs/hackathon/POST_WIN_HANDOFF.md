# SynthLaunch — Post-Win Handoff

> **Status as of 2026-04-23**: 🏆 **Won 1st in OKX Build X Hackathon — X Layer Arena**.
> Now in **post-win partnership phase** with OKX X Layer team.
> Soren (founder, @synth_fun) is in primary control. This doc lets an assistant
> resume operations without re-reading the entire prior conversation.

---

## 0. TL;DR (read this first)

- **We won 1st place** at OKX Build X Hackathon, X Layer Arena (~2,000 USDC + official PR + partnership opportunity).
- **OKX is preparing to publicly announce SynthLaunch** in the next few days. The site, repo, and whitepaper are now X Layer-first to support that announcement.
- **Two OKX contacts matter**: Keith Loh (X Layer & Wallet Partnerships, Singapore) and Chenyang Liu (Senior PM, X Layer, Hong Kong). Both have been actively engaging Soren since hackathon submission.
- **Real value is the partnership, not the prize**. The $2K USDC is symbolic. The official PR + Wallet feature + path to OKX Vision Fund is the actual outcome.
- **BAP-578 PR #22 is mergeable, 69/69 tests passing, 0 open Greptile issues** — should merge this week, gives Soren a "BAP-578 reference implementation contributor" credential.

---

## 1. What's Live / Done

### Code / repo state

- **GitHub**: https://github.com/V-SK/synthlaunch (public)
- **Latest commit at handoff time**: `3c37c8d fix(/tokens): chain-aware stats + leaderboard, plus i18n hero bug`
- **Site**: https://synthlaunch.fun (Vercel auto-deploys from `main`)
- **All BSC-first language stripped** site-wide as of commit `47e44ac`. X Layer is now the primary chain across hero, /tokens, /nfa, /identity, whitepaper, NFT metadata. BSC stays as supported secondary.

### X Layer deployments (chain 196, all OKLink verified)

| Contract | Address |
|---|---|
| SynthLaunchCustody | [`0xb381e840AAB505132506781eAFD3c38398B58462`](https://www.oklink.com/x-layer/address/0xb381e840AAB505132506781eAFD3c38398B58462) |
| SynthID | [`0xE7369f4bA311f59C7476e4A0279d42F767cddd20`](https://www.oklink.com/x-layer/address/0xE7369f4bA311f59C7476e4A0279d42F767cddd20) |
| NFAv2 | [`0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E`](https://www.oklink.com/x-layer/address/0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E) |

Deployment receipts: [`deployments/xlayer.json`](../../deployments/xlayer.json)
Deploy script: [`scripts/deploy-xlayer.ts`](../../scripts/deploy-xlayer.ts)
Deployer wallet: `0x0198b366978fF0ee67BF308B0367c9B6FCeD2725` (key in `.env.local`, never commit)

### BSC deployments (chain 56, kept supported)

| Contract | Address |
|---|---|
| SynthLaunchCustody v11 | `0x3Fa33A0fb85f11A901e3616E10876d10018f43B7` |
| SynthTimelock (48h) | `0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D` |
| SynthID | `0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb` |
| NFAv2 | `0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19` |

### OKX Onchain OS integration (the hackathon evaluation hook)

5 skills wired end-to-end through `/ai` AI Terminal:
- Token Search, Balances, Total Value, Quote, Swap Aggregator
- Implementation: [`src/lib/okx.ts`](../../src/lib/okx.ts)
- Dispatch: [`src/app/api/ai/chat/route.ts`](../../src/app/api/ai/chat/route.ts)
- UI: [`src/components/ai/AiTerminalPage.tsx`](../../src/components/ai/AiTerminalPage.tsx)
- Live: https://synthlaunch.fun/ai

Health check: https://synthlaunch.fun/api/ai/health (LLM/OKX/Supabase should all be `live`)

### BAP-578 PR (independent BSC-side credential)

- **PR**: https://github.com/ChatAndBuild/non-fungible-agents-BAP-578/pull/22
- **Status**: OPEN, mergeable, 69/69 tests passing, 0 open Greptile issues
- **Reviewer**: Christel Buchanan (founder of ChatAndBuild, inventor of NFAs)
- **What we proposed**: `logicAddress` allowlist as the security pattern for BAP-578's reference implementation
- **Expected merge**: 24-72 hours from 2026-04-22
- After merge: write "**SynthLaunch is the BAP-578 reference implementation contributor**" anywhere relevant (README top, X bio, partnership pitches)

### Mobile wallet

- **SYNTH Wallet Android v2026.04.17 APK** hosted at [GitHub Release](https://github.com/V-SK/synthlaunch/releases/tag/wallet-v2026.04.17)
- Download button in site header (`src/components/WalletDownload.tsx`)
- Privacy policy at https://synthlaunch.fun/privacy (App Store ready)
- iOS marked "Coming soon"

---

## 2. The OKX Relationship (operational rules)

### Keith Loh — Partnerships
- **Telegram**: @Defi_Keith
- **Twitter**: [@defi_keith](https://x.com/defi_keith)
- **LinkedIn**: https://www.linkedin.com/in/keithlohjj/
- **Location**: Singapore
- **Role**: OKX X Layer & Wallet Partnerships
- **History**: Brought Soren into the X Layer ecosystem (the original invitation)
- **Talk to him about**: Wallet feature placement, official PR, partnership announcements, OKX Ventures intro, X Layer events, ecosystem positioning

### Chenyang Liu — Senior PM
- **Telegram**: (Chenyang | OKX & X Layer)
- **LinkedIn**: https://hk.linkedin.com/in/chenyang-liu-209219194
- **Location**: Hong Kong
- **Role**: Senior Product Manager, OKX (X Layer focus)
- **History**: Caught the BSC-only homepage bug pre-announcement, sent the strategic 5-fields list ("we are aiming big and aiming high at AI narrative"), confirmed announcement is coming "in a few days"
- **Talk to him about**: Onchain OS technical integration, X Layer product roadmap, agent UX, anything code-level

### Last messages exchanged (context for any follow-up)

**To Chenyang** (right after winning, queued template):
```
🏆 thank you bro — wouldn't have happened without you and Keith catching
what needed to land. Grateful for the honest pushes (the homepage one in
particular saved me from looking like a BSC project on announcement day).

ready to go deep on the X Layer roadmap whenever you are. quick call or
i can send a 1-pager — your call.
```

**To Keith** (right after winning, queued template):
```
Just saw the result 🏆 thank you for bringing me into X Layer in the
first place — Keith, this win belongs to you as much as it does to me.
Looking forward to building what's next together 🫡
```

### Hard rules for messaging OKX

- ✅ **DO** match their tone: warm, casual, professional, emoji-light
- ✅ **DO** mention the other person when writing to one ("say hey to Keith")
- ✅ **DO** lead with concrete data (commits, contract addresses, test results) not adjectives
- ✅ **DO** offer "call OR doc" when proposing next step — let them pick the format
- ❌ **DO NOT** double-text. If they don't reply, **wait**. They are senior people, they're busy.
- ❌ **DO NOT** ask for grants / listings / ventures intros early. Let them open those doors.
- ❌ **DO NOT** mention Alice (Soren's parallel L1 project) by name — frame any AI-infra ambitions as "AI-native infrastructure" / "compute, reasoning, agent coordination", never as "another L1". X Layer team must not feel they're competing with Soren's other chain.
- ❌ **DO NOT** overclaim BAP-578 status — it's "PR under review by the standard maintainer" until merged, then "reference implementation contributor". **Never say "merged into BSC official"** (BAP-578 is in `bnb-chain/BEPs` but the reference impl repo is `ChatAndBuild/...`, an ecosystem partner, not BNB Chain core).

---

## 3. Immediate Watch Items (next 72 hours)

| Item | What to watch | Who acts |
|---|---|---|
| Reply from Keith / Chenyang to win-message | They likely send "🙏" or "amazing 🚀". If they ask anything specific (1-pager, call), **respond within 1 hour during their work hours** | Soren |
| OKX official announcement post on X / blog | Will mention SynthLaunch by handle. **Quote-retweet from @synth_fun within 30 min**, tag Keith + Chenyang's company handles | Soren / assistant |
| BAP-578 PR #22 merge | Watch the PR. When merged, immediately update README top to "BAP-578 reference implementation contributor" + send Chenyang short note | Assistant can monitor; Soren replies |
| Vercel deploy status | https://vercel.com/dashboard — keep `synthlaunch` green Ready. If it ever goes red during the next 14 days, **fix or revert immediately** | Soren / assistant |
| Twitter @synth_fun mentions | OKX team may quote-mention. Engage warmly within an hour | Soren |

---

## 4. The 1-Pager (probably needed in 24-48 hours)

Chenyang's last substantive message asked for a roadmap proposal. He's likely to ask "send the 1-pager" any time now. **Have it ready before they ask.**

### What goes in the 1-pager

```
SynthLaunch × X Layer — 90 Day Roadmap

[Header: logo + tagline + chain badges]

Phase 1 — Now (Day 0-30)
- All new features ship X Layer first, BSC stays supported
- Onchain OS skill set deepening: add limit orders, position queries
- MCP server for SynthLaunch (so other agents can call SynthLaunch via MCP)
- x402 integration for SynthID register / NFA mint / claim flows
- SynthID mint events surfaced in OKX Wallet Discover (if Keith routes us)

Phase 2 — Day 30-60
- Multi-agent coordination layer (NFAv2 logic contracts call each other; Custody pays per-call)
- Plugin store: publish "SynthLaunch Launch Skill", "SynthLaunch Agent Registry Skill"
- First 100 agents minted on X Layer (target with co-marketing from Keith's team)

Phase 3 — Day 60-90
- Agent fleet primitives: register/discover/route between agents via SynthID
- AI Terminal v2: agent-to-agent direct messaging on-chain via Custody payments
- Co-host an agent-economy event with X Layer team (TBD)

Asks (small)
- OKX Wallet feature placement during Phase 1
- One co-tweet from @XLayerOfficial when Phase 1 ships
- Intro to 2-3 X Layer projects we could compose with

Team
- Soren Lin (solo) — github.com/V-SK — twitter.com/synth_fun

Receipts
- 3 contracts deployed + verified on X Layer (OKLink links)
- BAP-578 reference impl contributor (PR #22 in ChatAndBuild repo)
- 100+ tokens launched on BSC, peak $500K market cap (history)
- 5 Onchain OS skills wired into AI Terminal at synthlaunch.fun/ai
- OKX Build X Hackathon — X Layer Arena 1st place
```

### How to deliver

- Format: **PDF** preferred. Notion shareable link as backup.
- Length: **strictly 1 page**. If overflows, cut Phase 3.
- Send via **same Telegram chat** with Chenyang. Caption:
  > "Here's the 1-pager. Anything you'd want me to expand or trim?"
- Do **not** attach to a long message. Just the PDF + that one line.

---

## 5. What the Assistant Can Safely Do Without Asking

- Monitor https://synthlaunch.fun for uptime; if down >5 min, alert Soren
- Monitor BAP-578 PR #22 for status changes
- Monitor https://vercel.com/dashboard for failed deploys
- Read incoming Telegram from Keith / Chenyang and **draft** replies for Soren to send
- Check OKX official channels for the announcement post
- Read this doc and adjacent files (HANDOFF.md, SUBMISSION.md) for context

## 6. What the Assistant Must Always Ask Soren First

- Sending any message to Keith / Chenyang on Soren's behalf
- Posting from @synth_fun
- Touching X Layer contracts (Custody, SynthID, NFAv2 owner operations)
- Touching BSC Custody / Timelock
- Pushing breaking changes to `main`
- Anything involving the deployer private key
- Replying to OKX official announcement posts

## 7. What's Off-Limits to the Assistant

- Soren's deployer private key in `.env.local` (treat as if it were a hardware wallet — read but never echo, never copy elsewhere)
- Any mention of Alice (Soren's parallel project) in OKX-facing communication
- Soren's other social accounts beyond @synth_fun
- Promising anything to Keith / Chenyang on Soren's behalf

---

## 8. Open Questions / Decisions Pending

| Question | Status | Decision needed by |
|---|---|---|
| Will OKX official announcement be tied to win or separate? | Unknown | When announcement drops |
| Will OKX want a video demo for their announcement? | Possible | If they ask |
| Should SYNTH token deploy on X Layer too? | Soren has not decided | Phase 1 of roadmap |
| Should we apply to OKX Ventures Vision Fund? | Wait for Keith to surface | Whenever Keith mentions |
| BAP-578 — is there a v2 / next-iter standard work to contribute to? | Wait until PR #22 merges | After merge |

---

## 9. Quick Repo Navigation

```
src/app/                  Next.js App Router (pages + API routes)
  ai/                     AI Terminal page
  api/
    ai/chat/              LLM intent → OKX skill dispatcher
    okx/                  REST wrappers for 5 OKX Onchain OS skills
    tokens/               Chain-aware /api/tokens?chainId=
    stats/                Chain-aware /api/stats?chainId=
    leaderboard/          Chain-aware /api/leaderboard?chainId=
    synthid/              SynthID metadata endpoints
    tokens/register/      Token registration after launch (chain-aware)
  launch/page.tsx         Token launch UI (chain-aware, X Layer first default)
  identity/               SynthID pages
  nfa/                    NFA pages

src/components/
  StakingHome.tsx         Homepage hero (X Layer + BSC badges)
  TokensHome.tsx          /tokens page (chain switcher, default X Layer)
  StatsBar.tsx            Per-chain stats display
  WalletConnect.tsx       Wallet connect (X Layer + BSC supported)
  WalletDownload.tsx      Header SYNTH wallet APK download dropdown
  ai/                     AI Terminal subcomponents
  identity/               Identity page components

src/lib/
  okx.ts                  OKX Onchain OS HMAC client
  contracts.ts            CHAIN_CONFIG[56] + CHAIN_CONFIG[196]
  api.ts                  Token type + chainLabelOf() helper
  wagmi.ts                wagmi config with bsc + xlayer chains
  i18n/                   en.json + zh.json + LanguageToggle

scripts/
  deploy-xlayer.ts        One-shot X Layer deploy + OKLink verify

deployments/
  xlayer.json             Deployment receipts

public/
  SynthLaunch-Whitepaper.md   v1.1, X Layer primary

docs/hackathon/
  HANDOFF.md              Pre-submission handoff (now historical)
  SUBMISSION.md           Pre-submission materials pack
  POST_WIN_HANDOFF.md     ← you are here
```

## 10. Environment Variables (Vercel production)

These should all already be configured. If a feature breaks, check these first:

| Variable | Used by | Notes |
|---|---|---|
| `OKX_API_KEY` | Onchain OS skills | Required for `/ai` terminal. If LLM says "OKX unavailable", check this |
| `OKX_SECRET_KEY` | Onchain OS HMAC | Same |
| `OKX_API_PASSPHRASE` | Onchain OS HMAC | Same |
| `OKX_PROJECT_ID` | Onchain OS | Same |
| `OPENAI_API_KEY` | AI intent detection | Watch for quota burnout (happened once already) |
| `NEXT_PUBLIC_SUPABASE_URL` | All DB reads | |
| `SUPABASE_SERVICE_KEY` | Server-side writes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged writes | |
| `MORALIS_API_KEY` | Staking leaderboard | |
| `EVA_PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY` | Hardhat deploys | NOT in Vercel; only `.env.local` |

Health check endpoint that verifies most of these: https://synthlaunch.fun/api/ai/health

---

## 11. Closing

The hackathon is the launchpad, not the destination. The actual game starts now: **convert this win into a real X Layer ecosystem position over the next 90 days**. Keith and Chenyang are the gateway. The 1-pager is the bridge. Phase 1 ship is the proof.

Anyone reading this: if Soren is not reachable, the **default action is to wait**, not to act. The relationships here are senior-level and benefit from patience. The product can run on autopilot.

---

**Document version**: 1.0  
**Author**: Claude (with Soren)  
**Last updated**: 2026-04-23  
**Next review**: When OKX official announcement drops, OR when BAP-578 PR #22 merges, whichever first.
