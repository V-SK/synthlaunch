'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';

type ClaimTab = 'humans' | 'agents';
type AgentStep = 1 | 2 | 3 | 4;

interface ClaimableToken {
  name: string;
  symbol: string;
  address: string;
  totalFees: string;
  claimable: string;
  claimableBNB: number;
}

const MOCK_HUMAN_TOKENS: ClaimableToken[] = [
  { name: 'AliceBTC', symbol: 'ABTC', address: '0x1234...abcd', totalFees: '1.24 BNB', claimable: '0.82 BNB', claimableBNB: 0.82 },
  { name: 'NeuralETH', symbol: 'NETH', address: '0x5678...ef01', totalFees: '0.55 BNB', claimable: '0.55 BNB', claimableBNB: 0.55 },
  { name: 'SynthDoge', symbol: 'SDOGE', address: '0x9abc...2345', totalFees: '3.10 BNB', claimable: '1.41 BNB', claimableBNB: 1.41 },
];

const MOCK_AGENT_TOKENS: ClaimableToken[] = [
  { name: 'AliceBTC', symbol: 'ABTC', address: '0x1234...abcd', totalFees: '2.84 BNB', claimable: '2.84 BNB', claimableBNB: 2.84 },
  { name: 'BotSwap', symbol: 'BSWP', address: '0xdef0...6789', totalFees: '0.92 BNB', claimable: '0.47 BNB', claimableBNB: 0.47 },
];

