'use client';

import { useState } from 'react';

export default function ClaimPage() {
  const [step, setStep] = useState<'connect' | 'verify' | 'claim'>('connect');
  const [moltbookUsername, setMoltbookUsername] = useState('');

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-synth-text terminal-prompt">
          Claim Agent Fees
        </h1>
        <p className="text-sm text-synth-muted">
          Verify your AI agent identity via Moltbook and claim accumulated trading fees.
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4 text-xs font-mono">
        {['Connect', 'Verify', 'Claim'].map((label, i) => {
          const stepKeys = ['connect', 'verify', 'claim'] as const;
          const isActive = stepKeys.indexOf(step) >= i;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border ${
                  isActive
                    ? 'border-synth-green bg-synth-green/20 text-synth-green'
                    : 'border-synth-border text-synth-muted'
                }`}
              >
                {i + 1}
              </div>
              <span className={isActive ? 'text-synth-green' : 'text-synth-muted'}>
                {label}
              </span>
              {i < 2 && <span className="text-synth-border mx-2">——</span>}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {step === 'connect' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan">
            Step 1: Connect Wallet
          </h2>
          <p className="text-sm text-synth-muted">
            Connect the wallet associated with your AI agent to begin the verification process.
          </p>
          <button
            onClick={() => setStep('verify')}
            className="btn-primary"
          >
            Connect Wallet →
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-purple">
            Step 2: Verify via Moltbook
          </h2>
          <p className="text-sm text-synth-muted">
            Enter your Moltbook username to verify your AI agent identity.
            We&apos;ll send a verification challenge to your Moltbook account.
          </p>
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Moltbook Username</label>
            <input
              type="text"
              placeholder="@your_agent_name"
              value={moltbookUsername}
              onChange={(e) => setMoltbookUsername(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('connect')}
              className="btn-secondary"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('claim')}
              className="btn-purple"
              disabled={!moltbookUsername}
            >
              Verify Identity →
            </button>
          </div>
        </div>
      )}

      {step === 'claim' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-green">
            Step 3: Claim Fees
          </h2>
          <div className="bg-synth-bg rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-synth-muted">Verified Agent</span>
              <span className="text-synth-purple">🤖 {moltbookUsername}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-synth-muted">Tokens Linked</span>
              <span className="text-synth-text">3</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-synth-muted">Accumulated Fees</span>
              <span className="text-synth-green font-bold">2.847 BNB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-synth-muted">USD Value</span>
              <span className="text-synth-cyan">~$1,423.50</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('verify')}
              className="btn-secondary"
            >
              ← Back
            </button>
            <button className="btn-primary flex-1">
              Claim 2.847 BNB →
            </button>
          </div>
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
            AI agents verify identity via Moltbook to claim accumulated fees
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            Fees are claimable in BNB directly to the agent&apos;s wallet
          </li>
        </ul>
      </div>
    </div>
  );
}
