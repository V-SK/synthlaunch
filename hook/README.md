# SynthAgent Hook

A Uniswap v4 Hook for X Layer that turns AI agent pools into protected, reputation-building markets.

This is the isolated Foundry workspace for the OKX Build X Hook submission. It is intentionally separate from the existing SynthLaunch Hardhat contracts so the v4 Hook can use the current Uniswap v4 toolchain without changing the production app build.

## Core Mechanic

- `beforeSwap`: applies a dynamic launch fee override while an agent pool is in its protected launch window.
- `afterSwap`: records pool-native agent reputation: volume, swap count, unique traders, and XP.
- `registerAgentPool`: binds a Uniswap v4 `PoolId` to an AI agent identity, creator, and treasury.

## X Layer Target

| Item | Value |
|---|---|
| Network | X Layer mainnet |
| Chain ID | `196` |
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| Required pool fee | `LPFeeLibrary.DYNAMIC_FEE_FLAG` |
| Hook flags | `beforeSwap + afterSwap` |

## Live X Layer Demo

Deployment evidence is recorded in [`deployments/xlayer-agent-demo.json`](deployments/xlayer-agent-demo.json).
The judge-facing static submission console lives at [`demo/index.html`](demo/index.html), and the Vercel-served mirror lives at `public/build-x-hook` for the production route `https://synthlaunch.fun/build-x-hook`.
It uses the SynthLaunch logo, links back to the Vercel production site at `https://synthlaunch.fun`, and supports English / Chinese copy switching for judges and AI scoring.
The bilingual submission packet is [`SUBMISSION.md`](SUBMISSION.md), and tweet copy is in [`TWEET_DRAFTS.md`](TWEET_DRAFTS.md).

| Item | Value |
|---|---|
| Chain ID | `196` |
| Deployed block | `61091448` |
| SynthAgentHook | `0x76B2e0e9000448161E4e1Ebc04c85840035C00C0` |
| Pool ID | `0x208f16e69188418f5d0d53cd196bc0ceaa9dcc246e391483fdf92cb311fa7850` |
| Demo tokens | `aUSD` / `SAGENT` |
| Hook permission bits | `0x00c0` |
| Proof swaps | `2` |
| Current XP after proof swaps | `20` |

The live demo deploys two demo ERC20 tokens, initializes a dynamic-fee Uniswap v4 pool on X Layer, registers the pool as a SynthAgent pool, adds liquidity, and executes two swaps. The two swaps trigger `beforeSwap` launch protection and `afterSwap` agent reputation accounting.

The demo routers are Uniswap v4-core test routers used only to produce end-to-end hackathon proof on X Layer. A production deployment should route through the production periphery path.

## Local Commands

```sh
forge install --no-git --shallow foundry-rs/forge-std Uniswap/v4-core Uniswap/v4-periphery OpenZeppelin/openzeppelin-contracts
forge test
forge build
```

Current local verification:

- 9 unit tests cover registration, dynamic fee override, launch-window fee decay, XP accounting, duplicate registration, static-fee rejection, and `onlyPoolManager` access control.
- 1 integration test deploys a real local Uniswap v4 `PoolManager`, initializes a dynamic-fee pool with the mined hook address, adds liquidity, executes a swap through the v4 swap test router, and verifies agent reputation updates through `afterSwap`.

## Deployment Skeleton

```sh
PRIVATE_KEY=0x... forge script script/DeploySynthAgentHook.s.sol:DeploySynthAgentHook \
  --rpc-url https://xlayerrpc.okx.com --broadcast

SYNTH_AGENT_HOOK=0x... TOKEN0=0x... TOKEN1=0x... PRIVATE_KEY=0x... \
forge script script/RegisterAgentPool.s.sol:RegisterAgentPool \
  --rpc-url https://xlayerrpc.okx.com --broadcast
```

One-shot demo path for the hackathon proof:

```sh
PRIVATE_KEY=0x... forge script script/DeployXLayerAgentDemo.s.sol:DeployXLayerAgentDemo \
  --rpc-url https://xlayerrpc.okx.com --broadcast
```
