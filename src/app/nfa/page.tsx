"use client";

import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { useNFA } from "@/hooks/useNFA";
import { calculateLevel, calculateXPProgress, type NFAgent } from "@/lib/nfa";
import { WalletConnect } from "@/components/WalletConnect";
import { useI18n } from "@/lib/i18n";

// ============ Components ============

function StatCard({ label, value, accent = "text-neon" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex-1 min-w-[140px]">
      <div className="text-[11px] tracking-[2px] text-white/40 uppercase mb-2 font-mono">{label}</div>
      <div className={`text-[28px] font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function AgentCard({ agent, selected, onClick, t }: { agent: NFAgent; selected: boolean; onClick: () => void; t: (key: string) => string }) {
  const level = calculateLevel(agent.experience);
  const xpProgress = calculateXPProgress(agent.experience);
  const balanceFormatted = formatEther(agent.balance);
  
  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl p-6 cursor-pointer transition-all duration-300
        ${selected 
          ? "bg-neon/[0.06] border border-neon/30 scale-[1.01]" 
          : "bg-white/[0.02] border border-white/[0.06] hover:border-white/10"
        }
      `}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-xl font-bold text-white">{agent.name}</span>
            <span className={`
              text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-md
              ${agent.active 
                ? "bg-neon/15 text-neon" 
                : "bg-red-500/15 text-red-400"
              }
            `}>
              {agent.active ? t('nfa.card.active') : t('nfa.card.paused')}
            </span>
          </div>
          <div className="text-[13px] text-white/45 font-mono">NFA #{agent.id}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-neon">{balanceFormatted} BNB</div>
          <div className="text-[11px] text-white/35">{t('nfa.card.balance')}</div>
        </div>
      </div>
      
      <div className="text-[13px] text-white/55 mb-4 line-clamp-2">
        {agent.persona || "No persona set"}
      </div>
      
      {/* XP Bar */}
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] text-white/40 font-mono">{t('nfa.card.level')} {level.toString()}</span>
          <span className="text-[11px] text-white/40 font-mono">{agent.experience.toString()} {t('nfa.card.xp')}</span>
        </div>
        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-neon to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-5 py-2.5 rounded-xl text-[13px] font-semibold tracking-wide transition-all
        ${active 
          ? "bg-neon/15 text-neon" 
          : "text-white/40 hover:text-white/60"
        }
      `}
    >
      {label}
    </button>
  );
}

function InputField({ 
  label, value, onChange, placeholder, type = "text", mono = false 
}: { 
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; mono?: boolean 
}) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] tracking-[1.5px] text-white/40 uppercase mb-2 font-mono">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`
          w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03]
          text-white text-sm outline-none transition-colors
          focus:border-neon/30 placeholder:text-white/25
          ${mono ? "font-mono" : ""}
        `}
      />
    </div>
  );
}

function ActionButton({ 
  label, onClick, variant = "primary", disabled = false, icon, loading = false 
}: { 
  label: string; onClick: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; icon?: string; loading?: boolean 
}) {
  const variants = {
    primary: "bg-gradient-to-r from-neon to-emerald-400 text-black",
    secondary: "bg-white/[0.06] text-white border border-white/10",
    danger: "bg-red-500/15 text-red-400 border border-red-500/20",
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        px-6 py-3 rounded-xl text-sm font-bold tracking-wide transition-all
        flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]}
      `}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="text-base">{icon}</span>
      ) : null}
      {label}
    </button>
  );
}

// ============ Panels ============

function MintPanel({ onMint, loading, mintPrice, t }: { onMint: (data: any) => void; loading: boolean; mintPrice: string; t: (key: string, params?: Record<string, string>) => string }) {
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [voice, setVoice] = useState("");
  const [animation, setAnimation] = useState("");
  const [logic, setLogic] = useState("");
  const [tokenURI, setTokenURI] = useState("");

  const handleMint = () => {
    if (!name || !persona) return;
    onMint({ name, persona, voice, animation, logic, tokenURI });
  };

  return (
    <div className="max-w-[520px]">
      <h3 className="text-lg font-bold text-white mb-1">{t('nfa.mint.title')}</h3>
      <p className="text-[13px] text-white/40 mb-6 leading-relaxed">
        {t('nfa.mint.desc', { price: mintPrice || "0.05" })}
      </p>
      
      <InputField label={`${t('nfa.mint.name')} *`} value={name} onChange={setName} placeholder={t('nfa.mint.namePlaceholder')} />
      <InputField label={`${t('nfa.mint.persona')} *`} value={persona} onChange={setPersona} placeholder={t('nfa.mint.personaPlaceholder')} mono />
      <InputField label={t('nfa.mint.voice')} value={voice} onChange={setVoice} placeholder={t('nfa.mint.voicePlaceholder')} mono />
      <InputField label={t('nfa.mint.animation')} value={animation} onChange={setAnimation} placeholder={t('nfa.mint.animationPlaceholder')} mono />
      <InputField label={t('nfa.mint.logic')} value={logic} onChange={setLogic} placeholder={t('nfa.mint.logicPlaceholder')} mono />
      <InputField label={t('nfa.mint.tokenUri')} value={tokenURI} onChange={setTokenURI} placeholder={t('nfa.mint.tokenUriPlaceholder')} mono />
      
      <div className="flex gap-3 mt-2">
        <ActionButton 
          label={loading ? t('nfa.mint.minting') : t('nfa.mint.submit')} 
          onClick={handleMint} 
          icon="⚡" 
          disabled={!name || !persona}
          loading={loading}
        />
      </div>
    </div>
  );
}

