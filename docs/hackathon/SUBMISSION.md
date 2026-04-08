# SynthLaunch — OKX Build X Hackathon Submission Pack

> This file contains ready-to-paste content for every submission artifact:
> demo video script, X tweet, Google Form answers, and a final checklist.
> Contact: Soren Lin ([@synth_fun](https://twitter.com/synth_fun)).

---

## 1. Final Submission Checklist

Things you, Soren, need to do personally before the **2026-04-15 23:59 UTC** deadline.

### A. Required actions (in order)

- [ ] **Apply supabase migration**: open Supabase dashboard → SQL editor →
      paste the contents of `supabase/migrations/008_chain_id_support.sql`
      → Run. Takes ~5 seconds. This unblocks chain-aware /api/tokens.
- [ ] **Make the GitHub repo public**: `Settings → General → Danger Zone →
      Change visibility → Make public`. The README and code are already
      prepared for this.
- [ ] **Verify the live site works end-to-end on X Layer** (use section 5 below).
- [ ] **Record the demo video** (script in section 2 below).
- [ ] **Upload the video** to YouTube Unlisted or Google Drive public link.
      Paste the URL here: `____________________________________`
- [ ] **Post the X tweet** (template in section 3 below). Paste the URL here:
      `____________________________________`
- [ ] **Submit the Google Form**: fill using the answers in section 4 below.
      Link: https://web3.okx.com/zh-hans/xlayer/build-x-hackathon
      (scroll to "Submit" on that page for the official form).
- [ ] **Keep the Vercel deployment healthy** until the judges finish evaluating
      (at least a week after the deadline).

### B. Nice-to-have (bonus points)

- [ ] Pin the demo tweet to [@synth_fun](https://twitter.com/synth_fun).
- [ ] Add `#XLayerHackathon` `#onchainos` to the tweet.
- [ ] Tag `@XLayerOfficial` in the tweet.
- [ ] Screenshot of the `/ai` terminal running a swap on X Layer and attach
      to the tweet + Google Form.
- [ ] If possible, mint a SynthID on X Layer so the "5 min judge eval" actually
      lights up a tile in the UI for the judges.

---

## 2. Demo Video Script (1:30 – 2:00)

**Goal**: show the judges (1) the product, (2) X Layer, (3) Onchain OS skills
being used, (4) the Agentic Wallet story. Keep it tight and visual.

**Setup**:
- Open https://synthlaunch.fun in a clean browser window
- Have OKX Wallet or MetaMask extension ready, already on X Layer (196)
- Have a little OKB in the wallet for a live swap demo
- Optional: close devtools, silence notifications, 1920x1080 window

### Shot list

| Time | Shot | On-screen | Voice-over (English) |
|---|---|---|---|
| 0:00 – 0:10 | Title card or landing page | "SynthLaunch — Agent-native token launch on X Layer" | "This is SynthLaunch. We give AI agents an onchain operating layer — identity, treasury, and execution — built around OKX Onchain OS on X Layer." |
| 0:10 – 0:25 | Connect wallet, chain selector → X Layer | wallet popup, chain switches to X Layer | "Connect. Switch to X Layer. The whole app is chain-aware: every contract call goes to the chain you pick." |
| 0:25 – 0:45 | Navigate to `/ai` | AI terminal opens, sidebar visible | "This is the AI terminal. It is the heart of the Agentic Wallet. Under the hood it is wired to five Onchain OS skills: token search, balances, total value, quote, and swap." |
| 0:45 – 1:00 | Type "what's in my wallet" | Balances card renders | "One prompt. Intent detection calls okxBalances, which hits the Onchain OS balance-by-address endpoint on X Layer." |
| 1:00 – 1:20 | Type "swap 0.01 OKB for USDC" | Swap card renders with quote, user signs in wallet, tx broadcasts | "Another prompt. The terminal calls okxQuote and okxSwap on the OKX aggregator. I sign in my own wallet — SynthLaunch never holds the key — and the tx lands on X Layer." |
| 1:20 – 1:40 | Show OKLink receipt + contracts page | Custody, SynthID, NFAv2 addresses on OKLink | "All three of our core contracts — Custody, SynthID, and NFAv2 — are deployed and verified on OKLink. An agent has a soulbound identity in SynthID, a treasury in Custody, and a body in NFAv2. Together they form an Agentic Wallet." |
| 1:40 – 1:55 | Back to the repo README | README top section | "Everything is open source. The README walks through the Agentic Wallet composition, the five Onchain OS skills, the deploy scripts, and a 5-minute judge evaluation path." |
| 1:55 – 2:00 | End card | "synthlaunch.fun / @synth_fun / github.com/V-SK/synthlaunch" | "SynthLaunch. Built for OKX Build X. Thanks." |

**Recording tool**: QuickTime Player → File → New Screen Recording → select
window → record. Use the built-in mic, or plug in a headset for clearer voice.

---

## 3. X Tweet Template

Post from [@synth_fun](https://twitter.com/synth_fun). Attach the demo video
(or a screenshot of the AI terminal running a swap on X Layer) + one
architecture diagram.

```text
🧬 SynthLaunch is live on @XLayerOfficial.

Agent-native token launch + Onchain OS-native AI terminal.
AI agents now launch tokens, earn trading fees, and execute swaps — all onchain.

✅ 5 @OKX_Onchain_OS skills wired end-to-end
✅ Agentic Wallet = SynthID + NFAv2 + Custody
✅ Multi-chain (X Layer + BSC)
✅ Verified on OKLink

Demo 👇
[video link]

Code 👉 github.com/V-SK/synthlaunch

#XLayerHackathon #onchainos
```

Character count is tight; if you hit the limit, cut the "Multi-chain" and
"Verified on OKLink" lines first.

---

## 4. Google Form Answers (ready to paste)

The OKX Build X Hackathon submission form is linked from
https://web3.okx.com/zh-hans/xlayer/build-x-hackathon. The exact field names
may vary slightly; below is the content to paste.

### Project Name
```
SynthLaunch
```

### One-line positioning
```
Agent-native token launch and monetization protocol on X Layer and BSC.
```

### Team / Team member(s)
```
Soren Lin (solo builder) — GitHub @V-SK — X @synth_fun
```

### Track / Arena
```
X Layer Arena
```

### Project Introduction (short)
```
SynthLaunch gives AI agents a complete onchain operating layer. An agent
gets a soulbound identity (SynthID, ERC-8004 compatible), a dedicated
treasury with signature-bound fee routing (SynthLaunchCustody), an
evolvable NFT body with a whitelisted logic contract (NFAv2, BAP-578
style), and a chat terminal at /ai that is backed end-to-end by OKX
Onchain OS skills. An AI agent can launch a token, earn trading fees,
check its wallet, find tokens, and execute swaps — all onchain, all from
the same interface, all on X Layer.
```

### Architecture Overview
```
Frontend: Next.js 14 + TypeScript + Tailwind, wagmi v2 + viem for Web3.
Backend: Next.js API routes, Supabase (Postgres) for indexing and AI
sessions, server-side OKX Onchain OS client with HMAC-signed requests.
Contracts: Solidity 0.8.20 compiled with Hardhat. SynthLaunchCustody
handles per-agent fee accounting with signature-bound claims. SynthID is
a soulbound ERC-721 for agent identity. NFAv2 is a non-fungible agent
body with a logic allowlist. All three are deployed and verified on
X Layer (and on BSC as a secondary chain).

Agentic Wallet composition:
  SynthID (identity) + NFAv2 (body) + SynthLaunchCustody (treasury) +
  /ai terminal (execution surface via OKX Onchain OS).

The user wallet acts as the controller; the Agentic Wallet is the
on-protocol composition of identity, body, and treasury bound to that
wallet by signature.
```

### Deployment Addresses (X Layer primary)
```
X Layer (chain 196):
  SynthLaunchCustody 0xb381e840AAB505132506781eAFD3c38398B58462
  SynthID            0xE7369f4bA311f59C7476e4A0279d42F767cddd20
  NFAv2              0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E
  Flap Portal (ecosystem) 0xb30D8c4216E1f21F27444D2FfAee3ad577808678

All three SynthLaunch contracts are verified on OKLink:
  https://www.oklink.com/x-layer/address/0xb381e840AAB505132506781eAFD3c38398B58462
  https://www.oklink.com/x-layer/address/0xE7369f4bA311f59C7476e4A0279d42F767cddd20
  https://www.oklink.com/x-layer/address/0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E

BSC (chain 56):
  SynthLaunchCustody v11 0x3Fa33A0fb85f11A901e3616E10876d10018f43B7
  SynthTimelock          0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D
  SynthID                0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb
  NFAv2                  0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19
```

### OKX Onchain OS / Uniswap Skill Usage
```
SynthLaunch uses FIVE OKX Onchain OS skills end-to-end, wired from a
user-facing AI chat terminal to signed on-chain execution:

1. Token Search — OKX DEX /api/v6/dex/market/token/search
2. Balances     — OKX DEX /api/v6/dex/balance/all-token-balances-by-address
3. Total Value  — OKX DEX /api/v6/dex/balance/total-value-by-address
4. Quote        — OKX DEX /api/v6/dex/aggregator/quote
5. Swap Aggregator — OKX DEX /api/v6/dex/aggregator/swap

Implementation: src/lib/okx.ts (signed HMAC client).
Dispatch layer: src/app/api/ai/chat/route.ts (LLM intent detection →
OKX skill → tool result → rendered in the UI).
REST wrappers: src/app/api/okx/{token-search,balances,quote,swap}/route.ts.
User surface: src/app/ai/page.tsx + src/components/ai/AiTerminalPage.tsx
and the four sub-components AiChatPane / AiSidebar / AiStatusBar /
AiToolCard.

Swap execution is non-custodial: the aggregator returns an unsigned
transaction, the user signs it in their wallet, and the frontend
broadcasts via viem. SynthLaunch never touches the private key.
```

### Working Mechanics
```
1. User connects an EVM wallet and selects X Layer in the chain selector.
2. User mints a SynthID (soulbound identity) for their agent.
3. User launches an agent token via the Flap Portal on X Layer, routing
   the trading tax to SynthLaunchCustody with the agent name as the
   accounting key.
4. User binds a claim wallet to the agent by calling
   SynthLaunchCustody.bindWallet(agentName, wallet, nonce, signature).
   This pins the Agentic Wallet identity to a specific address.
5. User optionally mints an NFAv2 body for the agent and attaches a
   whitelisted logic contract (AgentLogic / AgentLogicPro).
6. User opens the AI terminal at /ai and interacts with their agent.
   The terminal uses OKX Onchain OS skills for every onchain read/write
   action it needs to take.
7. Trading fees accumulate in Custody. The bound wallet can call
   claim(token) to withdraw the agent's share; the platform keeps the
   configured platform fee.
```

### Agentic Wallet Explanation
```
SynthLaunch treats an "Agentic Wallet" as a composition, not a single
contract. It has four parts:

- SynthID (soulbound ERC-721) — identity. Cannot be transferred away
  from the owner wallet, ensuring durable agent identity.
- NFAv2 (ERC-721 with logic allowlist) — agent body. Balance, XP, and
  the logic contract define what the agent can do onchain.
- SynthLaunchCustody — treasury. A signer-bound claim mechanism ties
  a specific wallet to an agent name via ECDSA signature. Only the
  bound wallet can claim fees.
- /ai terminal (backed by OKX Onchain OS) — execution surface. The
  agent's interactions with the wallet, tokens, and swaps go through
  Onchain OS skills.

Multiple agents per user are supported. Each agent has exactly one
SynthID and at most one NFAv2 body; the owner wallet can manage many.
The README section "Agentic Wallet — how it works" contains an ASCII
diagram that shows the composition.
```

### Project Positioning in the X Layer Ecosystem
```
X Layer is the best home for SynthLaunch because agent-native economies
need high-frequency, low-cost on-chain interactions in the same
environment where Onchain OS lives. SynthLaunch is the first project we
are aware of that wires the Onchain OS skill set directly into an AI
agent's chat surface, turning every prompt into a potential on-chain
read or write. We see SynthLaunch as the agent entry point to the X
Layer ecosystem: an agent that is born with identity, a treasury, and a
fully functional Onchain OS-powered wallet out of the box.
```

### Source Code
```
https://github.com/V-SK/synthlaunch
```

### Live Demo
```
https://synthlaunch.fun
```

### Demo Video
```
[paste YouTube / Google Drive link]
```

### X Post Link
```
[paste tweet link]
```

---

## 5. Live Site Verification Walkthrough (do this before submitting)

Run this exact sequence on https://synthlaunch.fun to make sure nothing is
broken. If anything fails, stop and flag it — do not submit yet.

1. Open site in a clean browser. Expect: homepage renders.
2. Click the chain selector → switch to **X Layer**. Expect: native symbol
   flips to OKB, no red error banner.
3. Connect wallet (OKX Wallet or MetaMask). Expect: wallet popup, address
   shown in header, OKB balance next to address.
4. Navigate to `/ai`. Expect: terminal loads, sidebar visible, no 500.
5. Type `what's in my wallet`. Expect: balances card renders with at least
   one row.
6. Type `price of USDC`. Expect: price card renders with a USD number.
7. Type `swap 0.01 OKB to USDC`. Expect: quote card renders. If you want to
   do a live swap, click "Execute" and sign in your wallet — this costs real
   OKB, so maybe save for the demo recording.
8. Navigate to `/tokens`. Expect: either a list (once someone launches an
   X Layer token) or an empty state — NOT a 500.
9. Navigate to `/launch` → select X Layer in the chain picker. Expect: the
   form adapts (fee rate, beneficiary prefilled with our custody).
10. Open DevTools → Network tab → refresh `/tokens`. Expect: the request is
    `/api/tokens?chainId=196` (or similar) and returns 200.

If all 10 steps pass, you are clear to submit.

---

## 6. Judging Criteria Coverage

The official scoring is 25% × 4 categories. Here is how SynthLaunch stacks up.

| Category | Weight | Our coverage |
|---|---|---|
| **Onchain OS / Uniswap integration & innovation** | 25% | ✅ Five Onchain OS skills wired end-to-end through an AI chat terminal. See README section "OKX Onchain OS Integration" and `src/lib/okx.ts`. |
| **X Layer ecosystem integration** | 25% | ✅ Primary submission chain. SynthLaunchCustody + SynthID + NFAv2 all deployed + verified on X Layer (OKLink). `CHAIN_CONFIG[196]` is first-class in code. Scanner and fee collection have X Layer variants. |
| **AI interactive experience** | 25% | ✅ The `/ai` terminal is the main surface. LLM intent detection in `/api/ai/chat` dispatches to OKX skills and renders structured tool cards. The four `Ai*` components cleanly split chat, sidebar, status, and tool results. |
| **Product completeness** | 25% | ✅ Frontend + contracts + API + indexer in one repo. Multi-chain config. README covers judge quick-eval, architecture, Agentic Wallet story, deploy addresses, and "what we built during the hackathon". Repo is cleaned up (no stray TASK-*.md files at root). |

All four boxes check. The weakest link is "product completeness" polish —
the /tokens and /leaderboard pages on X Layer will look sparse until users
actually launch tokens on the new chain. If Soren has time, launching one
test token on X Layer before the deadline lights up the UI for judges.
