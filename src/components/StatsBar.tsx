'use client';

import { MOCK_STATS } from '@/lib/constants';

export function StatsBar() {
  const stats = [
    { label: 'Total Tokens', value: MOCK_STATS.totalTokens.toLocaleString(), color: 'text-synth-green' },
    { label: 'Total Volume', value: `$${MOCK_STATS.totalVolume}`, color: 'text-synth-cyan' },
    { label: 'Agent Fees Earned', value: `$${MOCK_STATS.agentFeesEarned}`, color: 'text-synth-purple' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="card flex flex-col items-center justify-center py-6"
        >
          <span className="text-xs text-synth-muted uppercase tracking-wider mb-1">
            {stat.label}
          </span>
          <span className={`text-2xl font-bold ${stat.color}`}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
