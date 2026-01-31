'use client';

import { useState } from 'react';
import { TaxRateSlider } from '@/components/TaxRateSlider';
import { AgentSelector } from '@/components/AgentSelector';
import { WalletConnect } from '@/components/WalletConnect';
import { useAccount } from 'wagmi';

export default function LaunchPage() {
  const { isConnected } = useAccount();
  const [form, setForm] = useState({
    name: '',
    symbol: '',
    description: '',
    image: null as File | null,
    website: '',
    twitter: '',
    telegram: '',
    taxRate: 2,
    agentId: '',
    devBuyAmount: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with Flap contract
    console.log('Launch token:', form);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-synth-text terminal-prompt">
          Launch Token
        </h1>
        <p className="text-sm text-synth-muted">
          Create a new token on BSC with AI agent tax routing via Flap Protocol.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Info */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            Token Information
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Token Name</label>
              <input
                type="text"
                placeholder="Neural Net Token"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Symbol</label>
              <input
                type="text"
                placeholder="NNT"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                className="input-field w-full"
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Description</label>
            <textarea
              placeholder="Describe your token..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field w-full h-24 resize-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Token Image</label>
            <div className="border border-dashed border-synth-border rounded-lg p-6 text-center hover:border-synth-green/30 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <span className="text-synth-muted text-sm">
                  {form.image ? form.image.name : 'Click to upload image'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            Social Links
          </h2>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Website</label>
              <input
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Twitter</label>
              <input
                type="text"
                placeholder="@handle"
                value={form.twitter}
                onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Telegram</label>
              <input
                type="text"
                placeholder="t.me/group"
                value={form.telegram}
                onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>
        </div>

        {/* AI Agent Config */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-purple uppercase tracking-wider">
            AI Agent Configuration
          </h2>

          <AgentSelector
            value={form.agentId}
            onChange={(agentId) => setForm({ ...form, agentId })}
          />

          <TaxRateSlider
            value={form.taxRate}
            onChange={(taxRate) => setForm({ ...form, taxRate })}
          />
        </div>

        {/* Dev Buy */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            Initial Buy (Optional)
          </h2>
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Dev Buy Amount (BNB)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.0"
              value={form.devBuyAmount}
              onChange={(e) => setForm({ ...form, devBuyAmount: e.target.value })}
              className="input-field w-full"
            />
            <p className="text-[10px] text-synth-muted">
              Amount of BNB to buy tokens with at launch. This creates initial liquidity.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col items-center gap-4">
          {isConnected ? (
            <button type="submit" className="btn-primary w-full py-3 text-base">
              🚀 Launch Token
            </button>
          ) : (
            <div className="w-full text-center space-y-3">
              <p className="text-sm text-synth-muted">Connect wallet to launch</p>
              <WalletConnect />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