function DetailPanel({ 
  agent, onFund, onWithdraw, onEvolve, onToggleActive, loading, t 
}: { 
  agent: NFAgent | null; 
  onFund: (id: number, amount: string) => void;
  onWithdraw: (id: number, amount: string) => void;
  onEvolve: (id: number, xp: number) => void;
  onToggleActive: (id: number) => void;
  loading: boolean;
  t: (key: string) => string;
}) {
  const [fundAmount, setFundAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [xpAmount, setXpAmount] = useState("");

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-[300px] text-white/25 text-sm">
        {t('nfa.detail.selectAgent')}
      </div>
    );
  }

  const level = calculateLevel(agent.experience);
  const createdDate = new Date(Number(agent.createdAt) * 1000).toLocaleDateString();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-[22px] font-bold text-white">{agent.name}</h3>
          <span className="text-xs text-white/35 font-mono">
            NFA #{agent.id} · {t('nfa.card.level')} {level.toString()} · {createdDate}
          </span>
        </div>
        <ActionButton
          label={agent.active ? t('nfa.detail.pause') : t('nfa.detail.activate')}
          onClick={() => onToggleActive(agent.id)}
          variant={agent.active ? "danger" : "primary"}
          icon={agent.active ? "⏸" : "▶"}
          loading={loading}
        />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6 bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
        {[
          { k: t('nfa.detail.persona'), v: agent.persona || "—" },
          { k: t('nfa.detail.logic'), v: agent.logic === "0x0000000000000000000000000000000000000000" ? t('nfa.detail.none') : `${agent.logic.slice(0,6)}...${agent.logic.slice(-4)}` },
          { k: t('nfa.detail.voice'), v: agent.voice || "—" },
          { k: t('nfa.detail.animation'), v: agent.animation || "—" },
        ].map((item, i) => (
          <div key={i}>
            <div className="text-[10px] tracking-[1.5px] text-white/30 uppercase mb-1 font-mono">{item.k}</div>
            <div className="text-[13px] text-white/70 font-mono break-all">{item.v}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-3">
        {/* Fund */}
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
          <div className="text-[11px] tracking-[1.5px] text-white/35 uppercase mb-2.5 font-mono">{t('nfa.detail.fund')}</div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={fundAmount}
              onChange={e => setFundAmount(e.target.value)}
              placeholder="BNB"
              className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-white/[0.08] bg-black/30 text-white text-[13px] outline-none font-mono"
            />
            <button
              onClick={() => { onFund(agent.id, fundAmount); setFundAmount(""); }}
              disabled={!fundAmount || loading}
              className={`px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                fundAmount ? "bg-neon text-black" : "bg-white/[0.06] text-white/30"
              } disabled:cursor-not-allowed`}
            >+</button>
          </div>
        </div>

        {/* Withdraw */}
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
          <div className="text-[11px] tracking-[1.5px] text-white/35 uppercase mb-2.5 font-mono">{t('nfa.detail.withdraw')}</div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="BNB"
              className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-white/[0.08] bg-black/30 text-white text-[13px] outline-none font-mono"
            />
            <button
              onClick={() => { onWithdraw(agent.id, withdrawAmount); setWithdrawAmount(""); }}
              disabled={!withdrawAmount || loading}
              className={`px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                withdrawAmount ? "bg-red-500/20 text-red-400" : "bg-white/[0.06] text-white/30"
              } disabled:cursor-not-allowed`}
            >−</button>
          </div>
        </div>

        {/* Evolve */}
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
          <div className="text-[11px] tracking-[1.5px] text-white/35 uppercase mb-2.5 font-mono">{t('nfa.detail.evolve')}</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={xpAmount}
              onChange={e => setXpAmount(e.target.value)}
              placeholder="XP"
              className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-white/[0.08] bg-black/30 text-white text-[13px] outline-none font-mono"
            />
            <button
              onClick={() => { onEvolve(agent.id, parseInt(xpAmount)); setXpAmount(""); }}
              disabled={!xpAmount || loading}
              className={`px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                xpAmount ? "bg-cyan-500/20 text-cyan-400" : "bg-white/[0.06] text-white/30"
              } disabled:cursor-not-allowed`}
            >↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function NFADashboard() {
  const { t } = useI18n();
  const {
    loading, error, agents, stats, isConnected, address,
    mintAgent, fundAgent, withdrawFromAgent, evolveAgent, toggleActive,
    mintPriceFormatted, clearError,
  } = useNFA();

  const [tab, setTab] = useState<"agents" | "mint">("agents");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null;
  const totalBalance = formatEther(agents.reduce((s, a) => s + a.balance, 0n));
  const totalXP = agents.reduce((s, a) => s + a.experience, 0n);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (error) {
      showToast(error, "error");
      clearError();
    }
  }, [error, clearError]);

  const handleMint = async (data: any) => {
    const result = await mintAgent(data);
    if (result) {
      showToast(t('nfa.toast.minted', { name: data.name }));
      setTab("agents");
    }
  };

  const handleFund = async (id: number, amount: string) => {
    const success = await fundAgent(id, amount);
    if (success) showToast(t('nfa.toast.funded', { amount, id: id.toString() }));
  };

  const handleWithdraw = async (id: number, amount: string) => {
    const success = await withdrawFromAgent(id, amount);
    if (success) showToast(t('nfa.toast.withdrew', { amount, id: id.toString() }));
  };

  const handleEvolve = async (id: number, xp: number) => {
    const success = await evolveAgent(id, xp);
    if (success) showToast(t('nfa.toast.evolved', { xp: xp.toString(), id: id.toString() }));
  };

  const handleToggleActive = async (id: number) => {
    const agent = agents.find(a => a.id === id);
    if (agent) {
      await toggleActive(id, !agent.active);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute -top-[100px] -right-[100px] w-[400px] h-[400px] bg-neon/[0.08] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] -left-[80px] w-[300px] h-[300px] bg-cyan-500/[0.06] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[250px] h-[250px] bg-purple-500/[0.04] rounded-full blur-[100px] pointer-events-none" />
      
      {/* Grid Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Toast */}
      {toast && (
        <div className={`
          fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-[13px] font-semibold
          animate-[slideIn_0.3s_ease]
          ${toast.type === "success" 
            ? "bg-neon/15 border border-neon/30 text-neon" 
            : "bg-red-500/15 border border-red-500/30 text-red-400"
          }
        `}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 px-8 py-5 flex justify-between items-center border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon to-cyan-400 flex items-center justify-center text-lg font-black text-black">
            N
          </div>
          <div>
            <div className="text-base font-bold tracking-wide">{t('nfa.title')}</div>
            <div className="text-[10px] text-white/30 tracking-[1.5px] font-mono">{t('nfa.subtitle')}</div>
          </div>
        </div>
        
        <WalletConnect />
      </header>

      {/* Main */}
      <main className="relative z-10 p-8 max-w-[1200px] mx-auto">
        {/* Stats */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <StatCard label={t('nfa.stats.totalAgents')} value={agents.length} />
          <StatCard label={t('nfa.stats.totalBalance')} value={`${totalBalance} BNB`} accent="text-cyan-400" />
          <StatCard label={t('nfa.stats.totalXp')} value={totalXP.toString()} accent="text-purple-400" />
          <StatCard label={t('nfa.stats.active')} value={agents.filter(a => a.active).length} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/[0.02] rounded-xl p-1 border border-white/[0.04] w-fit">
          <TabButton label={t('nfa.tabs.myAgents')} active={tab === "agents"} onClick={() => setTab("agents")} />
          <TabButton label={t('nfa.tabs.mintNew')} active={tab === "mint"} onClick={() => setTab("mint")} />
        </div>

        {/* Content */}
        {tab === "mint" ? (
          <MintPanel onMint={handleMint} loading={loading} mintPrice={mintPriceFormatted || "0.05"} t={t} />
        ) : (
          <div className="grid grid-cols-[380px_1fr] gap-6">
            {/* Agent List */}
            <div className="flex flex-col gap-3">
              {loading && agents.length === 0 ? (
                <div className="text-center py-10 text-white/25">Loading...</div>
              ) : agents.length === 0 ? (
                <div className="text-center p-10 text-white/25 bg-white/[0.02] rounded-2xl border border-dashed border-white/[0.08]">
                  <div className="text-3xl mb-2">🦞</div>
                  <div className="text-sm">{t('nfa.empty.title')}</div>
                  <div className="text-xs mt-1">{t('nfa.empty.desc')}</div>
                </div>
              ) : (
                agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    selected={selectedAgentId === agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    t={t}
                  />
                ))
              )}
            </div>

            {/* Detail Panel */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7">
              <DetailPanel
                agent={selectedAgent}
                onFund={handleFund}
                onWithdraw={handleWithdraw}
                onEvolve={handleEvolve}
                onToggleActive={handleToggleActive}
                loading={loading}
                t={t}
              />
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
