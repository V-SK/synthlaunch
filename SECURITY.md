# Security Considerations

This document covers the threat model, authentication mechanisms, and known security boundaries for SynthLaunch — with emphasis on the **Synth SportFi Arena** prediction protocol.

For high-severity issues, contact the maintainer privately (see footer). Do not file public issues for security bugs that have not been patched.

---

## 1. Wallet-Signed Auth (EIP-191)

Every write endpoint that creates or modifies a fan-owned record requires an **EIP-191** `personal_sign` signature from the user's wallet. This is a stronger primitive than a shared secret because it cryptographically binds the request payload to the wallet that approves it.

**Three signature contexts** (canonical builders in [`src/lib/fanfiProofSignature.ts`](src/lib/fanfiProofSignature.ts)):

| Context | Builder | Verified by |
|---|---|---|
| Submit a prediction receipt | `buildFanFiReceiptMessage` | `verifyFanFiReceiptSignature` |
| Update a mission completion | `buildFanFiMissionMessage` | `verifyFanFiMissionSignature` |
| Save a prediction campaign draft | `buildFanFiCampaignMessage` | `verifyFanFiCampaignSignature` |

Each verifier follows the same template:
1. Reconstruct the canonical message server-side from `(body fields, claimed wallet, claimed timestamp)`.
2. Reject if the client-supplied `signatureMessage` does not equal the reconstructed one (prevents the client from signing one thing and submitting a different payload).
3. Reject if the timestamp is older than 30 minutes (replay window).
4. Call `viem.verifyMessage` to recover the signer and compare with the claimed wallet.

A failure at any step returns `4xx` with no state mutation.

---

## 2. Admin Auth (Settlement Endpoint)

`POST /api/admin/fanfi-settle` writes reputation points back to many receipts in one call. It is authenticated by a **deployer-wallet signature**, not a shared secret.

```
Headers:
  x-admin-signature: 0x<sig>
  x-admin-message:   <url-encoded canonical message>

Canonical message includes:
  Template: <templateId>
  Outcome: <outcome>
  Timestamp: <ms-since-epoch>
```

Verification ([`src/app/api/admin/fanfi-settle/route.ts`](src/app/api/admin/fanfi-settle/route.ts)):
1. Header signature + message must be present.
2. Message must reference the **same** `templateId` and `outcome` as the request body. (Prevents signing-one-settle, replaying-as-another.)
3. Message timestamp must be within 5 minutes.
4. `viem.verifyMessage` must recover the hard-coded deployer address.

The deployer wallet is the SynthLaunch operator (`0x0198b366978ff0ee67bf308b0367c9b6fced2725`). No shared secret is involved, so leaking server env vars does not grant settle authority.

A `dryRun: true` request body is allowed (still requires admin signature) and returns the would-be scoring without writing.

---

## 3. X Layer Transaction Proof Verification

When a user attaches an `xLayerTxHash` to a receipt, the server **independently verifies** the transaction via X Layer RPC ([`src/lib/localFanfiMarketProofStore.ts`](src/lib/localFanfiMarketProofStore.ts), `verifyXLayerTxHash`):

