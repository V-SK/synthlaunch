'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useLeaderboard } from '@/hooks/useLeaderboard';

const ALICE_DECIMALS = 12;
const PAGE_SIZE = 10;

function formatAliceAmount(raw: string): string {
  const n = BigInt(raw);
  const divisor = BigInt(10 ** ALICE_DECIMALS);
  const whole = n / divisor;
  const frac = (n % divisor).toString().padStart(ALICE_DECIMALS, '0').slice(0, 4);
  if (whole >= 1000000n) return `${(Number(whole) / 1e6).toFixed(1)}M`;
  if (whole >= 1000n) return `${(Number(whole) / 1e3).toFixed(1)}K`;
  return `${whole}.${frac}`;
}

function formatSynth(amount: bigint): string {
  const n = Number(amount) / 1e18;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function shortenAddress(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分钟前`;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-synth-border/40 animate-pulse">
      <div className="w-8 h-4 bg-zinc-700 rounded" />
      <div className="flex-1 h-4 bg-zinc-700 rounded" />
      <div className="w-20 h-4 bg-zinc-700 rounded" />
      <div className="w-10 h-5 bg-zinc-800 rounded" />
    </div>
  );
}

interface AliceEntry {
  address: string;
  total: string;
  rank: number;
}

function AliceDistributionRanking() {
  const [entries, setEntries] = useState<AliceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchData = () => {
      fetch('/api/alice-stats')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active || !data?.perAddressTotals) return;
          const totals: Record<string, string> = data.perAddressTotals;
          const sorted = Object.entries(totals)
            .map(([address, total]) => ({ address, total }))
            .sort((a, b) => {
              const diff = BigInt(b.total) - BigInt(a.total);
              return diff > 0n ? 1 : diff < 0n ? -1 : 0;
            })
            .map((e, i) => ({ ...e, rank: i + 1 }));
          setEntries(sorted);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
    };

    fetchData();
    // Poll every 2 minutes to pick up new distributions
    const interval = window.setInterval(fetchData, 2 * 60 * 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="card overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-synth-border bg-synth-bg/50 text-xs text-synth-muted font-mono">
          <span className="w-8">#</span>
          <span className="flex-1">地址</span>
          <span className="w-28 text-right">ALICE 已领取</span>
        </div>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="card overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-synth-border bg-synth-bg/50 text-xs text-synth-muted font-mono">
          <span className="w-8">#</span>
          <span className="flex-1">地址</span>
          <span className="w-28 text-right">ALICE 已领取</span>
        </div>
        <div className="px-4 py-8 text-center text-sm text-synth-muted">暂无分发记录</div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-synth-border bg-synth-bg/50 text-xs text-synth-muted font-mono">
        <span className="w-8">#</span>
        <span className="flex-1">地址</span>
        <span className="w-28 text-right">ALICE 已领取</span>
      </div>
      {entries.map((entry) => (
        <div
          key={entry.address}
          className="flex items-center gap-3 px-4 py-3 border-b border-synth-border/30 hover:bg-synth-bg/40 transition-colors"
        >
          <span className="w-8 text-sm font-bold text-synth-muted font-mono">
            {rankLabel(entry.rank)}
          </span>
          <a
            href={`https://bscscan.com/address/${entry.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 font-mono text-sm text-synth-text hover:text-synth-green transition-colors truncate"
          >
            {shortenAddress(entry.address)}
          </a>
          <span className="w-28 text-right text-sm font-bold text-yellow-400 font-mono">
            {formatAliceAmount(entry.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StakingLeaderboard() {
  const { leaderboard, isLoading, error, lastUpdated, refresh } = useLeaderboard();
  const { address: connectedAddress } = useAccount();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return leaderboard;
    const q = search.toLowerCase();
    return leaderboard.filter((e) => e.address.toLowerCase().includes(q));
  }, [leaderboard, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when search changes
  useEffect(() => { setPage(0); }, [search]);

  // Connected wallet's entry
  const myEntry = useMemo(() => {
    if (!connectedAddress) return null;
    return leaderboard.find((e) => e.address.toLowerCase() === connectedAddress.toLowerCase()) ?? null;
  }, [leaderboard, connectedAddress]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staking Leaderboard */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-synth-text">🏆 质押排行榜</h2>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="text-xs text-synth-muted hover:text-synth-green transition-colors disabled:opacity-40 border border-synth-border/50 rounded px-2 py-1"
            >
              {isLoading ? '加载中...' : '刷新'}
            </button>
          </div>

          {/* Connected wallet score */}
          {myEntry && (
            <div className="rounded-lg border border-synth-green/30 bg-synth-green/5 px-4 py-3 flex items-center justify-between">
              <div className="text-xs text-synth-muted">
                你的排名 <span className="text-synth-green font-bold">{rankLabel(myEntry.rank)}</span>
                <span className="ml-2 font-mono text-synth-text">{shortenAddress(myEntry.address)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-synth-muted mr-2">{formatSynth(myEntry.stakedAmount)} SYNTH</span>
                <span className="text-xs font-bold text-synth-green">{myEntry.multiplier}x</span>
              </div>
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索地址 0x..."
            className="w-full px-3 py-2 text-xs font-mono rounded border border-synth-border bg-synth-bg/70 text-synth-text placeholder:text-synth-muted/50 focus:outline-none focus:border-synth-green/50"
          />

          <div className="card overflow-hidden p-0">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-synth-border bg-synth-bg/50 text-xs text-synth-muted font-mono">
              <span className="w-8">#</span>
              <span className="flex-1">地址</span>
              <span className="w-24 text-right">质押量</span>
              <span className="w-10 text-center">倍率</span>
            </div>

            {isLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {!isLoading && error && (
              <div className="px-4 py-6 text-center text-sm text-red-400">{error}</div>
            )}

            {!isLoading && !error && filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-synth-muted">
                {search ? '未找到匹配地址' : '暂无质押数据'}
              </div>
            )}

            {!isLoading &&
              paged.map((entry) => {
                const isMe = connectedAddress?.toLowerCase() === entry.address.toLowerCase();
                return (
                  <div
                    key={entry.address}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-synth-border/30 hover:bg-synth-bg/40 transition-colors ${isMe ? 'bg-synth-green/5' : ''}`}
                  >
                    <span className="w-8 text-sm font-bold text-synth-muted font-mono">
                      {rankLabel(entry.rank)}
                    </span>
                    <a
                      href={`https://bscscan.com/address/${entry.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 font-mono text-sm transition-colors truncate ${isMe ? 'text-synth-green font-bold' : 'text-synth-text hover:text-synth-green'}`}
                    >
                      {shortenAddress(entry.address)} {isMe && '(你)'}
                    </a>
                    <span className="w-24 text-right text-sm text-synth-muted font-mono">
                      {formatSynth(entry.stakedAmount)}
                    </span>
                    <span className="w-10 text-center">
                      <span className="text-xs font-bold text-synth-green border border-synth-green/30 rounded px-1 py-0.5">
                        {entry.multiplier}x
                      </span>
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-xs text-synth-muted hover:text-synth-green disabled:opacity-30 border border-synth-border/50 rounded px-2 py-1"
              >
                上一页
              </button>
              <span className="text-xs text-synth-muted font-mono">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-xs text-synth-muted hover:text-synth-green disabled:opacity-30 border border-synth-border/50 rounded px-2 py-1"
              >
                下一页
              </button>
            </div>
          )}

          <p className="text-xs text-synth-muted text-right">
            分红权重 = 质押量 × 倍率
            {lastUpdated && <span className="ml-2">· {timeSince(lastUpdated)}</span>}
          </p>
        </div>

        {/* ALICE Distribution Ranking */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-synth-text">🪙 ALICE 分发排行</h2>
          <AliceDistributionRanking />
          <p className="text-xs text-synth-muted text-right">
            按累计 ALICE 领取量排序 · 每小时自动分发
          </p>
        </div>
      </div>
    </div>
  );
}
