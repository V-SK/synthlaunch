# Synth FanFi Arena X Cup - Local Audit Brief

This document is for local review only. Do not publish, deploy, submit, or post
any material from this package before internal approval.

Chinese boss-facing brief:
`docs/FANFI_XCUP_BOSS_BRIEF_CN.md`

## Local Review Route

- Arena: `http://127.0.0.1:3000/fanfi/xcup`
- Audit board: `http://127.0.0.1:3000/fanfi/xcup/audit`
- X Layer chain: `196`
- Native token: `OKB`

## Demo Flow

1. Open `FanFi Arena`.
2. Pick an X Cup campaign preset.
3. Click `Generate Copilot Pack`.
4. Review persona, mission, private launch draft, tweet thread, and OKX flow.
5. Save the campaign locally.
6. Click `Run Audit Demo`.
7. Open the created local demo token.
8. Confirm the token detail page shows FanFi proof: campaign, local points,
   missions, rank, token address, and local tx hash.
9. Review `OKX Trading Proof` on the Arena page.
10. Open the Audit board and confirm readiness status.

## What Is Local

- Campaign records.
- Copilot-generated launch package.
- Demo token and local tx hash.
- Mission completions and FanFi points.
- Token detail FanFi proof.
- OKX token search, balance, and quote proof surfaces.

## What Still Needs Approval

- Real X Layer token launch.
- OKLink proof.
- OKX credential-backed live quote test.
- Supabase production persistence.
- Public deployment.
- X/Twitter posts and X Cup submission package.

## Demo Script

Synth FanFi Arena turns World Cup fan communities into AI-assisted FanFi
campaigns on X Layer. A reviewer can generate a fan agent package, save the
campaign, create a local demo token, complete FanFi missions, inspect the token
detail proof, and verify the OKX trading review path. The current build is
intentionally local-only until internal audit approves public release.
