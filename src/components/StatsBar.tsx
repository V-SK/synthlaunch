'use client';

import { useEffect, useState } from 'react';
import type { PlatformStats } from '@/lib/api';

export function StatsBar() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const items = [
    { label: 'Total Tokens', value: stats?.totalTokens?.toString() || '0', icon: '◆', color: 'text-synth-green' },
    { label: 'Total Reserve', value: `${stats?.totalReserveBnb || '0'} BNB`, icon: '◈', color: 'text-synth-cyan' },
    { label: 'Total Market Cap', value: stats?.totalMarketCap || '$0', icon: '◇', color: 'text-synth-purple' },
    { label: 'Active / DEX', value: `${stats?.activeTokens || 0} / ${stats?.dexTokens || 0}`, icon: '▲', color: 'text-synth-green' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
