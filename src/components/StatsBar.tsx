'use client';

import { MOCK_STATS } from '@/lib/constants';

export function StatsBar() {
  const stats = [
    { label: 'Total Tokens', value: MOCK_STATS.totalTokens.toLocaleString(), icon: '◆', color: 'text-synth-green' },
    { label: 'Total Volume', value: `$${MOCK_STATS.totalVolume}`, icon: '◈', color: 'text-synth-cyan' },
    { label: 'Agent Fees Earned', value: `$${MOCK_STATS.agentFeesEarned}`, icon: '◇', color: 'text-synth-purple' },
    { label: '24h Volume', value: `$${MOCK_STATS.volume24h}`, icon: '▲', color: 'text-synth-green' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="card flex flex-col items-center justify-center py-5"
        >
          <span className={`text-lg mb-1 ${stat.color}`}>{stat.icon}</span>
          <span className="text-[10px] text-synth-muted uppercase tracking-wider mb-1">
            {stat.label}
          </span>
          <span className={`text-xl font-bold ${stat.color}`}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
