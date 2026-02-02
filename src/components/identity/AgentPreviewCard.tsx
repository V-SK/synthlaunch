'use client';

import { BnbCard, BscChainBadge, PlatformBadge } from './BnbTheme';

interface PreviewProps {
  name: string;
  platform: string;
  platformId: string;
  avatar: string;
  description: string;
  skills: string[];
}

export function AgentPreviewCard({ name, platform, platformId, avatar, description, skills }: PreviewProps) {
  return (
    <BnbCard className="p-5 relative overflow-hidden">
      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F0B90B]/60 to-transparent" />
      
      <div className="text-[10px] text-[#848E9C] mb-3 uppercase tracking-wider">Preview</div>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-lg bg-[#0B0E11] border border-[#2B3139] flex-shrink-0 overflow-hidden">
          {avatar ? (
            <img src={avatar} alt={name || 'Agent'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-[#848E9C]">🤖</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-[#EAECEF]">{name || 'Agent Name'}</h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded font-mono">
              #NEW
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <PlatformBadge platform={platform} />
            <span className="text-[#848E9C] text-xs">@{platformId || '...'}</span>
            <BscChainBadge />
          </div>
        </div>
      </div>

      {description && (
        <p className="text-sm text-[#848E9C] mt-3 leading-relaxed">{description}</p>
      )}

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {skills.map((skill, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded-full">
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-[#848E9C] pt-3 mt-3 border-t border-[#2B3139]">
        <span>⛓ Soulbound · ERC-721</span>
        <span>BSC Mainnet</span>
      </div>
    </BnbCard>
  );
}
