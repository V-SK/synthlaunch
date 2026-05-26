'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Token } from '@/lib/api';
import { formatMarketCap, formatTimeAgo, statusLabel } from '@/lib/api';
import { CHAIN_CONFIG } from '@/lib/contracts';
import { useI18n } from '@/lib/i18n';

type LeaderboardEntry = {
  rank: number;
  nativeSymbol?: string;
  agentName: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  totalFeesBnb: number;
  totalFeesUsd: number;
};

const FANFI_SYMBOLS = new Set(['BRZAI', 'FINALX', 'SCORER', 'VARDAO', 'GOALAI']);
const SPORTFI_LABELS: Record<string, string> = {
  BRZAI: 'Brazil Bracket Arena',
  FINALX: 'Final Result Arena',
  SCORER: 'Golden Boot Prop Arena',
  VARDAO: 'VAR Meme Market',
  GOALAI: 'OKX Momentum Scout',
};
const FANFI_AGENT = 'tw:SynthFanFi';

function formatNative(value: number): string {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  if (value > 0) return `$${value.toFixed(2)}`;
  return '$0';
}

function isFanFiToken(token: Token): boolean {
  const symbol = token.symbol?.toUpperCase() || '';
  const text = `${token.name} ${token.description} ${token.agent_name}`.toLowerCase();
  return FANFI_SYMBOLS.has(symbol) || token.agent_name === FANFI_AGENT || text.includes('fanfi') || text.includes('sportfi') || text.includes('prediction') || text.includes('world cup');
}

