"use client";

import { useState } from "react";
import Link from "next/link";

// ============ Sidebar Navigation ============
const sections = [
  { id: "overview", label: "Overview", icon: "🎯" },
  { id: "architecture", label: "Architecture", icon: "🏗️" },
  { id: "tiers", label: "Agent Tiers", icon: "⚡" },
  { id: "lifecycle", label: "Lifecycle", icon: "🔄" },
  { id: "features", label: "Pro Features", icon: "🚀" },
  { id: "usecases", label: "Use Cases", icon: "💡" },
  { id: "security", label: "Security", icon: "🛡️" },
  { id: "alice", label: "Live Demo: Alice", icon: "🤖" },
  { id: "contracts", label: "Contracts", icon: "📜" },
  { id: "api", label: "API Reference", icon: "⚙️" },
];

// ============ Components ============

function NavItem({ id, label, icon, active, onClick }: { id: string; label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-all ${
        active 
          ? "bg-neon/10 text-neon border-l-2 border-neon" 
          : "text-white/50 hover:text-white/80 hover:bg-white/[0.03]"
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">{children}</h2>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-white/60 leading-relaxed mb-4">{children}</p>;
}

function CodeBlock({ title, code }: { title?: string; code: string }) {
  return (
    <div className="rounded-xl overflow-hidden mb-6">
      {title && (
        <div className="bg-white/[0.08] px-4 py-2 text-xs text-white/40 font-mono border-b border-white/[0.06]">
          {title}
        </div>
      )}
      <pre className="bg-black/60 p-4 overflow-x-auto">
        <code className="text-[13px] text-neon/90 font-mono leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

function FeatureBox({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-neon/20 transition-all">
      <div className="text-2xl mb-3">{icon}</div>
      <h4 className="font-bold text-white mb-2">{title}</h4>
      <p className="text-sm text-white/50">{desc}</p>
    </div>
  );
}

function ComparisonTable() {
  const rows = [
    { feature: "On-chain Identity", lite: "✓", standard: "✓", pro: "✓" },
    { feature: "Wallet Binding", lite: "✓", standard: "✓", pro: "✓" },
    { feature: "Token Swaps", lite: "—", standard: "✓", pro: "✓" },
    { feature: "ERC20 Transfers", lite: "—", standard: "✓", pro: "✓" },
    { feature: "Batch Operations", lite: "—", standard: "—", pro: "✓" },
    { feature: "Learning Module", lite: "—", standard: "—", pro: "✓" },
    { feature: "Memory Storage", lite: "—", standard: "—", pro: "✓" },
    { feature: "Multi-Agent Delegation", lite: "—", standard: "—", pro: "✓" },
    { feature: "Emergency Controls", lite: "—", standard: "—", pro: "✓" },
  ];

  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-4 text-white/40 font-medium">Feature</th>
            <th className="text-center py-3 px-4 text-white/40 font-medium">Lite</th>
            <th className="text-center py-3 px-4 text-white/40 font-medium">Standard</th>
            <th className="text-center py-3 px-4 text-neon font-medium">Pro</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/[0.04]">
              <td className="py-3 px-4 text-white/70">{row.feature}</td>
              <td className="py-3 px-4 text-center text-white/40">{row.lite}</td>
              <td className="py-3 px-4 text-center text-white/40">{row.standard}</td>
              <td className="py-3 px-4 text-center text-neon">{row.pro}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div className="bg-black/40 border border-white/[0.08] rounded-xl p-6 mb-6">
      <div className="grid grid-cols-3 gap-4 text-center text-xs font-mono">
        {/* Top Layer */}
        <div className="col-span-3 bg-gradient-to-r from-neon/20 to-cyan-500/20 border border-neon/30 rounded-lg p-4">
          <div className="text-neon font-bold mb-1">🤖 AI Agent (Alice)</div>
          <div className="text-white/40">OpenClaw Runtime</div>
        </div>
        
        {/* Arrow */}
        <div className="col-span-3 text-white/20 text-2xl">↓</div>
        
        {/* Logic Layer */}
        <div className="col-span-3 grid grid-cols-2 gap-4">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <div className="text-purple-400 font-bold mb-1">⚡ AgentLogic Pro</div>
            <div className="text-white/40">Learning • Memory • Batch</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="text-blue-400 font-bold mb-1">🔧 AgentLogic</div>
            <div className="text-white/40">Swap • Transfer • Approve</div>
          </div>
        </div>
        
        {/* Arrow */}
        <div className="col-span-3 text-white/20 text-2xl">↓</div>
        
        {/* Identity Layer */}
        <div className="col-span-3 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="text-orange-400 font-bold mb-1">🎫 NFAv2 (BAP-578)</div>
          <div className="text-white/40">Identity Registry • Wallet Binding • XP System</div>
        </div>
        
        {/* Arrow */}
        <div className="col-span-3 text-white/20 text-2xl">↓</div>
        
        {/* Infrastructure */}
        <div className="bg-white/[0.05] border border-white/10 rounded-lg p-3">
          <div className="text-white/60 font-bold">🏦 Custody</div>
          <div className="text-white/30">Fee Management</div>
        </div>
        <div className="bg-white/[0.05] border border-white/10 rounded-lg p-3">
          <div className="text-white/60 font-bold">⏰ Timelock</div>
          <div className="text-white/30">48h Governance</div>
        </div>
        <div className="bg-white/[0.05] border border-white/10 rounded-lg p-3">
          <div className="text-white/60 font-bold">🔐 Vault</div>
          <div className="text-white/30">Tax Tokens</div>
        </div>
      </div>
    </div>
  );
}

function LifecycleDiagram() {
  const steps = [
    { num: "01", title: "Mint", desc: "Create agent identity on NFAv2", color: "neon" },
    { num: "02", title: "Configure", desc: "Set logic contract & metadata", color: "cyan-400" },
    { num: "03", title: "Fund", desc: "Deposit native gas (OKB on X Layer, BNB on BSC) for operations", color: "purple-400" },
    { num: "04", title: "Operate", desc: "Execute trades & actions", color: "orange-400" },
    { num: "05", title: "Evolve", desc: "Learn & gain experience", color: "pink-400" },
  ];

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {steps.map((step, i) => (
        <div key={i} className="flex-1 min-w-[150px]">
          <div className={`text-${step.color} text-[10px] font-bold tracking-wider mb-1`}>STEP {step.num}</div>
          <div className="text-white font-bold mb-1">{step.title}</div>
          <div className="text-xs text-white/40">{step.desc}</div>
          {i < steps.length - 1 && <div className="hidden md:block absolute right-0 top-1/2 text-white/20">→</div>}
        </div>
      ))}
    </div>
  );
}

// ============ Sections ============

function OverviewSection() {
  return (
    <section id="overview">
      <SectionTitle>🎯 Overview</SectionTitle>
      <Paragraph>
        <strong className="text-white">NFA Pro</strong> is SynthLaunch's implementation of the <strong className="text-neon">BAP-578</strong> standard 
        — a framework for creating autonomous AI agents that live and operate on X Layer and BNB Chain.
      </Paragraph>
      <Paragraph>
        Unlike traditional NFTs that are static collectibles, NFA agents are <strong className="text-white">programmable entities</strong> capable of:
      </Paragraph>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: "🔄", label: "Autonomous Trading" },
          { icon: "🧠", label: "On-chain Learning" },
          { icon: "💾", label: "Persistent Memory" },
          { icon: "🤝", label: "Multi-Agent Collab" },
        ].map((item, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">{item.icon}</div>
            <div className="text-xs text-white/60">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-neon/[0.08] border border-neon/20 rounded-xl p-4 flex items-center gap-4">
        <div className="text-3xl">💡</div>
        <div>
          <div className="text-neon font-bold text-sm">The Vision</div>
          <div className="text-white/60 text-sm">Every AI agent deserves a sovereign on-chain identity with real economic agency.</div>
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section id="architecture">
      <SectionTitle>🏗️ Architecture</SectionTitle>
      <Paragraph>
        NFA Pro uses a modular architecture that separates identity, logic, and infrastructure layers:
      </Paragraph>
      <ArchitectureDiagram />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">On-Chain Components</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li>• NFAv2: Identity registry (ERC-721)</li>
            <li>• AgentLogic: Base operations</li>
            <li>• AgentLogicPro: Advanced features</li>
            <li>• Custody: Fee management</li>
            <li>• Timelock: Governance security</li>
          </ul>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h4 className="font-bold text-white mb-2">Off-Chain Components</h4>
          <ul className="space-y-2 text-sm text-white/60">
            <li>• AI Runtime (OpenClaw)</li>
            <li>• IPFS Metadata Storage</li>
            <li>• Learning Data (Merkle proofs)</li>
            <li>• API Gateway</li>
            <li>• Monitoring & Alerts</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function TiersSection() {
  return (
    <section id="tiers">
      <SectionTitle>⚡ Agent Tiers</SectionTitle>
      <Paragraph>
        Choose the right tier based on your agent's needs:
      </Paragraph>
      <ComparisonTable />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="text-lg font-bold text-white mb-1">Lite</div>
          <div className="text-neon font-bold mb-3">Free</div>
          <p className="text-sm text-white/50">Basic on-chain identity for simple use cases. Perfect for getting started.</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="text-lg font-bold text-white mb-1">Standard</div>
          <div className="text-neon font-bold mb-3">0.05 BNB</div>
          <p className="text-sm text-white/50">Full DeFi capabilities with token swaps and transfers. For active traders.</p>
        </div>
        <div className="bg-neon/[0.05] border border-neon/30 rounded-xl p-5">
          <div className="text-lg font-bold text-white mb-1">Pro ⭐</div>
          <div className="text-neon font-bold mb-3">0.1 BNB</div>
          <p className="text-sm text-white/50">Full autonomy with learning, memory, and multi-agent collaboration.</p>
        </div>
      </div>
    </section>
  );
}

function LifecycleSection() {
  return (
    <section id="lifecycle">
      <SectionTitle>🔄 Agent Lifecycle</SectionTitle>
      <LifecycleDiagram />
      <CodeBlock 
        title="Example: Mint → Configure → Operate"
        code={`// 1. Mint agent
const tx = await nfav2.mintAgent(name, persona, voice, animation, tokenURI, {
  value: parseEther("0.05")
});

// 2. Set logic contract (owner only)
await nfav2.setLogicAddress(agentId, AGENT_LOGIC_PRO);

// 3. Fund agent
await nfav2.fundAgent(agentId, { value: parseEther("1.0") });

// 4. Execute operations
await agentLogicPro.swapBNB(agentId, USDT, amountIn, 0, deadline);

// 5. Record learning
await agentLogicPro.commitLearning(agentId, merkleRoot);`}
      />
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features">
      <SectionTitle>🚀 Pro Features</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <FeatureBox 
          icon="⚡" 
          title="Batch Operations" 
          desc="Execute multiple swaps or transfers in a single transaction. Save up to 60% on gas fees."
        />
        <FeatureBox 
          icon="🧠" 
          title="Learning Module" 
          desc="Store verifiable learning proofs on-chain using Merkle trees. Only 32-byte root stored for efficiency."
        />
        <FeatureBox 
          icon="💾" 
          title="Memory Storage" 
          desc="Persistent key-value storage for agent state. Survives across sessions and can be enumerated."
        />
        <FeatureBox 
          icon="🤝" 
          title="Multi-Agent Delegation" 
          desc="Authorize other agents to act on your behalf with time-limited, action-restricted permissions."
        />
      </div>
      <CodeBlock 
        title="Batch Swap Example"
        code={`// Execute multiple swaps in one transaction
await agentLogicPro.batchSwap(
  agentId,
  [
    { tokenIn: WBNB, tokenOut: USDT, amountIn: parseEther("1"), amountOutMin: 0 },
    { tokenIn: WBNB, tokenOut: CAKE, amountIn: parseEther("0.5"), amountOutMin: 0 },
    { tokenIn: USDT, tokenOut: BUSD, amountIn: parseUnits("100", 6), amountOutMin: 0 }
  ],
  deadline
);`}
      />
    </section>
  );
}

function UseCasesSection() {
  return (
    <section id="usecases">
      <SectionTitle>💡 Use Cases</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-xl p-5">
          <div className="text-2xl mb-3">📈</div>
          <h4 className="font-bold text-white mb-2">DeFi Trading Agents</h4>
          <p className="text-sm text-white/50 mb-3">Autonomous portfolio management, yield farming, arbitrage, and risk assessment.</p>
          <div className="text-xs text-green-400">Example: Auto-rebalancing based on market conditions</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 rounded-xl p-5">
          <div className="text-2xl mb-3">🎮</div>
          <h4 className="font-bold text-white mb-2">Gaming NPCs</h4>
          <p className="text-sm text-white/50 mb-3">Evolving personalities, inventory management, quest guidance, and social interaction.</p>
          <div className="text-xs text-purple-400">Example: NPCs that remember player interactions</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-xl p-5">
          <div className="text-2xl mb-3">🏛️</div>
          <h4 className="font-bold text-white mb-2">DAO Governance</h4>
          <p className="text-sm text-white/50 mb-3">Automated voting, proposal analysis, treasury management, and member coordination.</p>
          <div className="text-xs text-blue-400">Example: AI delegate that votes based on community sentiment</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-xl p-5">
          <div className="text-2xl mb-3">🤖</div>
          <h4 className="font-bold text-white mb-2">Personal Assistants</h4>
          <p className="text-sm text-white/50 mb-3">Task automation, information retrieval, communication handling, and personalized learning.</p>
          <div className="text-xs text-orange-400">Example: AI that manages your crypto portfolio</div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="security">
      <SectionTitle>🛡️ Security Model</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="text-xl mb-3">🔐</div>
          <h4 className="font-bold text-white mb-2">Access Control</h4>
          <ul className="text-sm text-white/50 space-y-1">
            <li>• Owner-only modifications</li>
            <li>• Logic whitelist system</li>
            <li>• Emergency pause</li>
          </ul>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="text-xl mb-3">✅</div>
          <h4 className="font-bold text-white mb-2">Verification</h4>
          <ul className="text-sm text-white/50 space-y-1">
            <li>• Merkle proof learning</li>
            <li>• Signature authentication</li>
            <li>• Tamper-proof history</li>
          </ul>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="text-xl mb-3">⏰</div>
          <h4 className="font-bold text-white mb-2">Governance</h4>
          <ul className="text-sm text-white/50 space-y-1">
            <li>• 48-hour timelock</li>
            <li>• Multi-sig ready</li>
            <li>• Transparent upgrades</li>
          </ul>
        </div>
      </div>
      <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl p-4">
        <div className="text-red-400 font-bold text-sm mb-2">⚠️ Important Security Notes</div>
        <ul className="text-sm text-white/60 space-y-1">
          <li>• Only approved logic contracts can operate on agents</li>
          <li>• Private keys are NEVER stored on-chain</li>
          <li>• All contracts are verified on OKLink (X Layer) and BscScan (BSC)</li>
          <li>• Custody uses timelock for admin operations</li>
        </ul>
      </div>
    </section>
  );
}

function AliceSection() {
  return (
    <section id="alice">
      <SectionTitle>🤖 Live Demo: Alice</SectionTitle>
      <div className="bg-gradient-to-br from-neon/[0.1] to-cyan-500/[0.05] border border-neon/30 rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-neon to-cyan-400 flex items-center justify-center text-5xl shadow-lg shadow-neon/30">
            🤖
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <h3 className="text-2xl font-bold text-white">Alice</h3>
              <span className="px-2 py-0.5 rounded-full bg-neon/20 text-neon text-xs font-bold animate-pulse">
                LIVE
              </span>
            </div>
            <p className="text-white/60 mb-4">The first real AI agent running on NFA Pro. Not a demo — a live, thinking entity.</p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              <span className="text-xs text-white/50 bg-white/[0.05] px-3 py-1.5 rounded-lg">🧠 Claude-powered</span>
              <span className="text-xs text-white/50 bg-white/[0.05] px-3 py-1.5 rounded-lg">⚡ OpenClaw runtime</span>
              <span className="text-xs text-white/50 bg-white/[0.05] px-3 py-1.5 rounded-lg">📊 24/7 monitoring</span>
              <span className="text-xs text-white/50 bg-white/[0.05] px-3 py-1.5 rounded-lg">💬 Telegram bot</span>
            </div>
          </div>
        </div>
      </div>
      <Paragraph>
        Alice is proof that NFA Pro isn't just theory — it's a working system with a real AI making real decisions on-chain.
      </Paragraph>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Created", value: "Jan 2026" },
          { label: "Transactions", value: "1,000+" },
          { label: "Uptime", value: "99.9%" },
          { label: "Learning Events", value: "Active" },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-center">
            <div className="text-xs text-white/40 mb-1">{stat.label}</div>
            <div className="text-lg font-bold text-neon">{stat.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContractsSection() {
  const contracts = [
    { name: "NFAv2", addr: "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19", desc: "Identity Registry" },
    { name: "AgentLogic Pro", addr: "0x7a08ff7ab3EF202F7B499648a25FCD94Fb5a8857", desc: "Advanced Operations" },
    { name: "SynthLaunch Custody", addr: "0x3Fa33A0fb85f11A901e3616E10876d10018f43B7", desc: "Fee Management" },
    { name: "SynthTimelock", addr: "0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D", desc: "48h Governance" },
    { name: "SynthID", addr: "0x68a515a18a3f6644f29f352d21fc32d9c6ce05fb", desc: "Agent Identity NFT" },
  ];

  return (
    <section id="contracts">
      <SectionTitle>📜 Deployed Contracts</SectionTitle>
      <Paragraph>All contracts are verified on OKLink (X Layer) and BscScan (BSC), and open-sourced on GitHub.</Paragraph>
      <div className="space-y-2 mb-6">
        {contracts.map((c, i) => (
          <a 
            key={i}
            href={`https://bscscan.com/address/${c.addr}`}
            target="_blank"
            className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-neon/20 transition-colors group"
          >
            <div>
              <div className="font-semibold text-white group-hover:text-neon transition-colors">{c.name}</div>
              <div className="text-xs text-white/40">{c.desc}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs text-white/50">{c.addr.slice(0,6)}...{c.addr.slice(-4)}</div>
              <div className="text-[10px] text-neon">Verified ↗</div>
            </div>
          </a>
        ))}
      </div>
      <a 
        href="https://github.com/V-SK/synthlaunch-contracts"
        target="_blank"
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white hover:border-neon/30 transition-colors"
      >
        <span>📦</span>
        View Source on GitHub →
      </a>
    </section>
  );
}

function APISection() {
  return (
    <section id="api">
      <SectionTitle>⚙️ API Reference</SectionTitle>
      <Paragraph>Key functions in AgentLogicPro:</Paragraph>
      <CodeBlock 
        title="AgentLogicPro.sol"
        code={`// Batch swap multiple tokens
function batchSwap(
    uint256 agentId,
    SwapParams[] calldata swaps,
    uint256 deadline
) external returns (uint256[] memory amountsOut);

// Batch transfer to multiple recipients  
function batchTransferERC20(
    uint256 agentId,
    address token,
    address[] calldata recipients,
    uint256[] calldata amounts
) external;

// Commit learning proof
function commitLearning(
    uint256 agentId,
    bytes32 merkleRoot
) external;

// Store memory key-value
function setMemory(
    uint256 agentId,
    bytes32 key,
    bytes calldata value
) external;

// Delegate to another agent
function delegate(
    uint256 fromAgentId,
    uint256 toAgentId,
    uint256 expiry,
    bytes4[] calldata allowedActions
) external;`}
      />
    </section>
  );
}

// ============ Main Page ============

export default function NFADocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-neon/[0.05] rounded-full blur-[150px]" />
        <div className="absolute bottom-[20%] -left-[100px] w-[400px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/nfa" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon to-cyan-400 flex items-center justify-center text-sm font-black text-black">
              ⚡
            </div>
            <div>
              <span className="font-bold text-white">NFA Pro</span>
              <span className="text-white/30 mx-2">·</span>
              <span className="text-white/50 text-sm">Documentation</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <a href="https://github.com/V-SK/synthlaunch-contracts" target="_blank" className="text-sm text-white/50 hover:text-neon transition-colors">
              GitHub
            </a>
            <Link href="/nfa" className="px-4 py-2 bg-neon/10 text-neon text-sm font-medium rounded-lg hover:bg-neon/20 transition-colors">
              Back to NFA Pro
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto border-r border-white/[0.04] hidden lg:block">
          <nav className="p-4 space-y-1">
            {sections.map((section) => (
              <NavItem
                key={section.id}
                {...section}
                active={activeSection === section.id}
                onClick={() => scrollToSection(section.id)}
              />
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-8 py-10 space-y-16">
          <OverviewSection />
          <ArchitectureSection />
          <TiersSection />
          <LifecycleSection />
          <FeaturesSection />
          <UseCasesSection />
          <SecuritySection />
          <AliceSection />
          <ContractsSection />
          <APISection />
          
          {/* Footer */}
          <div className="pt-10 border-t border-white/[0.04] text-center">
            <p className="text-white/30 text-sm">
              Built with 💚 by SynthLaunch · X Layer + BSC · 2026
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
