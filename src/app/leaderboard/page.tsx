'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { CHAIN_CONFIG } from '@/lib/contracts';

// Blacklist tokens from leaderboard display (lowercase)
const LEADERBOARD_BLACKLIST: string[] = [
  '0xf0af019693179ae0fd4b92ec39068b16f4887777', // KingMolt SYNTH - kept as reserve
];

type SortMode = 'revenue' | 'recent';

interface LeaderboardEntry {
  rank: number;
  agentName: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  taxRate: number;
  totalFeesBnb: number;
  totalFeesUsd: number;
  claimedBnb: number;
  claimedUsd: number;
  pendingBnb: number;
  pendingUsd: number;
  createdAt: string;
}

function formatBnb(value: number): string {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

function formatUsd(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getRankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export default function LeaderboardPage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('revenue');
  const [selectedChain, setSelectedChain] = useState<56 | 196>(56);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const activeChain = CHAIN_CONFIG[selectedChain];
  const nativeSymbol = activeChain.nativeSymbol;
  const custodyExplorerUrl = `${activeChain.explorer}/address/${activeChain.custodyAddress}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawChainId = new URLSearchParams(window.location.search).get('chainId');
    if (rawChainId === '196') {
      setSelectedChain(196);
    }
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');
    fetch(`/api/leaderboard?chainId=${selectedChain}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then((data) => {
        const filtered = (data.entries || []).filter(
          (e: LeaderboardEntry) => !LEADERBOARD_BLACKLIST.includes(e.tokenAddress.toLowerCase())
        );
        setEntries(filtered);
        setLoading(false);
        setLastUpdated(Date.now());
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [selectedChain]);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update "X seconds ago" counter every second
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  // Sort entries based on current mode
  const sortedEntries = [...entries].sort((a, b) => {
    if (sortMode === 'recent') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return b.totalFeesBnb - a.totalFeesBnb;
  });

  const sortTabs: { key: SortMode; label: string; icon: string }[] = [
    { key: 'revenue', label: isZh ? '按税收' : 'By Revenue', icon: '💰' },
    { key: 'recent', label: isZh ? '按时间' : 'By Recent', icon: '🕐' },
  ];

  // Calculate totals
  const totalFeesBnb = entries.reduce((sum, e) => sum + e.totalFeesBnb, 0);
  const totalFeesUsd = entries.reduce((sum, e) => sum + e.totalFeesUsd, 0);
  const totalClaimedBnb = entries.reduce((sum, e) => sum + e.claimedBnb, 0);
  const totalPendingBnb = entries.reduce((sum, e) => sum + e.pendingBnb, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-synth-text terminal-prompt">
          {isZh ? '💰 税收排行榜' : '💰 Tax Revenue Leaderboard'}
        </h1>
        <p className="text-sm text-synth-muted">
          {isZh
            ? '所有代币累计交易税收排名 — 数据实时来自所选链上托管合约（已扣除20%平台协议费）'
            : 'All tokens ranked by accumulated trading tax revenue on the selected chain (after 20% platform fee)'}
        </p>
        <div className="flex items-center gap-2 pt-2">
          {([
            { id: 56 as const, label: 'BSC' },
            { id: 196 as const, label: 'X Layer' },
          ]).map((chain) => {
            const isActive = selectedChain === chain.id;
            return (
              <button
                key={chain.id}
                type="button"
                onClick={() => {
                  setSelectedChain(chain.id);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('chainId', String(chain.id));
                    window.history.replaceState(null, '', url.toString());
                  }
                }}
                className={`rounded border px-3 py-1.5 text-xs font-mono transition-all duration-200 ${
                  isActive
                    ? 'border-synth-green bg-synth-green/10 text-synth-green'
                    : 'border-synth-border text-synth-muted hover:text-synth-text'
                }`}
                aria-pressed={isActive}
              >
                {chain.label}
              </button>
            );
          })}
        </div>
        {!loading && (
          <p className="text-xs text-synth-muted/60">
            {isZh ? `上次更新: ${secondsAgo}秒前` : `Last updated: ${secondsAgo}s ago`}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card border border-synth-border text-center py-4">
          <div className="text-xs text-synth-muted uppercase tracking-wider mb-1">
            {isZh ? '总税收' : 'Total Revenue'}
          </div>
          <div className="text-lg font-bold text-synth-green">
            {loading ? '...' : `${formatBnb(totalFeesBnb)} ${nativeSymbol}`}
          </div>
          <div className="text-xs text-synth-muted">
            {loading ? '' : formatUsd(totalFeesUsd)}
          </div>
        </div>
        <div className="card border border-synth-border text-center py-4">
          <div className="text-xs text-synth-muted uppercase tracking-wider mb-1">
            {isZh ? '已领取' : 'Claimed'}
          </div>
          <div className="text-lg font-bold text-synth-cyan">
            {loading ? '...' : totalClaimedBnb > 0 ? `${formatBnb(totalClaimedBnb)} ${nativeSymbol}` : '-'}
          </div>
        </div>
        <div className="card border border-synth-border text-center py-4">
          <div className="text-xs text-synth-muted uppercase tracking-wider mb-1">
            {isZh ? '待领取' : 'Pending'}
          </div>
          <div className="text-lg font-bold text-yellow-400">
            {loading ? '...' : `${formatBnb(totalPendingBnb)} ${nativeSymbol}`}
          </div>
        </div>
        <div className="card border border-synth-border text-center py-4">
          <div className="text-xs text-synth-muted uppercase tracking-wider mb-1">
            {isZh ? '代币数' : 'Tokens'}
          </div>
          <div className="text-lg font-bold text-synth-text">
            {loading ? '...' : entries.length}
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-16 text-synth-muted">
          {isZh ? '加载中...' : 'Loading...'}
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-red-400">
          {isZh ? '加载失败: ' : 'Failed to load: '}{error}
        </div>
      )}

      {/* Sort Tabs */}
      {!loading && !error && entries.length > 0 && (
        <div className="flex items-center gap-1">
          {sortTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSortMode(tab.key)}
              className={`px-3 py-1.5 rounded text-sm font-mono transition-all duration-200 ${
                sortMode === tab.key
                  ? 'text-synth-green bg-synth-green/10'
                  : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && !error && entries.length > 0 && (
        <div className="card border border-synth-border overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-synth-cyan border-b border-synth-border text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4 w-16">{isZh ? '排名' : 'Rank'}</th>
                <th className="text-left py-3 px-4">{isZh ? '代币' : 'Token'}</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">{isZh ? 'Agent' : 'Agent'}</th>
                <th className="text-right py-3 px-4">{isZh ? '总税收' : 'Total Revenue'}</th>
                <th className="text-right py-3 px-4 hidden sm:table-cell">{isZh ? '已领取' : 'Claimed'}</th>
                <th className="text-right py-3 px-4 hidden sm:table-cell">{isZh ? '待领取' : 'Pending'}</th>
                <th className="text-right py-3 px-4 hidden lg:table-cell">{isZh ? '税率' : 'Tax'}</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry, idx) => (
                <tr
                  key={entry.tokenAddress}
                  className="border-b border-synth-border/30 hover:bg-synth-surface/50 transition-colors"
                >
                  {/* Rank */}
                  <td className="py-3 px-4">
                    {sortMode === 'revenue' ? (
                      <span className={entry.rank <= 3 ? 'text-base' : 'text-synth-muted text-xs'}>
                        {getRankEmoji(entry.rank)}
                      </span>
                    ) : (
                      <span className="text-synth-muted text-xs">#{idx + 1}</span>
                    )}
                  </td>

                  {/* Token + Agent (agent shown below token name on mobile) */}
                  <td className="py-3 px-4">
                    <Link
                      href={`/token/${entry.tokenAddress}?chainId=${selectedChain}`}
                      className="hover:text-synth-green transition-colors"
                    >
                      <div className="font-bold text-synth-text">{entry.tokenSymbol}</div>
                      <div className="text-xs text-synth-muted">{entry.tokenName}</div>
                    </Link>
                    {/* Agent inline on mobile */}
                    <div className="md:hidden mt-1">
                      {entry.agentName.startsWith('tw:') ? (
                        <a
                          href={`https://x.com/${entry.agentName.slice(3)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-synth-muted text-[10px] hover:text-synth-cyan transition-colors"
                        >
                          🐦 @{entry.agentName.slice(3)}
                        </a>
                      ) : entry.agentName === 'self' ? (
                        <span className="text-synth-muted text-[10px]">👤 Self</span>
                      ) : (
                        <a
                          href={`https://moltbook.com/u/${entry.agentName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-synth-muted text-[10px] hover:text-synth-cyan transition-colors"
                        >
                          🦞 {entry.agentName}
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Agent (desktop only) */}
                  <td className="py-3 px-4 hidden md:table-cell">
                    {entry.agentName.startsWith('tw:') ? (
                      <a
                        href={`https://x.com/${entry.agentName.slice(3)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-synth-muted text-xs hover:text-synth-cyan transition-colors"
                      >
                        🐦 @{entry.agentName.slice(3)}
                      </a>
                    ) : entry.agentName === 'self' ? (
                      <span className="text-synth-muted text-xs">👤 Self</span>
                    ) : (
                      <a
                        href={`https://moltbook.com/u/${entry.agentName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-synth-muted text-xs hover:text-synth-cyan transition-colors"
                      >
                        🦞 {entry.agentName}
                      </a>
                    )}
                  </td>

                  {/* Total Revenue */}
                  <td className="py-3 px-4 text-right">
                    <div className="font-bold text-synth-green">
                      {formatBnb(entry.totalFeesBnb)} {nativeSymbol}
                    </div>
                    <div className="text-xs text-synth-muted">
                      {formatUsd(entry.totalFeesUsd)}
                    </div>
                  </td>

                  {/* Claimed */}
                  <td className="py-3 px-4 text-right hidden sm:table-cell">
                    <span className={entry.claimedBnb > 0 ? 'text-synth-cyan text-xs' : 'text-synth-muted text-xs'}>
                      {entry.claimedBnb > 0 ? `${formatBnb(entry.claimedBnb)} ${nativeSymbol}` : '-'}
                    </span>
                  </td>

                  {/* Pending */}
                  <td className="py-3 px-4 text-right hidden sm:table-cell">
                    <span className={entry.pendingBnb > 0 ? 'text-yellow-400 text-xs' : 'text-synth-muted text-xs'}>
                      {entry.pendingBnb > 0 ? `${formatBnb(entry.pendingBnb)} ${nativeSymbol}` : '-'}
                    </span>
                  </td>

                  {/* Tax Rate */}
                  <td className="py-3 px-4 text-right hidden lg:table-cell">
                    <span className="text-xs text-synth-muted">
                      {entry.taxRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-16">
          <p className="text-synth-muted">
            {isZh ? '暂无税收数据' : 'No tax revenue data yet'}
          </p>
        </div>
      )}

      {/* Contract Info */}
      <div className="card border border-synth-border p-4 text-xs text-synth-muted space-y-1">
        <p>
          {isZh ? '📋 托管合约: ' : '📋 Custody Contract: '}
          <a
            href={custodyExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-synth-cyan hover:underline break-all"
          >
            {activeChain.custodyAddress}
          </a>
        </p>
        <p>
          {isZh
            ? `数据直接从 ${selectedChain === 196 ? 'X Layer' : 'BSC'} 链上读取，每 30 秒刷新`
            : `Data read directly from ${selectedChain === 196 ? 'X Layer' : 'BSC'} on-chain, refreshed every 30s`}
        </p>
      </div>
    </div>
  );
}
