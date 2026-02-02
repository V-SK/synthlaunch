'use client';

import Link from 'next/link';
import { BnbCard, BscChainBadge, PlatformBadge } from './BnbTheme';
import type { OnChainAgent } from '@/hooks/useSynthID';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

export function AgentCard({ agent, compact = false }: { agent: OnChainAgent; compact?: boolean }) {
  return (
    <Link href={`/identity/agent/${agent.agentId}`}>
      <BnbCard hover className={`p-4 ${compact ? 'min-w-[260px]' : ''} cursor-pointer group`}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-lg bg-[#0B0E11] border border-[#2B3139] flex-shrink-0 overflow-hidden group-hover:border-[#F0B90B]/40 transition-colors">
            {agent.avatar ? (
              <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl text-[#848E9C]">🤖</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[#EAECEF] truncate group-hover:text-[#F0B90B] transition-colors">
                {agent.name}
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded font-mono">
                #{agent.agentId}
              </span>
              {agent.revoked && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[#F6465D]/10 text-[#F6465D] border border-[#F6465D]/20 rounded">
                  REVOKED
                </span>
              )}
            </div>

            {/* Platform + chain */}
            <div className="flex items-center gap-2 mt-1">
              <PlatformBadge platform={agent.platform} />
              <span className="text-[#848E9C] text-xs">@{agent.platformId}</span>
            </div>

            {!compact && agent.description && (
              <p className="text-xs text-[#848E9C] mt-2 line-clamp-2 leading-relaxed">{agent.description}</p>
            )}

            {/* Skills + meta */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <BscChainBadge />
                {!compact && agent.skills.slice(0, 2).map((skill, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#2B3139] text-[#848E9C] rounded">
                    {skill}
                  </span>
                ))}
                {!compact && agent.skills.length > 2 && (
                  <span className="text-[10px] text-[#848E9C]">+{agent.skills.length - 2}</span>
                )}
              </div>
              <span className="text-[10px] text-[#848E9C]">{timeAgo(agent.createdAt)}</span>
            </div>
          </div>
        </div>
      </BnbCard>
    </Link>
  );
}

// Compact card for the carousel
export function AgentCardCompact({ agent }: { agent: OnChainAgent }) {
  return (
    <Link href={`/identity/agent/${agent.agentId}`}>
      <BnbCard hover className="p-3 min-w-[220px] max-w-[220px] cursor-pointer group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0B0E11] border border-[#2B3139] flex-shrink-0 overflow-hidden group-hover:border-[#F0B90B]/40 transition-colors">
            {agent.avatar ? (
              <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg text-[#848E9C]">🤖</div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#EAECEF] truncate group-hover:text-[#F0B90B] transition-colors">
              {agent.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <PlatformBadge platform={agent.platform} />
              <BscChainBadge />
            </div>
          </div>
        </div>
        <div className="text-[10px] text-[#848E9C] mt-2 text-right">{timeAgo(agent.createdAt)}</div>
      </BnbCard>
    </Link>
  );
}
