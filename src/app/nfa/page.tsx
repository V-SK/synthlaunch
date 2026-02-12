"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";

// ============ Contract Config ============
const AGENT_LOGIC_PRO = "0x7a08ff7ab3EF202F7B499648a25FCD94Fb5a8857";
const NFAv2_ADDRESS = "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19";

// ============ i18n ============
const texts = {
  en: {
    badge: "BNB AGENTS ARMY",
    heroTitle1: "Real AI Agents",
    heroTitle2: "Running On-Chain",
    heroDesc: "NFA Pro enables your AI agents to execute complex DeFi operations autonomously. Batch swaps, multi-transfers, and smart trading — all in a single transaction.",
    viewSource: "View Source",
    tierTitle: "Choose Your Tier",
    tierDesc: "From simple identity to full AI autonomy",
    lite: {
      name: "Lite",
      price: "Free",
      desc: "Basic on-chain identity",
      features: ["NFT-based identity", "Avatar & metadata", "Wallet binding", "Basic profile"]
    },
    standard: {
      name: "Standard", 
      price: "0.05 BNB",
      desc: "DeFi operations enabled",
      features: ["Everything in Lite", "Token swaps", "ERC20 transfers", "DEX integration", "Gas optimized"]
    },
    pro: {
      name: "Pro",
      price: "0.1 BNB",
      desc: "Full AI autonomy",
      features: ["Everything in Standard", "Batch operations", "Learning module", "Memory storage", "Multi-agent delegation", "Emergency controls"]
    },
    recommended: "RECOMMENDED",
    features: "Pro Features",
    featuresDesc: "Everything your AI agent needs to operate autonomously",
    featureCards: [
      { icon: "⚡", title: "Batch Swap", desc: "Execute multiple token swaps in a single transaction. Reduce gas costs by up to 60%.", tag: "GAS SAVER" },
      { icon: "📤", title: "Batch Transfer", desc: "Airdrop tokens to multiple addresses simultaneously. Perfect for distributions.", tag: "MULTI-SEND" },
      { icon: "🧠", title: "Learning Module", desc: "Merkle tree-based verifiable learning. On-chain proof of AI learning.", tag: "AI" },
      { icon: "💾", title: "Memory Storage", desc: "Persistent on-chain key-value storage. Agent memory across sessions.", tag: "STORAGE" },
      { icon: "🤝", title: "Multi-Agent", desc: "Cross-agent delegation with time-limited permissions.", tag: "COLLAB" },
      { icon: "🛡️", title: "Emergency Withdraw", desc: "Instantly recover all tokens in emergencies. Owner-only safety.", tag: "SECURITY" }
    ],
    aliceTitle: "Meet Alice",
    aliceDesc: "The first live AI agent powered by NFA Pro",
    aliceFeatures: [
      "🤖 Real AI running on OpenClaw",
      "⚡ Autonomous on-chain execution", 
      "💬 Natural language interaction",
      "📊 Active trading & monitoring"
    ],
    aliceActive: "LIVE NOW",
    contracts: "Deployed Contracts",
    footer: "Built for BNB Agents Army"
  },
  zh: {
    badge: "BNB AGENTS ARMY",
    heroTitle1: "真正的 AI Agent",
    heroTitle2: "链上自主运行",
    heroDesc: "NFA Pro 让你的 AI Agent 能够自主执行复杂的 DeFi 操作。批量交换、多地址转账、智能交易——一笔交易搞定。",
    viewSource: "查看源码",
    tierTitle: "选择你的档次",
    tierDesc: "从简单身份到完整 AI 自主权",
    lite: {
      name: "Lite",
      price: "免费",
      desc: "基础链上身份",
      features: ["NFT 身份", "头像和元数据", "钱包绑定", "基础资料"]
    },
    standard: {
      name: "Standard",
      price: "0.05 BNB", 
      desc: "DeFi 操作能力",
      features: ["包含 Lite 全部", "代币交换", "ERC20 转账", "DEX 集成", "Gas 优化"]
    },
    pro: {
      name: "Pro",
      price: "0.1 BNB",
      desc: "完整 AI 自主权",
      features: ["包含 Standard 全部", "批量操作", "学习模块", "记忆存储", "多 Agent 协作", "紧急控制"]
    },
    recommended: "推荐",
    features: "Pro 功能",
    featuresDesc: "AI Agent 自主运行所需的一切",
    featureCards: [
      { icon: "⚡", title: "批量交换", desc: "单笔交易执行多个代币交换，节省高达 60% Gas 费用。", tag: "省 GAS" },
      { icon: "📤", title: "批量转账", desc: "同时向多个地址空投代币，完美用于社区分发。", tag: "多地址" },
      { icon: "🧠", title: "学习模块", desc: "基于 Merkle 树的可验证学习，链上 AI 学习证明。", tag: "AI" },
      { icon: "💾", title: "记忆存储", desc: "链上持久化键值存储，跨会话保持 Agent 记忆。", tag: "存储" },
      { icon: "🤝", title: "多 Agent 协作", desc: "跨 Agent 授权委托，支持时间限制和权限控制。", tag: "协作" },
      { icon: "🛡️", title: "紧急提取", desc: "紧急情况下立即恢复所有代币，仅限所有者。", tag: "安全" }
    ],
    aliceTitle: "认识 Alice",
    aliceDesc: "第一个由 NFA Pro 驱动的真实 AI Agent",
    aliceFeatures: [
      "🤖 运行在 OpenClaw 上的真实 AI",
      "⚡ 自主链上执行",
      "💬 自然语言交互",
      "📊 主动交易和监控"
    ],
    aliceActive: "运行中",
    contracts: "已部署合约",
    footer: "为 BNB Agents Army 打造"
  }
};

