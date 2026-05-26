'use client';

import { useEffect, useState } from 'react';
import type { PlatformStats } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { CHAIN_CONFIG } from '@/lib/contracts';

type StatsBarProps = {
  chainId?: 56 | 196;
};

export function StatsBar({ chainId = 56 }: StatsBarProps) {
  const { t } = useI18n();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [totalRevenueBnb, setTotalRevenueBnb] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const nativeSymbol = CHAIN_CONFIG[chainId]?.nativeSymbol ?? 'BNB';

  useEffect(() => {
    Promise.all([
      fetch(`/api/stats?chainId=${chainId}`).then(r => r.json()),
      fetch(`/api/leaderboard?chainId=${chainId}`).then(r => r.json()).catch(() => ({ entries: [] })),
    ])
      .then(([statsData, lbData]) => {
        setStats(statsData);
        const total = (lbData.entries || []).reduce(
          (sum: number, e: { totalFeesBnb: number }) => sum + (e.totalFeesBnb || 0),
          0
        );
        setTotalRevenueBnb(total.toFixed(4));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chainId]);

  const items = [
    { label: t('stats.totalTokens'), value: stats?.totalTokens?.toString() || '0', icon: '◆', color: 'text-synth-green' },
    { label: t('stats.totalReserve'), value: `${stats?.totalReserveBnb || '0'} ${nativeSymbol}`, icon: '◈', color: 'text-synth-cyan' },
    { label: t('stats.totalMarketCap'), value: stats?.totalMarketCap || '$0', icon: '◇', color: 'text-synth-purple' },
    { label: t('stats.totalRevenue'), value: `${totalRevenueBnb} ${nativeSymbol}`, icon: '💰', color: 'text-synth-cyan' },
    { label: t('stats.activeDex'), value: `${stats?.activeTokens || 0} / ${stats?.dexTokens || 0}`, icon: '▲', color: 'text-synth-green' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {items.map((stat) => (
        <div
          key={stat.label}
          className="card flex flex-col items-center justify-center py-5"
        >
          <span className={`text-lg mb-1 ${stat.color}`}>{stat.icon}</span>
          <span className="text-[10px] text-synth-muted uppercase tracking-wider mb-1">
            {stat.label}
          </span>
          {loading ? (
            <span className="text-xl font-bold text-synth-muted animate-pulse">...</span>
          ) : (
            <span className={`text-xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
