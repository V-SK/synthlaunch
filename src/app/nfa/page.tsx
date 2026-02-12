"use client";

import { useState, useEffect } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";

// ============ Contract Config ============
const AGENT_LOGIC_PRO = "0x7a08ff7ab3EF202F7B499648a25FCD94Fb5a8857";
const NFAv2_ADDRESS = "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19";

const AGENT_LOGIC_PRO_ABI = [
  {
    name: "swapBNB",
    type: "function",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    name: "swapToken",
    type: "function", 
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    name: "batchTransferERC20",
    type: "function",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "batchSwap",
    type: "function",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "swaps", type: "tuple[]", components: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMin", type: "uint256" }
      ] },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amountsOut", type: "uint256[]" }],
    stateMutability: "nonpayable"
  },
  {
    name: "transferERC20",
    type: "function",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "emergencyWithdraw",
    type: "function",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "to", type: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

// ============ Components ============

function FeatureCard({ 
  icon, title, desc, tag 
}: { 
  icon: string; title: string; desc: string; tag?: string 
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-neon/20 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon/20 to-cyan-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
          {icon}
        </div>
        {tag && (
          <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-neon/10 text-neon border border-neon/20">
            {tag}
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-[13px] text-white/50 leading-relaxed">{desc}</p>
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] tracking-[2px] text-white/40 uppercase mb-1 font-mono">{label}</div>
      <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon to-cyan-400">
        {value}
      </div>
      {sub && <div className="text-[11px] text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-black/40 border border-white/[0.08] rounded-xl p-4 overflow-x-auto">
      <code className="text-[12px] text-neon/80 font-mono leading-relaxed">{code}</code>
    </pre>
  );
}

// ============ Main Page ============

export default function NFAProPage() {
  const { address, isConnected } = useAccount();
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const proFeatures = [
    {
      icon: "⚡",
      title: "Batch Swap",
      desc: "Execute multiple token swaps in a single transaction. Reduce gas costs by up to 60% compared to individual swaps.",
      tag: "GAS SAVER"
    },
    {
      icon: "📤",
      title: "Batch Transfer",
      desc: "Airdrop tokens to multiple addresses simultaneously. Perfect for community rewards and distributions.",
      tag: "MULTI-SEND"
    },
    {
      icon: "🔄",
      title: "Smart Swap",
      desc: "Swap any token pair through PancakeSwap with automatic routing. BNB and ERC20 supported.",
      tag: "DEX"
    },
    {
      icon: "🛡️",
      title: "Emergency Withdraw",
      desc: "Instantly recover all tokens from your agent in case of emergency. Owner-only safety feature.",
      tag: "SECURITY"
    },
    {
      icon: "🤖",
      title: "On-Chain Autonomy",
      desc: "Your AI agent executes trades autonomously based on your strategy. True decentralized AI.",
      tag: "AI"
    },
    {
      icon: "🔗",
      title: "BAP-578 Standard",
      desc: "Built on Non-Fungible Agents standard. Fully compatible with the BNB Chain AI ecosystem.",
      tag: "STANDARD"
    }
  ];

  const codeExample = `// Batch swap example - swap multiple tokens at once
await agentLogicPro.batchSwap(
  agentId,
  [
    { tokenIn: WBNB, tokenOut: USDT, amountIn: 1e18, amountOutMin: 0 },
    { tokenIn: WBNB, tokenOut: CAKE, amountIn: 0.5e18, amountOutMin: 0 }
  ],
  deadline
);

// Batch transfer - airdrop to multiple addresses
await agentLogicPro.batchTransferERC20(
  agentId,
  tokenAddress,
  [addr1, addr2, addr3],
  [amount1, amount2, amount3]
);`;

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
            <div className="text-[10px] text-white/35 tracking-[2px] font-mono">ADVANCED AI AGENT OPERATIONS</div>
          </div>
        </div>
        
        <WalletConnect />
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-8 py-16 max-w-[1200px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon/10 border border-neon/20 mb-6">
          <span className="w-2 h-2 rounded-full bg-neon animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-neon">BNB AGENTS ARMY</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-black mb-4 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60">
            Real AI Agents
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon to-cyan-400">
            Running On-Chain
          </span>
        </h1>
        
        <p className="text-lg text-white/50 max-w-[600px] mx-auto mb-10 leading-relaxed">
          NFA Pro enables your AI agents to execute complex DeFi operations autonomously. 
          Batch swaps, multi-transfers, and smart trading — all in a single transaction.
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-12 mb-10">
          <StatBox label="Contract" value="Verified" sub="BscScan" />
          <StatBox label="Gas Saved" value="60%" sub="vs single txs" />
          <StatBox label="Operations" value="6+" sub="Pro features" />
        </div>

        {/* CTA Buttons */}
        <div className="flex justify-center gap-4">
          <a 
            href="https://github.com/V-SK/synthlaunch-contracts"
            target="_blank"
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-neon to-emerald-400 text-black font-bold text-sm tracking-wide hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span>View Source</span>
            <span>→</span>
          </a>
          <a 
            href="https://bscscan.com/address/0x7a08ff7ab3EF202F7B499648a25FCD94Fb5a8857#code"
            target="_blank"
            className="px-8 py-3.5 rounded-xl bg-white/[0.06] text-white font-bold text-sm tracking-wide hover:bg-white/[0.1] transition-colors border border-white/10"
          >
            BscScan ↗
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 px-8 py-12 max-w-[1200px] mx-auto">
        <h2 className="text-2xl font-bold text-center mb-3">Pro Features</h2>
        <p className="text-white/40 text-center mb-10 text-sm">Everything your AI agent needs to operate autonomously</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proFeatures.map((f, i) => (
            <FeatureCard key={i} {...f} />
          ))}
        </div>
      </section>

      {/* Code Example */}
      <section className="relative z-10 px-8 py-12 max-w-[900px] mx-auto">
        <h2 className="text-xl font-bold text-center mb-2">Developer Integration</h2>
        <p className="text-white/40 text-center mb-6 text-sm">Simple API for complex operations</p>
        <CodeBlock code={codeExample} />
      </section>

      {/* Contract Addresses */}
      <section className="relative z-10 px-8 py-12 max-w-[800px] mx-auto">
        <h2 className="text-xl font-bold text-center mb-6">Deployed Contracts</h2>
        
        <div className="space-y-3">
          {[
            { name: "AgentLogic Pro", addr: AGENT_LOGIC_PRO, status: "✓ Verified" },
            { name: "NFAv2", addr: NFAv2_ADDRESS, status: "✓ Verified" },
            { name: "SynthLaunch Custody", addr: "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7", status: "✓ Timelock" },
          ].map((c, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div>
                <div className="font-semibold text-white text-sm">{c.name}</div>
                <div className="font-mono text-[12px] text-white/40">{c.addr}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-neon font-medium">{c.status}</span>
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
      <footer className="relative z-10 px-8 py-8 border-t border-white/[0.04] mt-12">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center">
          <div className="text-[12px] text-white/30">
            © 2026 SynthLaunch · Built for BNB Agents Army
          </div>
          <div className="flex gap-6">
            <a href="https://twitter.com/synth_fun" target="_blank" className="text-white/30 hover:text-neon transition-colors text-sm">
              Twitter
            </a>
            <a href="https://github.com/V-SK/synthlaunch-contracts" target="_blank" className="text-white/30 hover:text-neon transition-colors text-sm">
              GitHub
            </a>
            <a href="https://synthlaunch.fun" className="text-white/30 hover:text-neon transition-colors text-sm">
              Website
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
