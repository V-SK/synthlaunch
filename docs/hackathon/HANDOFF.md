# SynthLaunch 参赛提交交接手册

> **目标读者**：Soren（@synth_fun）的助手
> **目标成果**：在 **2026-04-15 23:59 UTC**（北京时间 4 月 16 日 07:59）之前，完成 OKX Build X Hackathon 全部参赛物料并正式提交 Google Form
> **当前进度**：代码、合约、README、提交物料草稿全部已完成并推送到 public GitHub 仓库。剩下的全是"按流程操作"的动作
> **本文档版本**：2026-04-08

---

## 目录

1. [背景和当前状态](#1-背景和当前状态)
2. [助手需要从 Soren 拿到的东西](#2-助手需要从-soren-拿到的东西)
3. [需要的账号访问权限](#3-需要的账号访问权限)
4. [Phase A：生产环境 E2E 验证](#phase-a生产环境-e2e-验证预计-30-分钟)
5. [Phase B：录制 Demo 视频](#phase-b录制-demo-视频预计-90-分钟)
6. [Phase C：发布 X 推文](#phase-c发布-x-推文预计-15-分钟)
7. [Phase D：提交 Google Form](#phase-d提交-google-form预计-30-分钟)
8. [Phase E：提交后监控](#phase-e提交后监控每天-5-分钟)
9. [故障排查](#9-故障排查)
10. [交接完成标准](#10-交接完成标准)
11. [紧急联系](#11-紧急联系)

---

## 1. 背景和当前状态

### 项目是什么

**SynthLaunch**：面向 AI agent 的链上代币发射 + 变现协议，主要部署在 **X Layer**（OKX 的 EVM Layer 2，chainId 196），次要部署在 BSC（chainId 56）。

- 官网：https://synthlaunch.fun
- 源代码：https://github.com/V-SK/synthlaunch （**已公开**）
- 团队 Twitter：[@synth_fun](https://twitter.com/synth_fun)
- 参赛赛道：**OKX Build X Hackathon — X Layer Arena**

### 已经完成的事

- ✅ 三个核心合约已部署并在 OKLink 上 verified：
  | 合约 | X Layer 地址 |
  |---|---|
  | SynthLaunchCustody | `0xb381e840AAB505132506781eAFD3c38398B58462` |
  | SynthID | `0xE7369f4bA311f59C7476e4A0279d42F767cddd20` |
  | NFAv2 | `0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E` |
- ✅ README 全部重写，包含 Hackathon 评委需要的所有章节
- ✅ 代码推到 GitHub，仓库 public
- ✅ Git 历史清理干净，没有泄露的密钥
- ✅ Supabase 数据库 migration 已应用（`tokens` 表有 `chain_id` 列）
- ✅ 提交物料草稿已写好，在仓库 `docs/hackathon/SUBMISSION.md`

### 还没完成的事（你要做的）

- ⏳ 在生产环境（synthlaunch.fun）验证所有功能在 X Layer 上正常工作
- ⏳ 录制 1-3 分钟 Demo 视频并上传
- ⏳ 用 [@synth_fun](https://twitter.com/synth_fun) 账号发推文
- ⏳ 填写并提交官方 Google Form
- ⏳ 提交后监控官方邮件确认

### 硬截止日期

**2026-04-15 23:59 UTC** ＝ 北京时间 **4 月 16 日 07:59**

**本文档写于 2026-04-08**，所以你有 **7 天**，不紧张但也别拖到最后一天——最后一天 Google Form 有可能崩或者网络不稳定。

**推荐提交时间**：2026-04-13（周一）完成，留 2 天缓冲。

---

## 2. 助手需要从 Soren 拿到的东西

开始工作前，确认 Soren 给你以下信息/授权：

| # | 需要的东西 | 用于什么 | 怎么拿 |
|---|---|---|---|
| 1 | **OKX 钱包或 MetaMask 浏览器扩展的访问** | 录制 demo 视频时需要连接钱包 | Soren 在自己电脑上用他的钱包做，或者帮你装一个测试钱包 |
| 2 | **0.02 OKB 以上的 X Layer 测试资金** | 录 demo 时做一次真实 swap（~0.01 OKB）+ gas | 从 OKX 交易所直接提到钱包地址，X Layer 免手续费 |
| 3 | **@synth_fun Twitter 账号** | 发推文 | Soren 登录让你用，或者他自己发你提供的文案 |
| 4 | **Vercel dashboard 访问**（可选） | 查看部署状态、环境变量是否配齐 | https://vercel.com/dashboard → synthlaunch 项目 |
| 5 | **Supabase dashboard 访问**（可选） | 紧急时查数据 | https://supabase.com/dashboard |
| 6 | **录屏工具** | 录 demo 视频 | macOS 自带 QuickTime，或 OBS（免费） |
| 7 | **Google 账号** | 登录 Google Form 提交 + 上传 demo 视频到 Google Drive | 用 Soren 的或你自己的都行，保存好填写记录截图 |

**你不需要**：Soren 的部署私钥、Supabase service key、OKX API key、GitHub 权限。所有代码相关的事都已经完成了。

---

## 3. 需要的账号访问权限

### 必需

- **Soren 的 Twitter（@synth_fun）**：发推文用。可以让 Soren 自己登录后发，你只提供文案和图片素材。
- **一个 Google 账号**：上传视频到 YouTube Unlisted 或 Google Drive，并用来提交 Google Form。

### 可选但有帮助

- **Soren 的 Vercel dashboard**：查看最新部署状态，确认 `main` 分支的最新 commit（应该是 `a66acb0` 或更新的）已经上线
- **Soren 的 Supabase dashboard**：如果 `/tokens` 或 `/leaderboard` 页面出问题，可以查数据库

---

## Phase A：生产环境 E2E 验证（预计 30 分钟）

**目标**：确认 https://synthlaunch.fun 在 X Layer 上所有关键功能能正常工作。如果发现问题，需要立即通知 Soren 修复（或他会找工程师修），否则提交后被评委发现功能坏掉就会扣分严重。

### 开始前

- 打开一个干净的浏览器窗口（Chrome/Edge/Safari 都行，**不要用隐身模式**——会屏蔽钱包扩展）
- 确认你装好了 OKX Wallet 或 MetaMask 浏览器扩展
- 确认钱包里至少有 **0.005 OKB**（足够 gas 和一次小额 swap）
- 打开 https://vercel.com/dashboard 看一眼 synthlaunch 项目，最新 deployment 状态应该是绿色的 `Ready`，而且对应的 commit 是 `a66acb0` 或更新

### 10 步测试清单

**每一步做完都在下面打勾，发现问题立即停下并截图。**

#### A.1 打开首页
- [ ] 访问 https://synthlaunch.fun
- **预期**：页面正常加载，顶部有 logo、导航栏、链切换器
- **失败迹象**：500 错误页 / 空白页 / 无限加载

#### A.2 切换到 X Layer
- [ ] 在右上角或顶部找到链切换器（通常是一个下拉菜单或按钮，显示当前链名）
- [ ] 点击切换到 **X Layer**
- **预期**：
  - 页面上所有原生币符号从 `BNB` 变成 `OKB`
  - 没有红色错误 banner
  - 某些数据可能暂时显示 loading

#### A.3 连接钱包
- [ ] 点击右上角 "Connect Wallet"
- [ ] 选择你装的钱包（OKX Wallet / MetaMask / WalletConnect）
- [ ] 在钱包弹窗里批准连接
- **预期**：
  - 右上角显示你的 OKB 余额和地址前 6 位 + 后 4 位
  - **不应该**出现红色的 "Switch to BSC" 按钮（修复这个问题就是本次改动之一）
  - 如果钱包连的时候是 BSC，应该显示允许切换到 X Layer 或 BSC 的选项，而不是强制 BSC

#### A.4 访问 AI 终端
- [ ] 直接访问 https://synthlaunch.fun/ai
- **预期**：
  - AI 终端页面加载
  - 左侧有 sidebar（会话历史、工具列表）
  - 中间有聊天输入框
  - 顶部或状态栏应该显示当前连接的是 X Layer 或链 ID 196

#### A.5 测试 Balances 技能
- [ ] 在 AI 终端输入：`what's in my wallet`（或中文"我的钱包里有什么"）
- [ ] 回车
- **预期**：
  - 很快（2-5 秒内）返回一张"Balances"卡片
  - 卡片上显示你的 OKB 和/或其他代币余额
  - 应该是真实数据，不是 mock
- **如果失败**：可能是 OKX API 凭证没在 Vercel 生产环境配好。截图 Network 标签的 `/api/ai/chat` 请求和 response

#### A.6 测试 Token Search 技能
- [ ] 输入：`price of USDC` 或 `search USDC`
- [ ] 回车
- **预期**：返回一张 Price 或 Search 卡片，显示 USDC 的价格（USD 数值）

#### A.7 测试 Swap Quote（不执行）
- [ ] 输入：`swap 0.01 OKB to USDC`
- [ ] 回车
- **预期**：
  - 返回一张 Swap 卡片
  - 显示报价（你会得到多少 USDC）
  - 有一个 "Execute" 或 "Confirm" 按钮
- **这一步先不要点 Execute**，留给 demo 视频录制时用

#### A.8 `/tokens` 页面
- [ ] 点击导航栏的 `Tokens`，或直接访问 https://synthlaunch.fun/tokens
- [ ] 确认链切换器还是 X Layer
- **预期**：
  - 要么显示一个空列表（"No tokens yet on X Layer"或类似文案）
  - 要么显示已注册的 X Layer 代币列表
  - **不应该**是 500 错误页
  - **不应该**串链显示 BSC 的代币（那就是 bug）

#### A.9 `/launch` 页面
- [ ] 访问 https://synthlaunch.fun/launch
- [ ] 在页面上选择 **X Layer**（表单里应该有链选择器）
- **预期**：
  - 表单正常显示
  - 当前 beneficiary（受益人）地址应该预填为我们的新 custody：`0xb381e840AAB505132506781eAFD3c38398B58462`
  - **不要提交表单**——不是在真的发币

#### A.10 验证 `/api/tokens` 带 chainId 参数
- [ ] 在浏览器地址栏访问：`https://synthlaunch.fun/api/tokens?chainId=196`
- **预期**：返回一段 JSON（可能是 `[]` 空数组，也可能有数据），**不是 500**
- [ ] 再访问：`https://synthlaunch.fun/api/tokens?chainId=56`
- **预期**：返回 BSC 的代币列表 JSON

### 验证通过的标准

**10 步全部通过** → 进入 Phase B（录 demo 视频）。

### 发现问题怎么办

**任何一步失败**，按这个顺序处理：

1. **截图**：页面截图 + 浏览器 DevTools 的 Console 标签 + Network 标签的失败请求
2. **通知 Soren**：把截图和失败的步骤编号发给他
3. **等 Soren 修复**（他会找 Claude Code 或自己修，通常 30 分钟内）
4. **等他说"修好了"后重新从失败的那一步开始**
5. **不要跳过失败的步骤**去做后面的事

**特殊情况**：如果 A.5（Balances）和 A.6（Price）都失败，几乎肯定是 Vercel 生产环境的 `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_API_PASSPHRASE` / `OKX_PROJECT_ID` 四个环境变量没配或过期。直接告诉 Soren "OKX 环境变量可能需要在 Vercel 重新配置"。

### Phase A 完成标志

所有 10 步都有 ✅，截图整理存档（下一步录视频也要用到）。

---

## Phase B：录制 Demo 视频（预计 90 分钟）

**目标**：产出一段 **1 分 30 秒 到 2 分钟** 的 MP4 视频，能让 Hackathon 评委 2 分钟内看懂 SynthLaunch 是什么、怎么用、用了 OKX Onchain OS 的哪些能力。

### 视频质量要求

- **分辨率**：1920×1080（1080p）最低；2560×1440（2K）更好
- **帧率**：30fps 足够
- **时长**：90-120 秒，**不要超过 180 秒**
- **格式**：MP4（H.264 编码）
- **音频**：英文旁白优先；如果 Soren 要求中文，中文也可以但需要英文字幕
- **文件大小**：< 200MB

### 录制前准备（10 分钟）

1. **清理浏览器**：
   - 关掉所有不相关的 tab
   - 浏览器放大到 100%（`Cmd+0`）
   - 窗口拖到 1920×1080 大小
2. **钱包准备**：
   - 确保 OKX Wallet / MetaMask 在 X Layer 网络
   - 余额至少 0.02 OKB
   - 钱包扩展解锁好，不要录到输入密码
3. **关通知**：macOS → 系统偏好 → 通知 → 打开"请勿打扰"
4. **打开 Soren 的提示词文档**：`docs/hackathon/SUBMISSION.md` 的第 2 节（Demo Video Script）有完整的逐句文案和时间轴
5. **打开所有会用到的页面**（放到不同 tab，避免录制时加载时间）：
   - Tab 1: https://synthlaunch.fun （首页）
   - Tab 2: https://synthlaunch.fun/ai （AI 终端）
   - Tab 3: https://www.oklink.com/x-layer/address/0xb381e840AAB505132506781eAFD3c38398B58462 （Custody on OKLink）
   - Tab 4: https://github.com/V-SK/synthlaunch （README）
6. **启动录屏工具**：
   - **QuickTime Player**（macOS 自带，推荐）：
     - 打开 QuickTime Player
     - `File → New Screen Recording`
     - 右侧小箭头 → 选麦克风（内置麦克风或你的耳机麦克风）
     - 点红色录制按钮 → 拖选录制区域 → 开始录制
   - **OBS Studio**（更专业，免费）：https://obsproject.com/

### 录制脚本

**完整脚本在仓库里**：`docs/hackathon/SUBMISSION.md` 第 2 节（Demo Video Script）。

这里给一个**简化版**（英文旁白，适合录制时直接照读）：

> **[0:00 - 0:10] 标题卡 / 首页**
>
> "This is SynthLaunch. We give AI agents an onchain operating layer — identity, treasury, and execution — built around OKX Onchain OS on X Layer."
>
> **[0:10 - 0:25] 连接钱包，切换到 X Layer**
>
> "Connect wallet. Switch to X Layer. The whole app is chain-aware — every contract call goes to the chain you pick."
>
> **[0:25 - 0:45] 访问 /ai 终端**
>
> "This is the AI terminal. It's the heart of the Agentic Wallet. Under the hood it's wired to five Onchain OS skills: token search, balances, total value, quote, and swap."
>
> **[0:45 - 1:00] 输入 "what's in my wallet"，展示 Balances 卡片**
>
> "One prompt. Intent detection calls okxBalances, which hits the Onchain OS balance-by-address endpoint on X Layer."
>
> **[1:00 - 1:20] 输入 "swap 0.01 OKB for USDC"，显示报价，点击签名，广播**
>
> "Another prompt. The terminal calls okxQuote and okxSwap on the OKX aggregator. I sign in my own wallet — SynthLaunch never holds the key — and the tx lands on X Layer."
>
> **[1:20 - 1:40] 切换到 OKLink tab，展示三个 verified 合约**
>
> "All three of our core contracts — Custody, SynthID, and NFAv2 — are deployed and verified on OKLink. An agent has a soulbound identity in SynthID, a treasury in Custody, and a body in NFAv2. Together they form an Agentic Wallet."
>
> **[1:40 - 1:55] 切换到 GitHub README tab**
>
> "Everything is open source. The README walks through the Agentic Wallet composition, the five Onchain OS skills, and a 5-minute judge evaluation path."
>
> **[1:55 - 2:00] 结尾卡**
>
> "SynthLaunch. Built for OKX Build X. Thanks."

### 录制技巧

- **先排练 2 遍再正式录**，熟悉每个 tab 切换时机和动作
- **语速稍慢**，比你说话自然语速慢 20%，更清楚
- **不要用复杂动画**，直接切换 tab 就行
- **鼠标动作要清楚**，点击前稍微停顿一下让评委看到
- **即使错了也不要停**，剩下的部分继续录完，后期不好再重录整个
- **录制多个 take**：至少录 3 次，选最好的那次

### 录制完成后

1. **把视频导出为 MP4**
   - QuickTime: `File → Export As → 1080p`
2. **压缩到 < 200MB**
   - 如果太大，用 HandBrake（免费）压缩：https://handbrake.fr/
   - 或在线工具 https://www.freeconvert.com/video-compressor
3. **上传到 YouTube（推荐）或 Google Drive**：

#### 选项 A：YouTube（推荐）

1. 登录 YouTube（用 Soren 的 Google 账号或你的都行）
2. 右上角点 "Create" → "Upload video"
3. 选择视频文件
4. **Visibility 设为 `Unlisted`**（未列出）——不公开但任何有链接的人都能看
5. 标题：`SynthLaunch — OKX Build X Hackathon Demo`
6. 描述：
   ```
   SynthLaunch — Agent-native token launch protocol on X Layer
   Built for OKX Build X Hackathon (X Layer Arena)

   - Website: https://synthlaunch.fun
   - Code: https://github.com/V-SK/synthlaunch
   - Twitter: @synth_fun
   ```
7. 点 "Publish"
8. **复制生成的 URL**（形式是 `https://youtu.be/XXXXXXXXX`）

#### 选项 B：Google Drive

1. 登录 Google Drive
2. 上传视频文件
3. 右键视频 → "Share" → "Change to anyone with the link" → 权限 "Viewer"
4. 复制链接

### Phase B 完成标志

- [ ] 视频已上传
- [ ] 链接能在隐身窗口里打开播放
- [ ] 把链接写进 `docs/hackathon/SUBMISSION.md` 的占位符位置（但如果你没有 push 权限，就存在你自己的记事本里，准备 Google Form 用）

---

## Phase C：发布 X 推文（预计 15 分钟）

**目标**：从 [@synth_fun](https://twitter.com/synth_fun) 账号发一条带 `#XLayerHackathon` hashtag 的推文，带视频或截图。

### 推文文案（直接复制）

```
🧬 SynthLaunch is live on @XLayerOfficial.

Agent-native token launch + Onchain OS-native AI terminal.
AI agents now launch tokens, earn trading fees, and execute swaps — all onchain.

✅ 5 @OKX Onchain OS skills wired end-to-end
✅ Agentic Wallet = SynthID + NFAv2 + Custody
✅ Multi-chain (X Layer + BSC)
✅ Verified on OKLink

Demo 👇
[你的 YouTube 或 Google Drive 视频链接]

Code 👉 github.com/V-SK/synthlaunch

#XLayerHackathon #onchainos
```

### 推文配图

**必须至少有 1 张图或视频**。推荐：

- **最佳**：把 demo 视频直接上传到 Twitter（这样 Twitter 会自动播放，而不是跳转链接）
- **次佳**：截图 `/ai` 终端正在执行一次 swap 的画面（从 Phase B 录好的视频里截一帧）

### 发布步骤

1. 登录 [@synth_fun](https://twitter.com/synth_fun)
2. 点击左上角 "Post" 按钮（或 `N` 键）
3. 粘贴上面的文案
4. **检查字符数**：Twitter 单条限制 280 字符。如果超了，删掉最不重要的一行：
   - 先删 "✅ Multi-chain (X Layer + BSC)"
   - 再删 "✅ Verified on OKLink"
5. **上传视频**：
   - 点击图片图标
   - 选择 demo 视频文件
   - 等上传完成
6. **检查 @ 提及**：文案里有 `@XLayerOfficial` 和 `@OKX`，确认是 Twitter 把它们识别成蓝色链接了（表示真实账号存在）
   - 如果识别不出来，说明账号名拼错了，查一下正确的 handle（可能是 `@OKX_Web3` 或类似）
7. **检查 hashtag**：`#XLayerHackathon` 和 `#onchainos` 应该是蓝色链接
8. **发布**：点 "Post"
9. **复制推文链接**：发布后点推文，地址栏里的就是推文 URL，形如 `https://twitter.com/synth_fun/status/1234567890`

### Phase C 完成标志

- [ ] 推文已发布
- [ ] 推文链接保存（Google Form 要用）
- [ ] 推文里视频/图能正常显示
- [ ] 推文里 hashtag 和 @ 是蓝色的（可点击）

---

## Phase D：提交 Google Form（预计 30 分钟）

**目标**：在 OKX Build X Hackathon 官方 Google Form 上完成提交。这是**最关键的一步**，前面做的所有事只有通过 Form 提交才算正式参赛。

### 找到 Google Form 链接

官方入口：https://web3.okx.com/zh-hans/xlayer/build-x-hackathon

滚到页面底部找 "Submit" / "提交" 按钮，会跳转到 Google Form。**如果找不到**：

- 搜 "OKX Build X Hackathon submission form"
- 查 [@XLayerOfficial](https://twitter.com/XLayerOfficial) Twitter 最新公告
- 进 X Layer 的官方 Discord / Telegram 找活动管理员
- **不要用第三方论坛的链接**，只信官方渠道

**链接找到后**：记录下来，如果 Soren 已经保存过就直接用他的。

### 填写前准备（所有要粘贴的内容都已经准备好）

**打开 `docs/hackathon/SUBMISSION.md` 第 4 节（Google Form Answers）**。那里有每一个字段的现成答案，直接复制粘贴即可。

如果你没法打开 GitHub 上的 markdown 文件，下面是完整的备份：

---

#### 字段 1：项目名称 / Project Name
```
SynthLaunch
```

#### 字段 2：一句话定位 / Tagline
```
Agent-native token launch and monetization protocol on X Layer and BSC.
```

#### 字段 3：团队成员 / Team Members
```
Soren Lin (solo builder) — GitHub @V-SK — X @synth_fun
```

#### 字段 4：参赛赛道 / Track
```
X Layer Arena
```

#### 字段 5：项目介绍 / Project Introduction
```
SynthLaunch gives AI agents a complete onchain operating layer. An agent gets a soulbound identity (SynthID, ERC-8004 compatible), a dedicated treasury with signature-bound fee routing (SynthLaunchCustody), an evolvable NFT body with a whitelisted logic contract (NFAv2, BAP-578 style), and a chat terminal at /ai that is backed end-to-end by OKX Onchain OS skills. An AI agent can launch a token, earn trading fees, check its wallet, find tokens, and execute swaps — all onchain, all from the same interface, all on X Layer.
```

#### 字段 6：架构 / Architecture Overview
```
Frontend: Next.js 14 + TypeScript + Tailwind, wagmi v2 + viem for Web3.

Backend: Next.js API routes, Supabase (Postgres) for indexing and AI sessions, server-side OKX Onchain OS client with HMAC-signed requests.

Contracts: Solidity 0.8.20 compiled with Hardhat. SynthLaunchCustody handles per-agent fee accounting with signature-bound claims. SynthID is a soulbound ERC-721 for agent identity. NFAv2 is a non-fungible agent body with a logic allowlist. All three are deployed and verified on X Layer (and on BSC as a secondary chain).

Agentic Wallet composition:
  SynthID (identity) + NFAv2 (body) + SynthLaunchCustody (treasury) + /ai terminal (execution surface via OKX Onchain OS).

The user wallet acts as the controller; the Agentic Wallet is the on-protocol composition of identity, body, and treasury bound to that wallet by signature.
```

#### 字段 7：部署地址 / Deployment Addresses
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

#### 字段 8：Onchain OS / Uniswap Skill 使用说明
```
SynthLaunch uses FIVE OKX Onchain OS skills end-to-end, wired from a user-facing AI chat terminal to signed on-chain execution:

1. Token Search — OKX DEX /api/v6/dex/market/token/search
2. Balances     — OKX DEX /api/v6/dex/balance/all-token-balances-by-address
3. Total Value  — OKX DEX /api/v6/dex/balance/total-value-by-address
4. Quote        — OKX DEX /api/v6/dex/aggregator/quote
5. Swap Aggregator — OKX DEX /api/v6/dex/aggregator/swap

Implementation: src/lib/okx.ts (signed HMAC client).
Dispatch layer: src/app/api/ai/chat/route.ts (LLM intent detection -> OKX skill -> tool result -> rendered in UI).
REST wrappers: src/app/api/okx/{token-search,balances,quote,swap}/route.ts.
User surface: src/app/ai/page.tsx + src/components/ai/AiTerminalPage.tsx and the four sub-components AiChatPane / AiSidebar / AiStatusBar / AiToolCard.

Swap execution is non-custodial: the aggregator returns an unsigned transaction, the user signs it in their wallet, and the frontend broadcasts via viem. SynthLaunch never touches the private key.
```

#### 字段 9：工作机制 / Working Mechanics
```
1. User connects an EVM wallet and selects X Layer in the chain selector.
2. User mints a SynthID (soulbound identity) for their agent.
3. User launches an agent token via the Flap Portal on X Layer, routing the trading tax to SynthLaunchCustody with the agent name as the accounting key.
4. User binds a claim wallet to the agent by calling SynthLaunchCustody.bindWallet(agentName, wallet, nonce, signature). This pins the Agentic Wallet identity to a specific address.
5. User optionally mints an NFAv2 body for the agent and attaches a whitelisted logic contract (AgentLogic / AgentLogicPro).
6. User opens the AI terminal at /ai and interacts with their agent. The terminal uses OKX Onchain OS skills for every onchain read/write action it needs to take.
7. Trading fees accumulate in Custody. The bound wallet can call claim(token) to withdraw the agent's share; the platform keeps the configured platform fee.
```

#### 字段 10：Agentic Wallet 说明
```
SynthLaunch treats an "Agentic Wallet" as a composition, not a single contract. It has four parts:

- SynthID (soulbound ERC-721) — identity. Cannot be transferred away from the owner wallet, ensuring durable agent identity.
- NFAv2 (ERC-721 with logic allowlist) — agent body. Balance, XP, and the logic contract define what the agent can do onchain.
- SynthLaunchCustody — treasury. A signer-bound claim mechanism ties a specific wallet to an agent name via ECDSA signature. Only the bound wallet can claim fees.
- /ai terminal (backed by OKX Onchain OS) — execution surface. The agent's interactions with the wallet, tokens, and swaps go through Onchain OS skills.

Multiple agents per user are supported. Each agent has exactly one SynthID and at most one NFAv2 body; the owner wallet can manage many. The README section "Agentic Wallet — how it works" contains an ASCII diagram that shows the composition.
```

#### 字段 11：X Layer 生态定位 / Project Positioning in X Layer Ecosystem
```
X Layer is the best home for SynthLaunch because agent-native economies need high-frequency, low-cost on-chain interactions in the same environment where Onchain OS lives. SynthLaunch is the first project we are aware of that wires the Onchain OS skill set directly into an AI agent's chat surface, turning every prompt into a potential on-chain read or write. We see SynthLaunch as the agent entry point to the X Layer ecosystem: an agent that is born with identity, a treasury, and a fully functional Onchain OS-powered wallet out of the box.
```

#### 字段 12：源代码链接 / Source Code
```
https://github.com/V-SK/synthlaunch
```

#### 字段 13：Live Demo
```
https://synthlaunch.fun
```

#### 字段 14：Demo 视频
```
[贴你 Phase B 拿到的 YouTube / Google Drive 链接]
```

#### 字段 15：社交媒体帖子
```
[贴你 Phase C 拿到的 Twitter 链接]
```

---

### 填写顺序建议

1. **先打开 Form**，快速浏览一遍所有字段
2. **对照 SUBMISSION.md 或本文档**，逐字段复制粘贴
3. **Demo 视频链接和推文链接是你手工加的**，其他都现成
4. **每填完一个重要字段就点一次保存**（如果 Form 支持）
5. **提交前全部检查一遍**：
   - [ ] 项目名拼写
   - [ ] 所有合约地址拼写无误（最容易出错）
   - [ ] Demo 视频链接能打开
   - [ ] 推文链接能打开
   - [ ] 源代码链接能在**隐身窗口**打开（验证仓库确实 public）
6. **截图所有填写内容**（万一 Form 出错要重填）
7. **点 Submit**
8. **截图提交成功页面**（有些 Form 会返回确认邮件，有些直接在页面显示）

### Phase D 完成标志

- [ ] Form 已提交
- [ ] 有提交成功的截图
- [ ] 如果收到官方确认邮件，截图保存
- [ ] 在 `docs/hackathon/SUBMISSION.md` 的 Final Checklist 里勾掉 "Submit the Google Form"

---

## Phase E：提交后监控（每天 5 分钟）

**从提交日开始到 4 月 30 日**：

### 每天做的事

1. **查 [@synth_fun](https://twitter.com/synth_fun) 的邮箱**，找官方发来的邮件（主题可能包含 "X Layer Hackathon" 或 "Build X"）
2. **看 Twitter [@XLayerOfficial](https://twitter.com/XLayerOfficial)** 有没有关于结果公布的公告
3. **检查 https://synthlaunch.fun 还在线**——如果评委正在测试，网站挂了就完了
   - 去 Vercel dashboard 看一眼，是绿色就好
4. **检查 GitHub 仓库还是 public** 的，README 没被误改

### 如果收到官方邮件

- **邮件要求补充信息**：Soren 第一时间处理，你帮忙整理
- **邮件说进入下一轮**：庆祝！保存邮件截图
- **邮件说被筛掉**：也没事，经验值拉满

### 如果网站挂了

1. 截图错误信息
2. 去 Vercel dashboard 看 deployment 是不是失败
3. 立即通知 Soren

---

## 9. 故障排查

### 问题 A：`/ai` 终端返回 "OKX API unavailable" 或 503

**原因**：Vercel 生产环境没配 OKX API 凭证，或者凭证过期。

**解决**：告诉 Soren 检查 Vercel dashboard → Settings → Environment Variables，确认以下四个变量存在且有值：

```
OKX_API_KEY
OKX_SECRET_KEY
OKX_API_PASSPHRASE
OKX_PROJECT_ID
```

他自己可以重新生成 key 并填进去，一般 10 分钟内可以修好。

### 问题 B：`/tokens` 返回 500

**原因**：可能是 Supabase 连接问题，或者 chain_id 迁移没跑（但你已经跑过了）。

**解决**：

1. 访问 `https://synthlaunch.fun/api/tokens?chainId=196` 看原始错误
2. 把错误截图给 Soren

### 问题 C：WalletConnect 不识别 X Layer

**原因**：某些钱包扩展（特别是老版本 MetaMask）可能需要手动添加 X Layer 网络。

**解决**：手动添加 X Layer 配置：

```
Network Name: X Layer
RPC URL: https://xlayerrpc.okx.com
Chain ID: 196
Currency Symbol: OKB
Block Explorer URL: https://www.oklink.com/x-layer
```

### 问题 D：录制视频时，swap 执行失败

**原因**：OKB 不够 gas，或者滑点太高，或者 OKX aggregator 临时故障。

**解决**：

1. 确认钱包余额 > 0.02 OKB
2. 重试 swap
3. 如果多次失败，**录视频时跳过 swap 执行那一步**，只展示 quote，视频加一段字幕说 "swap ready — user signs to execute"

### 问题 E：Twitter 发推文字数超限

**解决**：按顺序删掉：

1. 先删 "✅ Verified on OKLink"
2. 再删 "✅ Multi-chain (X Layer + BSC)"
3. 最后实在不行删 Code 链接（仓库地址够出名）

### 问题 F：Google Form 提交失败

**原因**：网络问题 / 字段格式不对 / 必填项漏填。

**解决**：

1. **立即截图错误** + 你填的所有字段
2. **换浏览器重试**（Chrome → Safari → Firefox）
3. **换网络重试**
4. **必要时换 Google 账号** 重新开始填
5. **通知 Soren**，让他联系 X Layer 官方渠道（Discord / Twitter DM）

### 问题 G：发现仓库有敏感信息泄露

**解决**：**立刻**把仓库改回 private（Settings → Danger Zone），然后通知 Soren。不要在 issues 里讨论，不要 email 讨论具体泄露内容。

---

## 10. 交接完成标准

当以下**全部**满足，你的任务就完成了：

- [ ] Phase A 10 步 E2E 验证全部通过，或者失败项都已经 Soren 修复
- [ ] Phase B demo 视频已上传，链接在隐身窗口可打开
- [ ] Phase C X 推文已发布，链接记录
- [ ] Phase D Google Form 已提交，有提交截图
- [ ] `docs/hackathon/SUBMISSION.md` 顶部的 Final Checklist 全部打勾
- [ ] Soren 确认收到你的交接报告
- [ ] 监控期（Phase E）每日任务持续到 4 月 30 日

### 交接报告模板（发给 Soren）

提交完成后，发一份报告给 Soren：

```
📦 SynthLaunch Hackathon 提交报告

日期：2026-04-XX
提交状态：✅ 已完成

1. E2E 验证：通过 X/10 步，失败项 [如有] 已修复
2. Demo 视频：[YouTube/Drive 链接]
3. X 推文：[Twitter 链接]
4. Google Form：已提交，确认邮件 [收到/未收到]

截图已存档（见附件或共享链接）。
监控期至 2026-04-30。

结束。
```

---

## 11. 紧急联系

- **Soren Lin（项目负责人）**：
  - Twitter: [@synth_fun](https://twitter.com/synth_fun)
  - GitHub: [@V-SK](https://github.com/V-SK)
  - Email: 问他拿

- **如果 Soren 联系不上**：
  - 优先保护：不要乱删、不要提交错误信息、不要发未授权的推文
  - 如果网站挂了但你没权限修复 → 记录错误，等他回来
  - 如果快截止了（< 12 小时）还联系不上 → 用你手头的资料**宁可先提交一次 Google Form**，带上 "pending update" 注明，总比完全没提交好

---

## 附录：重要链接一览

### 项目
- 官网：https://synthlaunch.fun
- GitHub：https://github.com/V-SK/synthlaunch
- Twitter：https://twitter.com/synth_fun
- 提交物料原文：https://github.com/V-SK/synthlaunch/blob/main/docs/hackathon/SUBMISSION.md
- 本交接手册：https://github.com/V-SK/synthlaunch/blob/main/docs/hackathon/HANDOFF.md

### Hackathon
- 活动主页：https://web3.okx.com/zh-hans/xlayer/build-x-hackathon
- 官方 Twitter：[@XLayerOfficial](https://twitter.com/XLayerOfficial)
- 截止：2026-04-15 23:59 UTC

### X Layer 工具
- OKLink 区块浏览器：https://www.oklink.com/x-layer
- X Layer RPC：https://xlayerrpc.okx.com
- Chain ID：196
- 原生币：OKB

### 合约地址速查
- Custody：[`0xb381e840AAB505132506781eAFD3c38398B58462`](https://www.oklink.com/x-layer/address/0xb381e840AAB505132506781eAFD3c38398B58462)
- SynthID：[`0xE7369f4bA311f59C7476e4A0279d42F767cddd20`](https://www.oklink.com/x-layer/address/0xE7369f4bA311f59C7476e4A0279d42F767cddd20)
- NFAv2：[`0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E`](https://www.oklink.com/x-layer/address/0x68FF6877A17e12Ccbb19beaADb8785CE4E4b949E)

---

**文档结束**

如果执行过程中有文档没写清楚的地方，找 Soren 问。祝顺利。