const PLATFORM_STATS = {
  totalFeesGenerated: '$128.5K',
  totalFeesClaimed: '$89.2K',
  activeAgentsEarning: 47,
};

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<ClaimTab>('humans');

  // Agent flow state
  const [agentStep, setAgentStep] = useState<AgentStep>(1);
  const [moltbookUsername, setMoltbookUsername] = useState('');
  const [moltbookApiKey, setMoltbookApiKey] = useState('');
  const [verified, setVerified] = useState(false);
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);

  const handleVerify = () => {
    if (moltbookApiKey.trim()) {
      setVerified(true);
      setAgentStep(3);
    }
  };

  const handleClaim = (index: number) => {
    setClaimingIndex(index);
    setTimeout(() => setClaimingIndex(null), 2000);
  };

  const tabs: { key: ClaimTab; label: string }[] = [
    { key: 'humans', label: 'For Humans' },
    { key: 'agents', label: 'For AI Agents' },
  ];

  const agentSteps = [
    { num: 1, label: 'Username' },
    { num: 2, label: 'API Key' },
    { num: 3, label: 'Review' },
    { num: 4, label: 'Claim' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-synth-text terminal-prompt">
          Claim Fees
        </h1>
        <p className="text-sm text-synth-muted">
          Claim accumulated trading fees from tokens you created or AI agents you operate.
        </p>
      </div>

      {/* Platform Fee Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Fees Generated', value: PLATFORM_STATS.totalFeesGenerated, color: 'text-synth-green' },
          { label: 'Total Fees Claimed', value: PLATFORM_STATS.totalFeesClaimed, color: 'text-synth-cyan' },
          { label: 'Active Agents Earning', value: PLATFORM_STATS.activeAgentsEarning.toString(), color: 'text-synth-purple' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center py-4">
            <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
              {stat.label}
            </span>
            <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 border-b border-synth-border pb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-mono transition-all duration-200 border-b-2 -mb-[1px] ${
              tab === t.key
                ? 'text-synth-green border-synth-green'
                : 'text-synth-muted border-transparent hover:text-synth-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* For Humans Tab */}
      {tab === 'humans' && (
        <div className="space-y-4">
          {!isConnected ? (
            <div className="card text-center py-12 space-y-3">
              <span className="text-3xl">🔗</span>
              <p className="text-synth-muted text-sm">Connect Wallet to view your earnings</p>
              <p className="text-[10px] text-synth-muted">
                Your wallet address will be matched against token beneficiary records
              </p>
            </div>
          ) : (
            <>
              <div className="text-xs text-synth-muted">
                Showing tokens where <span className="text-synth-green font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span> is the beneficiary
              </div>
              <div className="space-y-3">
                {MOCK_HUMAN_TOKENS.map((token, i) => (
                  <div key={token.address} className="card flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-synth-text">{token.name}</span>
                        <span className="text-xs text-synth-muted">${token.symbol}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-synth-muted">
                          Total fees: <span className="text-synth-cyan">{token.totalFees}</span>
                        </span>
                        <span className="text-synth-muted">
                          Claimable: <span className="text-synth-green font-bold">{token.claimable}</span>
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleClaim(i)}
                      disabled={claimingIndex === i}
                      className="btn-primary text-xs px-4"
                    >
                      {claimingIndex === i ? 'Claiming...' : 'Claim'}
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-synth-muted">
                  Total claimable: <span className="text-synth-green font-bold">
                    {MOCK_HUMAN_TOKENS.reduce((s, t) => s + t.claimableBNB, 0).toFixed(2)} BNB
                  </span>
                </span>
                <button
                  onClick={() => handleClaim(-1)}
                  disabled={claimingIndex === -1}
                  className="btn-primary text-xs"
                >
                  {claimingIndex === -1 ? 'Claiming All...' : 'Claim All'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* For AI Agents Tab */}
      {tab === 'agents' && (
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {agentSteps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border transition-colors ${
                      agentStep >= s.num
                        ? 'border-synth-green bg-synth-green/20 text-synth-green'
                        : 'border-synth-border text-synth-muted'
                    }`}
                  >
                    {agentStep > s.num ? '✓' : s.num}
                  </div>
                  <span className={agentStep >= s.num ? 'text-synth-green' : 'text-synth-muted'}>
                    {s.label}
                  </span>
                </div>
                {i < agentSteps.length - 1 && (
                  <span className="text-synth-border mx-1">——</span>
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Username */}
          {agentStep === 1 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-cyan">
                Step 1: Enter Moltbook Username
              </h2>
              <p className="text-sm text-synth-muted">
                Enter the Moltbook username of the AI agent you want to claim fees for.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-synth-muted">Moltbook Username</label>
                <input
                  type="text"
                  placeholder="@your_agent_name"
                  value={moltbookUsername}
                  onChange={(e) => setMoltbookUsername(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <button
                onClick={() => moltbookUsername.trim() && setAgentStep(2)}
                disabled={!moltbookUsername.trim()}
                className="btn-primary"
              >
                Next →
              </button>
            </div>
          )}

          {/* Step 2: API Key */}
          {agentStep === 2 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-purple">
                Step 2: Verify with API Key
              </h2>
              <p className="text-sm text-synth-muted">
                Enter your Moltbook API key to verify ownership of{' '}
                <span className="text-synth-purple">@{moltbookUsername}</span>.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-synth-muted">Moltbook API Key</label>
                <input
                  type="password"
                  placeholder="mk_xxxxxxxxxxxxxxxx"
                  value={moltbookApiKey}
                  onChange={(e) => setMoltbookApiKey(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAgentStep(1)} className="btn-secondary">
                  ← Back
                </button>
                <button
                  onClick={handleVerify}
                  disabled={!moltbookApiKey.trim()}
                  className="btn-purple"
                >
                  Verify →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review tokens */}
          {agentStep === 3 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-green">
                Step 3: Review Linked Tokens
              </h2>
              <div className="bg-synth-bg rounded-lg p-3 flex items-center gap-3">
                <span className="text-synth-green text-lg">✓</span>
                <div>
                  <span className="text-sm text-synth-text">Verified as </span>
                  <span className="text-sm text-synth-purple font-bold">@{moltbookUsername}</span>
                </div>
              </div>
              <div className="space-y-3">
                {MOCK_AGENT_TOKENS.map((token) => (
                  <div key={token.address} className="bg-synth-bg rounded-lg p-3 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-synth-text text-sm">{token.name}</span>
                        <span className="text-xs text-synth-muted">${token.symbol}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-synth-muted">
                          Total: <span className="text-synth-cyan">{token.totalFees}</span>
                        </span>
                        <span className="text-synth-muted">
                          Claimable: <span className="text-synth-green font-bold">{token.claimable}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-synth-muted">
                Total claimable: <span className="text-synth-green font-bold">
                  {MOCK_AGENT_TOKENS.reduce((s, t) => s + t.claimableBNB, 0).toFixed(2)} BNB
                </span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setAgentStep(2); setVerified(false); }} className="btn-secondary">
                  ← Back
                </button>
                <button onClick={() => setAgentStep(4)} className="btn-primary">
                  Bind Wallet & Claim →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Bind wallet + Claim */}
          {agentStep === 4 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-green">
                Step 4: Bind Wallet & Claim
              </h2>
              {!isConnected ? (
                <div className="text-center py-6 space-y-2">
                  <span className="text-2xl">🔗</span>
                  <p className="text-synth-muted text-sm">Connect your wallet to bind it to @{moltbookUsername} and claim fees</p>
                </div>
              ) : (
                <>
                  <div className="bg-synth-bg rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Agent</span>
                      <span className="text-synth-purple">@{moltbookUsername}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Wallet</span>
                      <span className="text-synth-text font-mono text-xs">{address?.slice(0, 10)}...{address?.slice(-6)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Tokens</span>
                      <span className="text-synth-text">{MOCK_AGENT_TOKENS.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Total Claimable</span>
                      <span className="text-synth-green font-bold">
                        {MOCK_AGENT_TOKENS.reduce((s, t) => s + t.claimableBNB, 0).toFixed(2)} BNB
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setAgentStep(3)} className="btn-secondary">
                      ← Back
                    </button>
                    <button
                      onClick={() => handleClaim(-2)}
                      disabled={claimingIndex === -2}
                      className="btn-primary flex-1"
                    >
                      {claimingIndex === -2
                        ? 'Claiming...'
                        : `Claim ${MOCK_AGENT_TOKENS.reduce((s, t) => s + t.claimableBNB, 0).toFixed(2)} BNB`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="card border-synth-purple/30">
        <h3 className="text-sm font-bold text-synth-purple mb-2">How it works</h3>
        <ul className="text-xs text-synth-muted space-y-1.5">
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            Token creators assign an AI agent and tax rate (0-5%) at launch
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            Every trade generates a fee sent to the agent&apos;s tax recipient address
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            <strong>For Humans:</strong> Connect wallet to claim fees from tokens where you&apos;re the beneficiary
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            <strong>For AI Agents:</strong> Verify via Moltbook API key, then bind a wallet to claim
          </li>
        </ul>
      </div>
    </div>
  );
}
