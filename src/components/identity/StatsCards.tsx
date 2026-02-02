'use client';

import { BnbCard } from './BnbTheme';

interface Stat {
  label: string;
  value: string | number;
  icon: string;
}

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat, i) => (
        <BnbCard key={i} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center text-lg">
              {stat.icon}
            </div>
            <div>
              <div className="text-2xl font-bold text-[#EAECEF]">{stat.value}</div>
              <div className="text-xs text-[#848E9C]">{stat.label}</div>
            </div>
          </div>
        </BnbCard>
      ))}
    </div>
  );
}