1. The tx format must match `0x[0-9a-fA-F]{64}`.
2. `getTransaction()` and `getTransactionReceipt()` are called against X Layer RPC (chain 196).
3. `receipt.status` must be `'success'` (no failed txs).
4. `transaction.from` must equal the submitting wallet (no one can claim someone else's tx).
5. Either the receipt hash must appear in the transaction calldata **or** the transaction must target a known SynthLaunch X Layer contract (Flap portal, Custody, SynthID, NFAv2, or token impls).

This ties the off-chain signed receipt to an on-chain action without trusting the user's claim.

---

## 4. Idempotency & Replay Protection

Three layers of replay protection:

1. **Timestamp window**: Every signed message must include a `Timestamp` line and be presented within 30 min (5 min for admin settle).
2. **Canonical message rebuild**: The server reconstructs the expected message from the request body and rejects if the client-supplied `signatureMessage` differs by even one character.
3. **Unique signature index**: `fanfi_market_proofs.wallet_signature` is a unique Supabase index. Resubmitting the same signed receipt returns the existing row instead of inserting a duplicate.

---

## 5. Settlement Engine Boundaries

The reputation scoring engine ([`src/lib/fanfiSettle.ts`](src/lib/fanfiSettle.ts)) is transparent and deterministic. There is no randomness, no time-dependent state inside the scoring function, no oracle calls — given the same inputs, every settle produces the same scores.

**Inputs** to `scoreReceipt`:
- `predictionDirection` (string, parsed from the user's signed objective at submit time)
- `predictionProbability` (0-100, parsed from the user's signed objective)
- `predictionReason` (string, parsed from the user's signed objective)
- `createdAt` (ISO timestamp)
- `outcome` (string, from the admin settle call)
- `cutoffTimestamp` (optional; for precise early-receipt bonus)

**Boundary**: The "direction matches outcome" heuristic uses case-insensitive substring + token overlap. It is conservative — false positives are bounded, but it cannot disambiguate semantically tricky cases (e.g., "draw" vs "tie"). For high-stakes arenas the admin can use `dryRun: true` to preview the scoring before committing.

**Reason quality scoring** is a v1 length heuristic (`100+ → +40`, `50+ → +25`, `10+ → +10`). LLM grading is documented as next-phase work in the UI; we do not silently grade with a black-box.

---

## 6. Onchain OS / OKX API Keys

OKX API key, secret, passphrase, and project ID are all server-side env vars:
```
OKX_API_KEY
OKX_SECRET_KEY
OKX_API_PASSPHRASE
OKX_PROJECT_ID
```

HMAC signing happens inside [`src/lib/okx.ts`](src/lib/okx.ts) on the Next.js server. Browser requests hit our Next.js routes, which then proxy to OKX with the HMAC. The OKX secret never leaves the server.

If the OKX keys are leaked, the impact is rate-limit-level (someone can query OKX skills as us); they cannot move user funds because all swap execution is signed by the user wallet, not by us.

---

## 7. Non-Custodial Execution

SynthLaunch never holds a user's private key. All on-chain writes use wallet signature:

- Prediction receipts: signed by user wallet (EIP-191).
- Token launches: handled by Flap Portal contracts via user wallet.
- Custody claims: bound to a specific wallet via ECDSA signature; only that wallet can `claim(token)`.
- OKX swap execution: aggregator returns an unsigned transaction, user signs it in their wallet, frontend broadcasts via viem.

The SynthLaunch deployer wallet performs admin operations (settle, contract owner ops), and its private key is never exposed in any frontend bundle, API response, or environment variable accessible to the browser.

---

## 8. Known Limitations & Caveats

These are documented openly in the UI and audit board, not hidden:

| Item | Status | Impact |
|---|---|---|
| Reason quality scoring is length-based (v1) | Next-phase | Long but low-quality reasons could over-score. Mitigation: documented limit, capped at +40. |
| Early-receipt bonus is binary (full +20 or 0) | Next-phase | Cannot reward "submitted 1 hour earlier than another correct receipt". |
| Arena Board on landing page is sample preview | Labeled in UI | Users see "Sample preview" badge; production board is in `XCupLivePanel`. |
| Direction matching is heuristic substring/token-overlap | v1 design | Admin can preview via `dryRun: true` before settling. |
| No rate limiting on FanFi GET endpoints | Inherited | Public read endpoints (proofs, missions, leaderboard) are open; DDoS risk is the Next.js / Vercel layer. |

---

## 9. Reporting

If you discover a vulnerability, please:

1. **Do not** open a public GitHub issue with reproduction steps.
2. **Do not** post on X / Telegram with vulnerability details.
3. Contact: [@synth_fun](https://twitter.com/synth_fun) DM or open a private security advisory on the repository.

We aim to acknowledge within 24 hours and fix critical issues within 7 days.

---

## 10. Audit History

| Date | Auditor | Scope | Findings |
|---|---|---|---|
| 2026-05-26 | Internal (Claude Opus 4.7) | SportFi branch full audit (28/31 files) | Settlement engine implementation, Supabase persistence migration, campaign POST auth, sample-data labeling — **all addressed in this branch**. Detailed report: internal. |