export function XCupLivePanel() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const nativeSymbol = CHAIN_CONFIG[196].nativeSymbol;
  const [tokens, setTokens] = useState<Token[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [tokensRes, leaderboardRes] = await Promise.all([
        fetch('/api/tokens?chainId=196&sort=new&refresh=1', { cache: 'no-store' }),
        fetch('/api/leaderboard?chainId=196', { cache: 'no-store' }),
      ]);

      if (!tokensRes.ok) throw new Error(isZh ? 'X Layer token API 不可用' : 'X Layer token API unavailable');
      if (!leaderboardRes.ok) throw new Error(isZh ? 'X Layer 排行榜 API 不可用' : 'X Layer leaderboard API unavailable');

      const [tokensData, leaderboardData] = await Promise.all([
        tokensRes.json(),
        leaderboardRes.json(),
      ]);

      setTokens(Array.isArray(tokensData) ? tokensData : []);
      setLeaderboard(Array.isArray(leaderboardData.entries) ? leaderboardData.entries : []);
      setLastUpdated(Date.now());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : isZh ? '加载实时数据失败' : 'Failed to load live data');
    } finally {
      setLoading(false);
    }
  }, [isZh]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleMarketProofCreated = () => {
      void loadData();
    };

    window.addEventListener('fanfi-market-proof-created', handleMarketProofCreated);
    return () => {
      window.removeEventListener('fanfi-market-proof-created', handleMarketProofCreated);
    };
  }, [loadData]);

  const fanfiTokens = useMemo(() => tokens.filter(isFanFiToken), [tokens]);
  const displayTokens = fanfiTokens.length > 0 ? fanfiTokens.slice(0, 4) : tokens.slice(0, 4);
  const totalMarketCap = tokens.reduce((sum, token) => sum + (token.marketCap || 0), 0);
  const topRevenue = leaderboard[0];
  const copy = isZh
    ? {
        tokenApiError: 'X Layer token API 不可用',
        leaderboardApiError: 'X Layer 排行榜 API 不可用',
        loadError: '加载实时数据失败',
        sectionLabel: 'X Layer 预测市场',
        title: '预测、交易与排行榜动态',
        intro: '聚合预测 Arena 的市场资产、Agent 排行、费用收入和市值/活动动量，让世界杯预测玩法有公开面板。',
        updated: '已更新',
        refreshing: '刷新中...',
        refresh: '刷新',
        xLayerTokens: 'X Layer 资产',
        fanfiMatches: 'Arena 匹配',
        marketCap: '市值',
        topRevenue: '最高收入',
        launchFeed: 'X Layer Receipt / Proof Feed',
        viewTokens: '查看资产',
        tax: '税率',
        emptyTitle: '还没有 X Layer 预测资产',
        emptyBody: '创建预测 Arena 或添加市场资产后，这里会显示市场与排行数据。',
        createArena: '创建预测 Arena',
        revenue: '市场资产收入',
        openLeaderboard: '打开排行榜',
        waitingTitle: '等待手续费活动',
        waitingBody: '当 X Layer 市场资产产生交易税收后，托管合约排名会显示在这里。',
      }
    : {
        tokenApiError: 'X Layer token API unavailable',
        leaderboardApiError: 'X Layer leaderboard API unavailable',
        loadError: 'Failed to load live data',
        sectionLabel: 'X Layer Prediction Market',
        title: 'Prediction, Trading, And Ranking Activity',
        intro: 'Aggregates market assets, agent ranking, fee revenue, and market/activity momentum into one public World Cup prediction surface.',
        updated: 'Updated',
        refreshing: 'Refreshing...',
        refresh: 'Refresh',
        xLayerTokens: 'X Layer Assets',
        fanfiMatches: 'Arena Matches',
        marketCap: 'Market Cap',
        topRevenue: 'Top Revenue',
        launchFeed: 'X Layer Receipt / Proof Feed',
        viewTokens: 'View assets',
        tax: 'Tax',
        emptyTitle: 'No X Layer prediction assets yet',
        emptyBody: 'Create a prediction arena or attach a market asset, then this feed will show market and ranking data.',
        createArena: 'Create Prediction Arena',
        revenue: 'Market Asset Revenue',
        openLeaderboard: 'Open leaderboard',
        waitingTitle: 'Waiting for fee activity',
        waitingBody: 'Once X Layer market assets generate tax revenue, the custody contract ranking will appear here.',
      };

  return (
    <section id="fanfi-live-panel" className="border-b border-synth-border">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {copy.sectionLabel}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {copy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-synth-muted">
              {copy.intro}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] text-synth-muted">
                {copy.updated} {formatTimeAgo(Math.floor(lastUpdated / 1000))}
              </span>
            )}
            <button
              type="button"
              onClick={loadData}
              className="btn-secondary text-xs"
              disabled={loading}
            >
              {loading ? copy.refreshing : copy.refresh}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.xLayerTokens}</div>
            <div className="mt-3 text-2xl font-bold text-synth-green">{loading ? '...' : tokens.length}</div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.fanfiMatches}</div>
            <div className="mt-3 text-2xl font-bold text-synth-cyan">{loading ? '...' : fanfiTokens.length}</div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.marketCap}</div>
            <div className="mt-3 text-2xl font-bold text-synth-text">{loading ? '...' : formatUsd(totalMarketCap)}</div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.topRevenue}</div>
            <div className="mt-3 text-lg font-bold text-synth-green">
              {loading
                ? '...'
                : topRevenue
                  ? `${formatNative(topRevenue.totalFeesBnb)} ${topRevenue.nativeSymbol || nativeSymbol}`
                  : `0 ${nativeSymbol}`}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-synth-text">{copy.launchFeed}</h3>
              <Link href="/tokens" className="text-[10px] text-synth-cyan hover:text-synth-green">
                {copy.viewTokens}
              </Link>
            </div>

            {displayTokens.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {displayTokens.map((token) => {
                  const symbol = token.symbol?.toUpperCase() || '';
                  const label = SPORTFI_LABELS[symbol] || token.name || token.symbol;

                  return (
                    <Link
                      key={token.address}
                      href={`/token/${token.address}?chainId=196`}
                      className="card block hover:border-synth-green/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-bold text-synth-text">{label}</div>
                          <div className="mt-1 text-xs text-synth-muted">${token.symbol}</div>
                        </div>
                        <span className="rounded border border-synth-cyan/30 bg-synth-cyan/10 px-2 py-1 text-[10px] text-synth-cyan">
                          {statusLabel(token.status)}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-synth-muted">{copy.marketCap}</div>
                          <div className="mt-1 text-synth-text">{formatMarketCap(token.marketCap)}</div>
                        </div>
                        <div>
                          <div className="text-synth-muted">{copy.tax}</div>
                          <div className="mt-1 text-synth-text">{token.taxRate}%</div>
                        </div>
                      </div>
                      <div className="mt-4 break-all text-[10px] text-synth-muted">{token.address}</div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="card border-synth-green/20 bg-synth-green/5">
                <h3 className="text-sm font-bold text-synth-green">{copy.emptyTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-synth-muted">
                  {copy.emptyBody}
                </p>
                <a href="#fanfi-campaign-studio" className="btn-primary mt-4 inline-block">
                  {copy.createArena}
                </a>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-synth-text">{copy.revenue}</h3>
              <Link href="/leaderboard?chainId=196" className="text-[10px] text-synth-cyan hover:text-synth-green">
                {copy.openLeaderboard}
              </Link>
            </div>

            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.slice(0, 4).map((entry) => (
                  <Link
                    key={entry.tokenAddress}
                    href={`/token/${entry.tokenAddress}?chainId=196`}
                    className="card flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-synth-text">
                        #{entry.rank} ${entry.tokenSymbol}
                      </div>
                      <div className="mt-1 text-[10px] text-synth-muted">{SPORTFI_LABELS[entry.tokenSymbol?.toUpperCase() || ''] || entry.agentName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-synth-green">
                        {formatNative(entry.totalFeesBnb)} {entry.nativeSymbol || nativeSymbol}
                      </div>
                      <div className="text-[10px] text-synth-muted">{formatUsd(entry.totalFeesUsd)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card">
                <h3 className="text-sm font-bold text-synth-text">{copy.waitingTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-synth-muted">
                  {copy.waitingBody}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
