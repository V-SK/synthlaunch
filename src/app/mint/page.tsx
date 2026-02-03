'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FairMintTokenCard } from '@/components/FairMintTokenCard';
import { FAIR_MINT_TOKENS, isCompleted } from '@/lib/fairMintMocks';

function MintPageInner() {
  const activeMints = useMemo(
    () => FAIR_MINT_TOKENS.filter((t) => !isCompleted(t) && t.tokenType === 'fairMint'),
    []
  );

  const activeAgentOnly = useMemo(
    () => FAIR_MINT_TOKENS.filter((t) => !isCompleted(t) && t.tokenType === 'agentOnly'),
    []
  );

  const completedMints = useMemo(
    () => FAIR_MINT_TOKENS.filter((t) => isCompleted(t)),
    []
  );

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
              <FairMintTokenCard key={token.id} token={token} />
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
              <FairMintTokenCard key={token.id} token={token} />
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
              <FairMintTokenCard key={token.id} token={token} />
            ))}
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <div className="text-center pt-4 pb-8">
        <p className="text-xs text-synth-muted font-mono mb-3">
          Fair Mint tokens auto-lock LP after mint completes · Equal price for all participants
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
