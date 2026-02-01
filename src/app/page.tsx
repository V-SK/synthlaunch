'use client';

import { useState, useEffect, useMemo } from 'react';
import { StatsBar } from '@/components/StatsBar';
import { TokenCard } from '@/components/TokenCard';
import { Pagination } from '@/components/Pagination';
import type { Token } from '@/lib/api';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

const TOKENS_PER_PAGE = 12;

type SortTab = 'hot' | 'new' | 'top';

export default function Home() {
  const { t } = useI18n();
  const [sort, setSort] = useState<SortTab>('new');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tokens?sort=${sort}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(data => {
        setTokens(data);
        setCurrentPage(1); // reset page on sort change
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [sort]);

  const tabs: { key: SortTab; label: string; icon: string }[] = [
    { key: 'hot', label: t('home.sortHot'), icon: '🔥' },
    { key: 'new', label: t('home.sortNew'), icon: '🆕' },
    { key: 'top', label: t('home.sortTop'), icon: '🏆' },
  ];

  const totalPages = Math.ceil(tokens.length / TOKENS_PER_PAGE);
  const paginatedTokens = useMemo(() => {
    const start = (currentPage - 1) * TOKENS_PER_PAGE;
    return tokens.slice(start, start + TOKENS_PER_PAGE);
  }, [tokens, currentPage]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-12 space-y-4">
        <div className="inline-block text-[10px] px-2 py-1 bg-synth-green/10 text-synth-green border border-synth-green/20 rounded font-mono mb-4">
          ● {t('home.liveOnBsc')}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-synth-text">
          {t('home.heroTitle')}
          <br />
          <span className="text-synth-green glow-text-green">{t('home.subtitle')}</span>
        </h1>
        <p className="text-synth-muted max-w-xl mx-auto text-sm">
          {t('home.heroDesc')}
          <br />
          {t('home.heroPowered')}
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Link href="/launch" className="btn-primary">
            {t('launch.launchToken')} →
          </Link>
          <a href="/docs" className="btn-secondary">
            {t('home.viewDocs')}
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
              <span className="animate-pulse">{t('common.loading')}</span>
            ) : (
              t('home.tokenCount', { count: String(tokens.length) })
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
            <span className="text-red-400 text-sm">{t('home.failedToLoad', { error })}</span>
          </div>
        ) : tokens.length === 0 ? (
          <div className="card text-center py-12">
            <span className="text-synth-muted text-sm">{t('home.empty')}</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedTokens.map((token) => (
                <TokenCard key={token.address} {...token} />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </section>

      {/* How it works for AI Agents */}
      <section className="space-y-6 py-8">
        <h2 className="text-xl font-bold text-synth-text text-center terminal-prompt">
          {t('home.howItWorks')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '🔑', num: '01', title: t('home.step1Title'), desc: t('home.step1Desc') },
            { icon: '📝', num: '02', title: t('home.step2Title'), desc: t('home.step2Desc') },
            { icon: '🚀', num: '03', title: t('home.step3Title'), desc: t('home.step3Desc') },
            { icon: '💰', num: '04', title: t('home.step4Title'), desc: t('home.step4Desc') },
          ].map((step) => (
            <div key={step.num} className="card border border-synth-border hover:border-synth-green/30 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{step.icon}</span>
                <span className="text-[10px] font-mono text-synth-cyan">STEP {step.num}</span>
              </div>
              <h3 className="text-sm font-bold text-synth-green mb-1">{step.title}</h3>
              <p className="text-xs text-synth-muted leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <a href="/docs" className="text-sm text-synth-cyan hover:text-synth-green transition-colors font-mono">
            {t('home.learnMore')}
          </a>
        </div>
      </section>

      {/* Bottom tagline */}
      <div className="text-center pt-8 pb-4">
        <span className="text-xs text-synth-muted font-mono">
          {t('home.builtOn')}
        </span>
      </div>
    </div>
  );
}
