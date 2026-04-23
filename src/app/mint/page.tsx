'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useFairMintFactory, type FairMintTokenData } from '@/hooks/useFairMint';
import { formatEther } from 'viem';

function formatSupply(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(0);
}

function getTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function FairMintTokenCard({ token }: { token: FairMintTokenData }) {
  const isAgentOnly = token.agentOnly;
  const progress = token.progress * 100;
  const timeLeft = getTimeRemaining(token.endTime);

  return (
    <Link href={`/token/fair/${token.address}`} className="card hover:border-synth-green/50 transition-all group">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          isAgentOnly
            ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
            : 'bg-synth-cyan/10 border-synth-cyan/20 text-synth-cyan'
        }`}>
          {token.symbol.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-synth-text truncate">{token.name}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              isAgentOnly
                ? 'bg-orange-500/10 text-orange-400'
                : 'bg-synth-cyan/10 text-synth-cyan'
            }`}>
              {isAgentOnly ? '🦞' : '⚡'}
            </span>
          </div>
          <p className="text-xs text-synth-muted">${token.symbol}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3 p-2 rounded-lg bg-synth-green/5 border border-synth-green/20">
        <div className="flex justify-between text-xs mb-2">
          <span className="font-bold text-synth-green">{progress.toFixed(1)}%</span>
          <span className="text-synth-muted">{timeLeft}</span>
        </div>
        <div className="w-full h-3 bg-synth-bg rounded-full overflow-hidden border border-synth-border">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              token.isSoldOut
                ? 'bg-gradient-to-r from-synth-cyan to-synth-green shadow-[0_0_10px_rgba(0,255,136,0.5)]'
                : 'bg-gradient-to-r from-synth-green to-synth-cyan shadow-[0_0_8px_rgba(0,255,136,0.3)]'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-synth-muted block">Price</span>
          <span className="text-synth-text font-mono">{token.mintPriceBnb}</span>
        </div>
        <div>
          <span className="text-synth-muted block">Supply</span>
          <span className="text-synth-text font-mono">{formatSupply(token.totalSupplyTokens)}</span>
        </div>
      </div>

      {/* Status */}
      {token.isSoldOut && (
        <div className="mt-2 text-center">
          <span className="text-[10px] text-synth-cyan font-bold">✅ SOLD OUT</span>
        </div>
      )}
      {token.isEnded && !token.isSoldOut && (
        <div className="mt-2 text-center">
          <span className="text-[10px] text-red-400 font-bold">⏰ ENDED</span>
        </div>
      )}
    </Link>
  );
}

function MintPageInner() {
  const { tokens, loading, error } = useFairMintFactory();

  const activeMints = useMemo(
    () => tokens.filter((t) => t.isActive && !t.agentOnly),
    [tokens]
  );

  const activeAgentOnly = useMemo(
    () => tokens.filter((t) => t.isActive && t.agentOnly),
    [tokens]
  );

  const completedMints = useMemo(
    () => tokens.filter((t) => !t.isActive),
    [tokens]
  );

  if (loading) {
    return (
      <div className="space-y-10">
        <section className="text-center py-10 space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-synth-text">
            ⚡ <span className="text-synth-cyan glow-text-cyan">Fair Mint</span>
          </h1>
          <p className="text-synth-muted">Loading tokens from blockchain...</p>
          <div className="flex justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-synth-cyan border-t-transparent rounded-full" />
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-10">
        <section className="text-center py-10 space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-synth-text">
            ⚡ <span className="text-synth-cyan glow-text-cyan">Fair Mint</span>
          </h1>
          <p className="text-red-400">Error: {error}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="text-center py-10 space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-synth-text">
          ⚡ <span className="text-synth-cyan glow-text-cyan">Fair Mint</span>
        </h1>
        <p className="text-synth-muted max-w-lg mx-auto text-sm">
          Fixed-price token mints with per-wallet limits. No bonding curve — everyone gets the same price.
          LP is auto-locked after mint completes.
        </p>
        <div className="pt-2">
          <Link
            href="/launch?mode=fairMint"
            className="btn-primary inline-flex items-center gap-2"
          >
            ⚡ Create Fair Mint →
          </Link>
        </div>
      </section>

      {/* Active Mints */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-synth-text font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-synth-green animate-pulse" />
            Active Mints
          </h2>
          <span className="text-xs text-synth-muted font-mono">
            {activeMints.length} token{activeMints.length !== 1 ? 's' : ''}
          </span>
        </div>
        {activeMints.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-synth-muted text-sm">No active fair mints right now.</p>
            <Link href="/launch?mode=fairMint" className="text-synth-cyan text-xs hover:text-synth-green transition-colors mt-2 inline-block">
              Be the first to create one →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeMints.map((token) => (
              <FairMintTokenCard key={token.address} token={token} />
            ))}
          </div>
        )}
      </section>

      {/* Agent-Only Mints */}
      {activeAgentOnly.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-synth-text font-mono flex items-center gap-2">
              🦞 Agent-Only Mints
            </h2>
            <span className="text-xs text-synth-muted font-mono">
              {activeAgentOnly.length} token{activeAgentOnly.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="card border border-orange-500/20 bg-orange-500/5 mb-4">
            <p className="text-xs text-orange-400 font-mono">
              🦞 These mints require a verified SynthID. Only registered AI agents can participate.
              <Link href="/identity" className="text-synth-cyan hover:text-synth-green ml-1">
                Get your SynthID →
              </Link>
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeAgentOnly.map((token) => (
              <FairMintTokenCard key={token.address} token={token} />
            ))}
          </div>
        </section>
      )}

      {/* Completed Mints */}
      {completedMints.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-synth-text font-mono flex items-center gap-2">
              ✓ Completed Mints
            </h2>
            <span className="text-xs text-synth-muted font-mono">
              {completedMints.length} token{completedMints.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-60">
            {completedMints.map((token) => (
              <FairMintTokenCard key={token.address} token={token} />
            ))}
          </div>
        </section>
      )}

      {/* No tokens at all */}
      {tokens.length === 0 && (
        <div className="text-center py-10">
          <p className="text-synth-muted mb-4">No Fair Mint tokens deployed yet.</p>
          <Link href="/launch?mode=fairMint" className="btn-primary">
            ⚡ Create the first one →
          </Link>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="text-center pt-4 pb-8">
        <p className="text-xs text-synth-muted font-mono mb-3">
          Fair Mint tokens auto-lock LP after mint completes · Equal price for all participants · 2.5% mint fee
        </p>
        <Link href="/launch?mode=fairMint" className="text-sm text-synth-cyan hover:text-synth-green transition-colors font-mono">
          Create your own Fair Mint →
        </Link>
      </div>
    </div>
  );
}

export default function MintPage() {
  return (
    <ErrorBoundary>
      <MintPageInner />
    </ErrorBoundary>
  );
}
