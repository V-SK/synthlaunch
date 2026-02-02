'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

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
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetchData = useCallback(() => {
    fetch('/api/leaderboard')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then((data) => {
        setEntries(data.entries || []);
        setLoading(false);
        setLastUpdated(Date.now());
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

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
            ? '所有代币累计交易税收排名 — 数据实时来自链上托管合约（已扣除20%平台协议费）'
            : 'All tokens ranked by accumulated trading tax revenue — live on-chain (after 20% platform fee)'}
        </p>
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
            {loading ? '...' : `${formatBnb(totalFeesBnb)} BNB`}
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
            {loading ? '...' : totalClaimedBnb > 0 ? `${formatBnb(totalClaimedBnb)} BNB` : '-'}
          </div>
        </div>
        <div className="card border border-synth-border text-center py-4">
          <div className="text-xs text-synth-muted uppercase tracking-wider mb-1">
            {isZh ? '待领取' : 'Pending'}
          </div>
          <div className="text-lg font-bold text-yellow-400">
            {loading ? '...' : `${formatBnb(totalPendingBnb)} BNB`}
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
                      href={`/token/${entry.tokenAddress}`}
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
                      {formatBnb(entry.totalFeesBnb)} BNB
                    </div>
                    <div className="text-xs text-synth-muted">
                      {formatUsd(entry.totalFeesUsd)}
                    </div>
                  </td>

                  {/* Claimed */}
                  <td className="py-3 px-4 text-right hidden sm:table-cell">
                    <span className={entry.claimedBnb > 0 ? 'text-synth-cyan text-xs' : 'text-synth-muted text-xs'}>
                      {entry.claimedBnb > 0 ? `${formatBnb(entry.claimedBnb)} BNB` : '-'}
                    </span>
                  </td>

                  {/* Pending */}
                  <td className="py-3 px-4 text-right hidden sm:table-cell">
                    <span className={entry.pendingBnb > 0 ? 'text-yellow-400 text-xs' : 'text-synth-muted text-xs'}>
                      {entry.pendingBnb > 0 ? `${formatBnb(entry.pendingBnb)} BNB` : '-'}
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
            href="https://bscscan.com/address/0x3Fa33A0fb85f11A901e3616E10876d10018f43B7"
            target="_blank"
            rel="noopener noreferrer"
            className="text-synth-cyan hover:underline break-all"
          >
            0x3Fa33A0fb85f11A901e3616E10876d10018f43B7
          </a>
        </p>
        <p>{isZh ? '数据直接从 BSC 链上读取，每 30 秒刷新' : 'Data read directly from BSC on-chain, refreshed every 30s'}</p>
      </div>
    </div>
  );
}