// ============ Components ============

function TierCard({ 
  tier, isPopular, lang 
}: { 
  tier: { name: string; price: string; desc: string; features: string[] }; 
  isPopular?: boolean;
  lang: "en" | "zh";
}) {
  const t = texts[lang];
  return (
    <div className={`
      relative bg-white/[0.03] border rounded-2xl p-6 flex flex-col
      ${isPopular 
        ? "border-neon/40 scale-105 shadow-lg shadow-neon/10" 
        : "border-white/[0.06]"
      }
    `}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-neon to-cyan-400 rounded-full text-[10px] font-bold text-black tracking-wider">
          {t.recommended}
        </div>
      )}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
        <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon to-cyan-400">
          {tier.price}
        </div>
        <div className="text-xs text-white/40 mt-1">{tier.desc}</div>
      </div>
      <ul className="flex-1 space-y-2 mb-4">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px] text-white/60">
            <span className="text-neon">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureCard({ 
  icon, title, desc, tag 
}: { 
  icon: string; title: string; desc: string; tag?: string 
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-neon/20 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon/20 to-cyan-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
          {icon}
        </div>
        {tag && (
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-neon/10 text-neon border border-neon/20">
            {tag}
          </span>
        )}
      </div>
      <h3 className="text-base font-bold text-white mb-1">{title}</h3>
      <p className="text-[12px] text-white/45 leading-relaxed">{desc}</p>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-black/40 border border-white/[0.08] rounded-xl p-4 overflow-x-auto">
      <code className="text-[11px] text-neon/80 font-mono leading-relaxed">{code}</code>
    </pre>
  );
}

// ============ Main Page ============

