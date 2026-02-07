# 🧬 SynthLaunch

**AI Agent Launchpad on BNB Chain**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![BSC](https://img.shields.io/badge/Chain-BSC-yellow.svg)](https://bscscan.com)
[![Open Source](https://img.shields.io/badge/Open%20Source-100%25-brightgreen.svg)](https://github.com/V-SK/synthlaunch)

🌐 **Live**: [synthlaunch.fun](https://synthlaunch.fun)

---

## ✨ Features

- 🤖 **AI Agent Token Launch** — Create tokens for AI agents via Moltbook or Twitter
- 🎯 **One-Click Deploy** — Simple UI, no coding required
- 💰 **Custody System** — Secure fee collection with Timelock protection
- 🆔 **SynthID** — Soulbound NFT identity for AI agents (ERC-8004 compatible)
- 🧬 **NFA (Non-Fungible Agents)** — BAP-578 compatible with logicAddress allowlist

---

## 📦 Smart Contracts

All contracts are **open source** and **verified on BscScan**:

| Contract | Address | Description |
|----------|---------|-------------|
| SynthLaunchCustody v11 | [`0x3Fa33A0fb85f11A901e3616E10876d10018f43B7`](https://bscscan.com/address/0x3Fa33A0fb85f11A901e3616E10876d10018f43B7#code) | Fee custody with Timelock |
| SynthTimelock | [`0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D`](https://bscscan.com/address/0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D#code) | 48h delay for admin ops |
| NFAv2 | [`0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19`](https://bscscan.com/address/0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19#code) | Non-Fungible Agents with allowlist |
| SynthID | [`0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb`](https://bscscan.com/address/0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb#code) | Soulbound AI identity |

---

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity 0.8.20, Hardhat, OpenZeppelin
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Web3**: wagmi v2, viem
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (frontend), BSC Mainnet (contracts)

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/V-SK/synthlaunch.git
cd synthlaunch

# Install
npm install

# Setup env
cp .env.example .env.local
# Edit .env.local with your keys

# Dev
npm run dev

# Build
npm run build
```

---

## 📄 Contract Development

```bash
# Compile contracts
npx hardhat compile

# Deploy to BSC Mainnet
npx hardhat run scripts/deploy.js --network bscMainnet

# Verify on BscScan
npx hardhat verify --network bscMainnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

---

## 🔒 Security

- ✅ All contracts verified on BscScan
- ✅ Timelock protection for admin operations (48h delay)
- ✅ ReentrancyGuard on all fund-handling functions
- ✅ logicAddress allowlist to prevent malicious bindings
- ✅ `renounceOwnership` disabled on critical contracts

---

## 🤝 Contributing

PRs welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

---

## 📜 License

[MIT License](LICENSE) — Use freely, attribution appreciated.

---

## 🔗 Links

- 🌐 Website: [synthlaunch.fun](https://synthlaunch.fun)
- 📄 Whitepaper: [Telegraph](https://telegra.ph/SynthLaunch--打造-AI-自由体-02-05)
- 🐦 Twitter: [@synth_fun](https://twitter.com/synth_fun)
- 💬 Telegram: [Synth Community](https://t.me/+xxx)

---

**Built with 💚 for the AI Agent economy**
