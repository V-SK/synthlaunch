# SynthID Comprehensive Audit Report

**Date:** 2026-02-02  
**Scope:** Smart contract, frontend pages, API routes, components, data flow  
**Auditor:** Automated code review

---

## 🔴 CRITICAL (Must Fix Before Launch)

### C1: Landing Page, Agent Registry & Detail Page Use MOCK DATA — Not On-Chain

**Files:**
- `src/app/identity/page.tsx` — imports `MOCK_AGENTS`, `MOCK_STATS`
- `src/app/identity/agents/page.tsx` — imports `MOCK_AGENTS`, `searchAgents`
- `src/app/identity/agent/[id]/page.tsx` — imports `getAgentById` from mock

**Problem:** The entire browsing experience (landing page stats, agent list, agent detail) reads from `src/lib/identity-mock.ts` — a hardcoded array of 10+ fake agents. **No real on-chain data is ever fetched.** Users see fake agents that don't exist on-chain. Stats are fabricated.

**Impact:** Users will think the registry has agents when it doesn't. Detail pages for real minted tokens won't work (they aren't in the mock array). This is the single biggest issue — the "registry" is a lie.

**Fix:**
- Landing page: Read `totalMinted`, `activeCount`, `nextId` from contract via `useReadContract`
- Agent list: Iterate token IDs 1..nextId, call `getAgentIdentity` + `getAgentProfile` for each (or use an indexer/subgraph for scale)
- Agent detail: Call `getAgentIdentity(id)` + `getAgentProfile(id)` on-chain instead of `getAgentById()`
- Remove or deprecate `identity-mock.ts` entirely

---

### C2: Metadata IPFS Upload Returns Wrong CID Field

**File:** `src/app/api/synthid/metadata/route.ts` (line ~50)

**Problem:** The code sends a GraphQL mutation but then reads the CID from `data?.data?.create`:
```ts
const cid = data?.data?.create;
```
But the GraphQL query defines `uploadFile(...)` which returns `{ cid }`. The response would be `data.data.uploadFile.cid`, not `data.data.create`.

**Impact:** The metadata upload API **always returns `{ error: 'No CID returned' }` with status 502.** The metadata URI is never generated. Since the register flow doesn't actually call this endpoint (it sets agentURI to the `/api/synthid/[id]` route instead), this is partially masked, but the endpoint is broken.

**Fix:**
```ts
const cid = data?.data?.uploadFile?.cid;
```

---

### C3: Mint Fee Hardcoded — Doesn't Read from Contract

**File:** `src/app/identity/register/page.tsx` (line 8)

**Problem:** `MINT_FEE_BNB = 0.04` and `parseEther('0.04')` are hardcoded. If the contract owner calls `setMintFee()` to change the fee, the frontend will send the wrong amount, causing transactions to fail with "Insufficient fee" or overpaying.

**Fix:** Read `mintFee` from contract:
```ts
const { data: mintFee } = useReadContract({
  address: SYNTHID_ADDRESS,
  abi: SYNTHID_ABI,
  functionName: 'mintFee',
});
```
Use `mintFee` for both display and `value` in the `register` call.

---

### C4: Register Uses `moltbookId` Instead of Verified `agentData.name` as platformId

**File:** `src/app/identity/register/page.tsx`, `handleMint()`

**Problem:**
```ts
writeMint({
  ...
  args: [name, platform, moltbookId.trim(), avatar, description],
});
```
It passes `moltbookId.trim()` (the raw user input) as `platformId`. But the Moltbook verification may return a differently-cased or normalized name via `agentData.name`. The duplicate-check API uses `agent.name` from Moltbook, while the mint uses the raw input.

**Impact:** User types "alicebtc", Moltbook returns "AliceBTC". Check passes against "AliceBTC" but mint registers "alicebtc" — now the duplicate check won't catch future attempts against "alicebtc" since `getByPlatform` hashes are case-sensitive.

**Fix:** Use `agentData.name` (or `agentData.name || moltbookId.trim()`) as the platformId argument.

---

### C5: No Wallet Duplicate Check Before Minting

**File:** `src/app/identity/register/page.tsx`

**Problem:** The frontend checks if the **platform+platformId** is already registered (`/api/synthid/check`), but never checks if the **connected wallet** already has a SynthID. The contract enforces `walletToId[msg.sender] == 0`, so the tx will revert, but the user gets a confusing wallet error instead of a friendly message.

**Fix:** Before showing the mint button, call `hasId(address)` or `walletToId(address)` and show a clear message: "This wallet already has SynthID #X".

---

## 🟠 IMPORTANT (Should Fix Soon)

### I1: Race Condition — Mint Succeeds but setAgentURI Fails

**File:** `src/app/identity/register/page.tsx`, `handlePostMint()`

**Problem:** After mint succeeds, the code calls `refetchTokenId()` then `writeUri()`. If:
1. `refetchTokenId()` returns 0 (RPC lag, BSC block not confirmed) → silently sets `mintStep = 'done'` with no URI
2. User rejects the second tx → `mintStep` stays at `'setting-uri'` forever (no error handler for `writeUri` failure)
3. Browser closes between mint and URI set → URI never gets set

**Impact:** Agent minted but has no `agentURI`, so `tokenURI()` returns the on-chain SVG fallback. Not catastrophic but confusing.

**Fix:**
- Add error handling for `writeUri` failure (watch for `isError` from `useWriteContract`)
- Add a "Retry Set URI" button if step 2 fails
- Show the minted token ID even if URI setting fails
- Consider a recovery page where users can set URI for their existing SynthID

---

### I2: No Rate Limiting on API Routes

**Files:**
- `src/app/api/synthid/check/route.ts`
- `src/app/api/synthid/metadata/route.ts`
- `src/app/api/synthid/[id]/route.ts`

**Problem:** All API routes have zero rate limiting. The check endpoint makes RPC calls to BSC; the metadata endpoint uploads to IPFS. An attacker can:
- DDoS the BSC RPC by spamming `/api/synthid/check`
- Spam IPFS uploads via `/api/synthid/metadata`
- Exhaust Vercel function invocations

**Fix:** Add rate limiting (e.g., `@upstash/ratelimit` or Vercel Edge middleware). At minimum, add API key validation for the metadata upload endpoint.

---

### I3: Check API Swallows Errors as "Not Exists"

**File:** `src/app/api/synthid/check/route.ts`

**Problem:**
```ts
} catch {
  return NextResponse.json({ exists: false });
}
```
If the RPC call fails (network issue, contract reverts), the API reports the agent doesn't exist. This could lead to duplicate registration attempts.

**Fix:** Return an error status when the RPC call fails:
```ts
} catch (err) {
  return NextResponse.json({ error: 'Failed to check registration status' }, { status: 502 });
}
```

---

### I4: Frontend String Length Limits Don't Match Contract

**File:** `src/app/identity/register/page.tsx` vs `contracts/SynthID.sol`

| Field | Frontend Limit | Contract Limit |
|-------|---------------|----------------|
| name | 32 | 64 |
| avatar | 256 | 512 |
| description | 280 | 512 |
| skillTag | 24 | 32 |

**Problem:** Frontend limits are stricter than contract. Not a security issue (contract is the authority) but users are unnecessarily restricted.

**Fix:** Either align limits to match contract, or document why frontend limits are intentionally lower (e.g., UI display constraints). At minimum, the contract limits should be the reference.

---

### I5: Skills Are Never Sent to Contract

**File:** `src/app/identity/register/page.tsx`

**Problem:** The user enters skills in the form, they're displayed in the preview, but `register()` doesn't accept skills as a parameter. Skills must be set via a separate `setSkills(agentId, skills[])` call after minting. **This call is never made.**

**Impact:** All minted agents have empty skills arrays on-chain, despite the user entering them.

**Fix:** After mint + setAgentURI, add a third step that calls `setSkills(tokenId, skills)`. Or at minimum, document that skills can be set later and provide a UI for it.

---

### I6: No Input Sanitization on API Metadata Endpoint

**File:** `src/app/api/synthid/metadata/route.ts`

**Problem:** The `name`, `description`, and other fields from the POST body are directly embedded into the JSON metadata without sanitization. While this is JSON (not HTML), the metadata is served to wallets and marketplaces that may render it. XSS via NFT metadata is a known attack vector.

**Fix:** Sanitize or escape all string fields before embedding in metadata JSON. Strip control characters, validate URL format for `avatar`, etc.

---

### I7: Moltbook Verification Has No Ownership Proof

**File:** `src/app/identity/register/page.tsx`, `handleVerify()`

**Problem:** The verification only checks that an agent with that name exists on Moltbook and is "claimed". It does NOT verify that the **current wallet owner** actually owns/controls that Moltbook agent. Anyone can type any Moltbook agent name and mint a SynthID for it.

**Impact:** Identity theft — anyone can register a SynthID claiming to be any Moltbook agent. The "verification" provides no actual identity proof.

**Fix:** Implement a proper ownership verification:
- Option A: Have the Moltbook agent post a specific message containing the wallet address, then verify it
- Option B: Use Moltbook's OAuth or API key to prove ownership
- Option C: Add a signed message challenge that the agent's operator must complete
- At minimum: clearly label this as "self-reported" identity, not "verified"

---

### I8: Agent Detail Page Metadata Is Mocked

**File:** `src/app/identity/agent/[id]/page.tsx` (line ~35)

**Problem:**
```ts
const metadata = [
  { key: 'agent.name', value: agent.name },
  { key: 'agent.version', value: '1.0.0' },
  // ...
];
```
The "ERC-8004 On-Chain Metadata" section shows hardcoded mock values rather than actually calling `getMetadata()` on-chain.

**Fix:** Call `getMetadata(agentId, key)` for known keys, or remove the section until real metadata is available.

---

## 🟡 MINOR (Nice to Have)

### M1: No Network Check — BSC Mainnet Required

**File:** `src/app/identity/register/page.tsx`

**Problem:** No check that the user is connected to BSC Mainnet (chainId 56). If on wrong network, the mint tx will fail with a confusing wallet error.

**Fix:** Add `useChainId()` check and show "Please switch to BSC Mainnet" message.

---

### M2: BNB Price Fetch Has No Error Boundary

**File:** `src/app/identity/register/page.tsx`

**Problem:** CoinGecko API failures are silently caught, showing "..." for USD price. The `setInterval` runs every 60s forever, even if CoinGecko is down.

**Fix:** Add retry backoff logic and show "Price unavailable" instead of "...".

---

### M3: Avatar Preview Doesn't Handle Non-HTTP URLs

**File:** `src/app/identity/register/page.tsx`

**Problem:**
```ts
{avatar && avatar.startsWith('http') && (
  <img src={avatar} ... />
)}
```
IPFS URLs (`ipfs://...`) or data URIs won't show a preview.

**Fix:** Handle `ipfs://` URLs by converting to gateway URL, and allow `data:` URIs.

---

### M4: Search Only Works on Mock Data

**File:** `src/components/identity/SearchBar.tsx`

**Problem:** The search bar on the landing page navigates to `/identity/agents?q=...` which searches mock data. No on-chain search capability exists.

**Fix:** Once agents are loaded from chain (see C1), search should work against real data. For scale, consider a backend indexer.

---

### M5: `[id]` Route Has Async Params Warning (Next.js 15+)

**File:** `src/app/api/synthid/[id]/route.ts`

**Problem:** In Next.js 15+, route params are async. The code uses `{ params }: { params: { id: string } }` which may cause warnings or errors in newer Next.js versions.

**Fix:** Use `{ params }: { params: Promise<{ id: string }> }` and `await params`.

---

### M6: Contract `_sanitizeSvg` Doesn't Handle Unicode or Multi-byte Characters

**File:** `contracts/SynthID.sol`, `_sanitizeSvg()`

**Problem:** The function iterates bytes, not characters. Multi-byte UTF-8 characters could be split, potentially producing invalid UTF-8 in the SVG output. Since agent names could contain non-ASCII characters, this is relevant.

**Impact:** Broken SVG rendering for agents with unicode names. Not a security issue since the dangerous chars (<, >, &, ", ') are all single-byte ASCII.

---

### M7: No Loading State for Agent Detail Page

**File:** `src/app/identity/agent/[id]/page.tsx`

**Problem:** The page either shows mock data immediately or "not found". When switched to on-chain data, there will be a loading state that needs handling.

---

### M8: Pagination Renders All Page Numbers

**File:** `src/app/identity/agents/page.tsx`

**Problem:** `Array.from({ length: totalPages })` renders a button for every page. With many agents, this creates a huge pagination bar.

**Fix:** Show first/last + window around current page with ellipsis.

---

## 💡 SUGGESTIONS (Improvements)

### S1: Add Event Indexing / Subgraph

Reading all agents by iterating 1..nextId with individual contract calls is O(n) RPC calls. For production, deploy a subgraph or use an event indexer (e.g., Envio, Goldsky, or The Graph) to index `AgentRegistered` events.

### S2: Add Profile Edit Page

The contract has `updateProfile()`, `setSkills()`, and `setMetadata()` functions, but there's no frontend UI to use them after initial mint. Users should be able to edit their profile.

### S3: Consider Caching the `/api/synthid/[id]` Response

The route has `Cache-Control: public, max-age=300` but a CDN/edge cache or database cache would reduce BSC RPC calls significantly.

### S4: Add OpenGraph Meta Tags to Agent Pages

Agent detail pages should have dynamic OG tags (name, avatar, description) for social sharing. Currently the pages are client-rendered with no SSR metadata.

### S5: Add Contract Address Display

Show the SynthID contract address on the landing page with a link to BscScan for transparency.

### S6: Wallet Integration for "Already Registered" State

When a connected wallet already has a SynthID, the register page should redirect to their agent profile or show an "Edit Profile" flow instead of the mint form.

### S7: Consider Batch Reading for Agent List

Use `multicall` to batch `getAgentIdentity` + `getAgentProfile` calls instead of making 2N individual RPC calls for N agents.

### S8: Add Error Boundaries

Wrap pages in React Error Boundaries to gracefully handle RPC failures, contract reverts, or rendering errors instead of white-screening.

---

## 📊 Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| 🔴 Critical | 5 | Mock data everywhere, broken IPFS upload, hardcoded fee, no real verification |
| 🟠 Important | 8 | Race conditions, no rate limiting, missing ownership proof, skills not persisted |
| 🟡 Minor | 8 | Wrong network handling, unicode, loading states |
| 💡 Suggestions | 8 | Indexing, profile editing, caching, OG tags |

**Priority order for fixes:**
1. **C1** — Replace mock data with on-chain reads (this makes the product real)
2. **C4 + I7** — Fix identity verification (without this, anyone can claim any identity)
3. **C3 + C5** — Read mint fee from contract + check wallet duplicate
4. **I1 + I5** — Handle post-mint failures + persist skills
5. **C2** — Fix metadata upload CID parsing
6. **I2 + I3** — Rate limiting + proper error handling
