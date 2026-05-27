# SynthAgent Hook Submission

## English

### One-line pitch

SynthAgent Hook turns an AI agent launch pool into an agent-aware Uniswap v4 market on X Layer: the Hook applies launch protection in `beforeSwap` and records pool-native reputation in `afterSwap`.

### Why this wins

- It satisfies the core Hook requirement with a deployed Uniswap v4 Hook and initialized v4 pool on X Layer mainnet.
- It is AI-scoreable: every important proof point is machine-readable in the deployment JSON, transaction list, and emitted events.
- It has a distinct narrative: AI agents are not just front-end profiles; they become on-chain economic actors with pool-native reputation.
- It is simple to verify: one Hook address, one Pool ID, one block, two proof swaps, and a clear XP state delta.

### Live proof

| Item | Value |
|---|---|
| Network | X Layer mainnet |
| Chain ID | `196` |
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| SynthAgentHook | `0x76B2e0e9000448161E4e1Ebc04c85840035C00C0` |
| Pool ID | `0x208f16e69188418f5d0d53cd196bc0ceaa9dcc246e391483fdf92cb311fa7850` |
| Demo tokens | `aUSD` / `SAGENT` |
| Hook permission bits | `0x00c0` (`beforeSwap`, `afterSwap`) |
| Proof block | `61091448` |
| Post-proof state | `xp=20`, `swapCount=2`, `uniqueTraders=1` |
| Production site | `https://synthlaunch.fun` |
| Submission console | `https://synthlaunch.fun/build-x-hook` |
| Source console | `hook/demo/index.html` |
| Deployment artifact | `hook/deployments/xlayer-agent-demo.json` |

### Key transactions

- Hook deploy: `0x285df945306635073f1148677790e38838cb2182ae2807d4114a039268c85955`
- Pool initialize: `0xada127c6ff471a7db103b42e58c4c6c3ccaaf0b3208513c76b919391d4ea640b`
- Register agent pool: `0xdeed44fba72f59f060486b9e50f4bc2354af1c19fa13c045a4d86f07f8118438`
- Add liquidity: `0x4db035f734664c7aa823217927575f5d427f72f66aad388347a522427508859c`
- Proof swap 1: `0x4be74609c3d1041766cbab04123016faa5d027001157420bdf16e16f4ed4ad22`
- Proof swap 2: `0x979a7c50731bcfcafd240dbbbc011f90a4006c0569a44a6baf5ff291796ed5de`

### Judge verification commands

```sh
cast call 0x76B2e0e9000448161E4e1Ebc04c85840035C00C0 \
  'currentFee(bytes32)(uint24,bool)' \
  0x208f16e69188418f5d0d53cd196bc0ceaa9dcc246e391483fdf92cb311fa7850 \
  --rpc-url https://xlayerrpc.okx.com

cast call 0x76B2e0e9000448161E4e1Ebc04c85840035C00C0 \
  'agentPools(bytes32)(bytes32,address,address,uint64,uint24,uint24,uint256,uint256,uint256,uint256,bool)' \
  0x208f16e69188418f5d0d53cd196bc0ceaa9dcc246e391483fdf92cb311fa7850 \
  --rpc-url https://xlayerrpc.okx.com
```

Expected state: current fee `30000`, launch active `true`, `volumeMetric=15000000000000000`, `swapCount=2`, `uniqueTraders=1`, `xp=20`, initialized `true`.

## 中文

### 一句话介绍

SynthAgent Hook 把 AI Agent 发射池变成 X Layer 上的 Agent-aware Uniswap v4 市场：`beforeSwap` 负责发射保护，`afterSwap` 负责把交易行为写入池原生声誉。

### 为什么有竞争力

- 满足 Hook 赛题核心要求：已在 X Layer 主网部署 Uniswap v4 Hook，并初始化 v4 pool。
- 适合 AI 打分：地址、Pool ID、区块、交易、事件和状态变化都集中在可读 artifact 中。
- 叙事清晰：AI Agent 不只是前端资料页，而是拥有链上经济行为和池原生声誉的主体。
- 容易复核：一个 Hook 地址、一个 Pool ID、一个区块、两笔 proof swap、一个明确的 XP 状态变化。

### 链上证明

| 项目 | 值 |
|---|---|
| 网络 | X Layer mainnet |
| Chain ID | `196` |
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| SynthAgentHook | `0x76B2e0e9000448161E4e1Ebc04c85840035C00C0` |
| Pool ID | `0x208f16e69188418f5d0d53cd196bc0ceaa9dcc246e391483fdf92cb311fa7850` |
| Demo tokens | `aUSD` / `SAGENT` |
| Hook permission bits | `0x00c0` (`beforeSwap`, `afterSwap`) |
| 证明区块 | `61091448` |
| 证明后状态 | `xp=20`, `swapCount=2`, `uniqueTraders=1` |
| 生产站点 | `https://synthlaunch.fun` |
| 参赛控制台 | `https://synthlaunch.fun/build-x-hook` |
| 本地源码控制台 | `hook/demo/index.html` |
| 部署 artifact | `hook/deployments/xlayer-agent-demo.json` |

### 表单可填简介

SynthAgent Hook is an agent-aware Uniswap v4 Hook on X Layer. It protects AI agent pool launches with a dynamic fee override in `beforeSwap`, then records pool-native reputation in `afterSwap`: volume metric, swap count, unique traders, and XP. The demo is deployed on X Layer mainnet with a live v4 pool, two proof swaps, and machine-readable evidence for AI judging.

SynthAgent Hook 是 X Layer 上的 AI Agent 感知型 Uniswap v4 Hook。它通过 `beforeSwap` 在发射期覆盖动态费率保护池子，再通过 `afterSwap` 记录池原生声誉：交易量指标、swap 次数、独立交易者和 XP。当前 demo 已部署到 X Layer 主网，包含真实 v4 pool、两笔 proof swap，以及适合 AI 评分读取的部署证据。