export default function NFAProPage() {
  const { address, isConnected } = useAccount();
  const [lang, setLang] = useState<"en" | "zh">("en");
  const t = texts[lang];

  const codeExample = `// Batch swap - multiple tokens at once
await agentLogicPro.batchSwap(agentId, [
  { tokenIn: WBNB, tokenOut: USDT, amountIn: 1e18 },
  { tokenIn: WBNB, tokenOut: CAKE, amountIn: 0.5e18 }
], deadline);

// Store learning proof
await agentLogicPro.commitLearning(agentId, merkleRoot);`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute -top-[150px] -right-[150px] w-[500px] h-[500px] bg-neon/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] -left-[100px] w-[400px] h-[400px] bg-cyan-500/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[50%] left-[50%] w-[300px] h-[300px] bg-purple-500/[0.04] rounded-full blur-[100px] pointer-events-none" />
      
      {/* Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: "linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Header */}
      <header className="relative z-20 px-8 py-5 flex justify-between items-center border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon via-emerald-400 to-cyan-400 flex items-center justify-center text-lg font-black text-black shadow-lg shadow-neon/20">
              ⚡
            </div>
            <div>
              <div className="text-lg font-bold tracking-wide flex items-center gap-2">
                NFA Pro
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-neon/20 to-cyan-500/20 text-neon border border-neon/30">
                  v1.0
                </span>
              </div>
              <div className="text-[10px] text-white/35 tracking-[2px] font-mono">BAP-578 STANDARD</div>
            </div>
          </a>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Language Switch */}
          <div className="flex bg-white/[0.04] rounded-lg p-0.5">
            <button 
              onClick={() => setLang("en")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${lang === "en" ? "bg-neon/20 text-neon" : "text-white/40 hover:text-white/60"}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang("zh")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${lang === "zh" ? "bg-neon/20 text-neon" : "text-white/40 hover:text-white/60"}`}
            >
              中文
            </button>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-8 py-14 max-w-[1200px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon/10 border border-neon/20 mb-6">
          <span className="w-2 h-2 rounded-full bg-neon animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-neon">{t.badge}</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60">
            {t.heroTitle1}
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon to-cyan-400">
            {t.heroTitle2}
          </span>
        </h1>
        
        <p className="text-base text-white/50 max-w-[550px] mx-auto mb-8 leading-relaxed">
          {t.heroDesc}
        </p>

        {/* CTA Buttons */}
        <div className="flex justify-center gap-4 mb-12">
          <a 
            href="https://github.com/V-SK/synthlaunch-contracts"
            target="_blank"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-neon to-emerald-400 text-black font-bold text-sm tracking-wide hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span>{t.viewSource}</span>
            <span>→</span>
          </a>
          <a 
            href="https://bscscan.com/address/0x7a08ff7ab3EF202F7B499648a25FCD94Fb5a8857#code"
            target="_blank"
            className="px-6 py-3 rounded-xl bg-white/[0.06] text-white font-bold text-sm tracking-wide hover:bg-white/[0.1] transition-colors border border-white/10"
          >
            BscScan ↗
          </a>
        </div>
      </section>

      {/* Tier Comparison */}
      <section className="relative z-10 px-8 py-10 max-w-[1000px] mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">{t.tierTitle}</h2>
        <p className="text-white/40 text-center mb-8 text-sm">{t.tierDesc}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <TierCard tier={t.lite} lang={lang} />
          <TierCard tier={t.standard} lang={lang} />
          <TierCard tier={t.pro} isPopular lang={lang} />
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 px-8 py-10 max-w-[1100px] mx-auto">
        <h2 className="text-xl font-bold text-center mb-2">{t.features}</h2>
        <p className="text-white/40 text-center mb-8 text-sm">{t.featuresDesc}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {t.featureCards.map((f, i) => (
            <FeatureCard key={i} {...f} />
          ))}
        </div>
      </section>

      {/* Alice Demo */}
      <section className="relative z-10 px-8 py-10 max-w-[900px] mx-auto">
        <div className="bg-gradient-to-br from-neon/[0.08] to-cyan-500/[0.05] border border-neon/20 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-neon to-cyan-400 flex items-center justify-center text-4xl shadow-lg shadow-neon/30">
              🤖
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h3 className="text-2xl font-bold text-white">{t.aliceTitle}</h3>
                <span className="px-2 py-0.5 rounded-full bg-neon/20 text-neon text-[10px] font-bold animate-pulse">
                  {t.aliceActive}
                </span>
              </div>
              <p className="text-white/50 text-sm mb-4">{t.aliceDesc}</p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                {t.aliceFeatures.map((f, i) => (
                  <span key={i} className="text-[12px] text-white/60 bg-white/[0.04] px-3 py-1.5 rounded-lg">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="relative z-10 px-8 py-8 max-w-[800px] mx-auto">
        <CodeBlock code={codeExample} />
      </section>

      {/* Contract Addresses */}
      <section className="relative z-10 px-8 py-8 max-w-[800px] mx-auto">
        <h2 className="text-lg font-bold text-center mb-4">{t.contracts}</h2>
        
        <div className="space-y-2">
          {[
            { name: "AgentLogic Pro", addr: AGENT_LOGIC_PRO, status: "✓ Verified" },
            { name: "NFAv2", addr: NFAv2_ADDRESS, status: "✓ Verified" },
            { name: "SynthLaunch Custody", addr: "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7", status: "✓ Timelock" },
          ].map((c, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div>
                <div className="font-semibold text-white text-sm">{c.name}</div>
                <div className="font-mono text-[11px] text-white/40">{c.addr}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-neon font-medium">{c.status}</span>
                <a 
                  href={`https://bscscan.com/address/${c.addr}`}
                  target="_blank"
                  className="text-white/30 hover:text-white transition-colors text-sm"
                >
                  ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-6 border-t border-white/[0.04] mt-8">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center">
          <div className="text-[11px] text-white/30">
            © 2026 SynthLaunch · {t.footer}
          </div>
          <div className="flex gap-5">
            <a href="https://twitter.com/synth_fun" target="_blank" className="text-white/30 hover:text-neon transition-colors text-xs">
              Twitter
            </a>
            <a href="https://github.com/V-SK/synthlaunch-contracts" target="_blank" className="text-white/30 hover:text-neon transition-colors text-xs">
              GitHub
            </a>
            <a href="/" className="text-white/30 hover:text-neon transition-colors text-xs">
              Home
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
