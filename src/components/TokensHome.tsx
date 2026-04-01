'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { StatsBar } from '@/components/StatsBar';
import { TokenCard } from '@/components/TokenCard';
import { Pagination } from '@/components/Pagination';
import type { Token } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { CHAIN_CONFIG } from '@/lib/contracts';

const TOKENS_PER_PAGE = 12;
const CHAIN_STORAGE_KEY = 'synthlaunch:chainId';

type SortTab = 'hot' | 'new' | 'top' | 'dex';

interface TopEarner {
  rank: number;
  tokenSymbol: string;
  totalFeesBnb: number;
}

export function TokensHome() {
  const { t } = useI18n();
  const [selectedChain, setSelectedChain] = useState<56 | 196>(56);
  const [sort, setSort] = useState<SortTab>('new');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [topEarners, setTopEarners] = useState<TopEarner[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(CHAIN_STORAGE_KEY);
    const storedId = Number(stored);
    if (storedId in CHAIN_CONFIG) {
      setSelectedChain(storedId as 56 | 196);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHAIN_STORAGE_KEY, String(selectedChain));
  }, [selectedChain]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => {
        const top3 = (data.entries || []).slice(0, 3).map((entry: any) => ({
          rank: entry.rank,
          tokenSymbol: entry.tokenSymbol,
          totalFeesBnb: entry.totalFeesBnb,
        }));
        setTopEarners(top3);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tokens?sort=${sort}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then((data) => {
        setTokens(data);
        setCurrentPage(1);
        setLoading(false);
      })
      .catch((fetchError: Error) => {
        setError(fetchError.message);
        setLoading(false);
      });
  }, [sort]);

  const tabs: { key: SortTab; label: string; icon: string }[] = [
    { key: 'hot', label: t('home.sortHot'), icon: '🔥' },
    { key: 'new', label: t('home.sortNew'), icon: '🆕' },
    { key: 'top', label: t('home.sortTop'), icon: '🏆' },
    { key: 'dex', label: 'DEX', icon: '🎓' },
  ];

  const chainOptions = useMemo(
    () => [
      { id: 56 as const, label: 'BSC', badge: t('home.liveOnBsc'), nativeSymbol: CHAIN_CONFIG[56].nativeSymbol },
      { id: 196 as const, label: 'X Layer', badge: t('home.liveOnXLayer'), nativeSymbol: CHAIN_CONFIG[196].nativeSymbol },
    ],
    [t]
  );

  const activeChain = chainOptions.find((chain) => chain.id === selectedChain) ?? chainOptions[0];

  const paginatedTokens = useMemo(() => {
    const start = (currentPage - 1) * TOKENS_PER_PAGE;
    return tokens.slice(start, start + TOKENS_PER_PAGE);
  }, [tokens, currentPage]);

  const totalPages = Math.ceil(tokens.length / TOKENS_PER_PAGE);

  return (
    <div className="space-y-8">
      <section className="text-center py-12 space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div
            className="inline-block text-[10px] px-2 py-1 bg-synth-green/10 text-synth-green border border-synth-green/20 rounded font-mono"
            title={`${activeChain.label} (${activeChain.nativeSymbol})`}
          >
            ● {activeChain.badge}
          </div>
          <div className="flex items-center gap-1 rounded border border-synth-border bg-synth-surface/60 p-0.5">
            {chainOptions.map((chain) => {
              const isActive = selectedChain === chain.id;
              return (
                <button
                  key={chain.id}
                  type="button"
                  onClick={() => setSelectedChain(chain.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all duration-200 ${
                    isActive
                      ? 'text-synth-green bg-synth-green/10 border border-synth-green/30'
                      : 'text-synth-muted hover:text-synth-text'
                  }`}
                  aria-pressed={isActive}
                  title={`${chain.label} (${chain.nativeSymbol})`}
                >
                  {chain.label}
                </button>
              );
            })}
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-synth-text">
          {t('home.heroTitle')}
          <br />
          <span className="text-synth-green glow-text-green">{t('home.subtitle')}</span>
        </h1>
        <p className="text-synth-muted max-w-xl mx-auto text-sm">
          {selectedChain === 196
            ? '在 X Layer 上创建代币，交易手续费自动分配给 AI Agent。'
            : t('home.heroDesc')}
          <br />
          {t('home.heroPowered')}
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Link href={`/launch?chainId=${selectedChain}`} className="btn-primary">
            {t('launch.launchToken')} →
          </Link>
          <Link
            href="/mint"
            className="px-4 py-2 rounded text-sm font-mono font-bold border border-[#F0B90B]/40 bg-[#F0B90B]/10 text-[#F0B90B] hover:bg-[#F0B90B]/20 hover:border-[#F0B90B]/60 transition-all duration-200"
          >
            ⚡ Fair Mint →
          </Link>
          <a href="/docs" className="btn-secondary">
            {t('home.viewDocs')}
          </a>
        </div>
      </section>

      <StatsBar chainId={selectedChain} />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-synth-green/5 to-cyan-500/5 rounded-xl" />
        <div className="relative border border-synth-green/20 rounded-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-synth-green to-cyan-400 flex items-center justify-center text-3xl shadow-lg shadow-synth-green/20 flex-shrink-0">
              ⚡
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <h3 className="text-lg font-bold text-synth-text">NFA Pro</h3>
                <span className="px-2 py-0.5 rounded-full bg-synth-green/10 text-synth-green text-[10px] font-bold border border-synth-green/30">
                  BAP-578
                </span>
                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold animate-pulse">
                  LIVE
                </span>
              </div>
              <p className="text-sm text-synth-muted mb-3">
                {t('home.nfaProDesc') || 'Full BAP-578 implementation for AI agents. Batch swaps, learning module, memory storage, and multi-agent collaboration.'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="text-[10px] text-synth-cyan bg-synth-surface px-2 py-1 rounded">🧠 Learning</span>
                <span className="text-[10px] text-synth-cyan bg-synth-surface px-2 py-1 rounded">💾 Memory</span>
                <span className="text-[10px] text-synth-cyan bg-synth-surface px-2 py-1 rounded">🤝 Multi-Agent</span>
                <span className="text-[10px] text-synth-cyan bg-synth-surface px-2 py-1 rounded">⚡ Batch Ops</span>
              </div>
            </div>
            <Link href="/nfa" className="btn-primary flex items-center gap-2 flex-shrink-0">
              {t('home.exploreNfa') || 'Explore'} →
            </Link>
          </div>
        </div>
      </section>

      {topEarners.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-synth-text font-mono">🏆 {t('home.topEarners')}</h2>
            <Link href="/leaderboard" className="text-[10px] text-synth-cyan hover:text-synth-green transition-colors font-mono">
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topEarners.map((earner) => {
              const rankEmoji = earner.rank === 1 ? '🥇' : earner.rank === 2 ? '🥈' : '🥉';
              return (
                <Link key={earner.rank} href="/leaderboard">
                  <div className="card border border-synth-border hover:border-synth-green/30 transition-colors cursor-pointer flex items-center gap-3 py-3">
                    <span className="text-xl">{rankEmoji}</span>
                    <div>
                      <span className="text-sm font-bold text-synth-green">${earner.tokenSymbol}</span>
                      <span className="text-xs text-synth-muted block">{earner.totalFeesBnb.toFixed(4)} BNB</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </section>

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

      <div className="text-center pt-8 pb-4">
        <span className="text-xs text-synth-muted font-mono">{t('home.builtOn')}</span>
      </div>
    </div>
  );
}
