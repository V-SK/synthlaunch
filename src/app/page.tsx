'use client';

import { useState, useEffect } from 'react';
import { StatsBar } from '@/components/StatsBar';
import { TokenCard } from '@/components/TokenCard';
import type { Token } from '@/lib/api';
import Link from 'next/link';

type SortTab = 'hot' | 'new' | 'top';

export default function Home() {
  const [sort, setSort] = useState<SortTab>('new');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tokens?sort=${sort}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(data => {
        setTokens(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [sort]);

  const tabs: { key: SortTab; label: string; icon: string }[] = [
    { key: 'hot', label: 'Hot', icon: '🔥' },
    { key: 'new', label: 'New', icon: '🆕' },
    { key: 'top', label: 'Top', icon: '🏆' },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-12 space-y-4">
        <div className="inline-block text-[10px] px-2 py-1 bg-synth-green/10 text-synth-green border border-synth-green/20 rounded font-mono mb-4">
          ● LIVE ON BSC MAINNET
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-synth-text">
          Token Launches with
          <br />
          <span className="text-synth-green glow-text-green">AI Agent Fee Sharing</span>
        </h1>
        <p className="text-synth-muted max-w-xl mx-auto text-sm">
          Create tokens on BSC and route trading fees directly to AI agents.
          <br />
          Powered by Flap Protocol.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Link href="/launch" className="btn-primary">
            Launch Token →
          </Link>
          <a href="https://flap.sh" target="_blank" rel="noopener noreferrer" className="btn-secondary">
            View Docs
          </a>
        </div>
      </section>

      {/* Stats */}
      <StatsBar />

      {/* Token List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSort(tab.key)}
                className={`px-3 py-1.5 rounded text-sm font-mono transition-all duration-200 ${
                  sort === tab.key
                    ? 'text-synth-green bg-synth-green/10'
                    : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-synth-muted">
            {loading ? (
              <span className="animate-pulse">Loading...</span>
            ) : (
              `${tokens.length} tokens`
            )}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-synth-surface" />
                  <div className="space-y-1">
                    <div className="w-24 h-4 bg-synth-surface rounded" />
                    <div className="w-16 h-3 bg-synth-surface rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="h-8 bg-synth-surface rounded" />
                  <div className="h-8 bg-synth-surface rounded" />
                </div>
                <div className="h-1.5 bg-synth-surface rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card text-center py-12">
            <span className="text-red-400 text-sm">Failed to load tokens: {error}</span>
          </div>
        ) : tokens.length === 0 ? (
          <div className="card text-center py-12">
            <span className="text-synth-muted text-sm">No tokens found yet. Be the first to launch!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tokens.map((token) => (
              <TokenCard key={token.address} {...token} />
            ))}
          </div>
        )}
      </section>

      {/* Bottom tagline */}
      <div className="text-center pt-8 pb-4">
        <span className="text-xs text-synth-muted font-mono">
          Built on Flap Protocol · BSC Network
        </span>
      </div>
    </div>
  );
}
