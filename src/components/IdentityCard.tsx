'use client';

import { useI18n } from '@/lib/i18n';

interface IdentityCardProps {
  agentId: number;
  name: string;
  platform: string;
  platformId: string;
  avatar: string;
  description: string;
  skills: string[];
  createdAt: number; // unix timestamp
  owner: string;
}

const PLATFORM_BADGES: Record<string, { emoji: string; label: string; link: (id: string) => string }> = {
  moltbook: { emoji: '🦞', label: 'Moltbook', link: (id) => `https://moltbook.com/u/${id}` },
  twitter: { emoji: '🐦', label: 'Twitter', link: (id) => `https://x.com/${id}` },
};

export function IdentityCard({
  agentId,
  name,
  platform,
  platformId,
  avatar,
  description,
  skills,
  createdAt,
  owner,
}: IdentityCardProps) {
  const { t } = useI18n();
  const badge = PLATFORM_BADGES[platform] || { emoji: '🔗', label: platform, link: () => '#' };
  const platformLink = badge.link(platformId);
  const dateStr = createdAt > 0 ? new Date(createdAt * 1000).toLocaleDateString() : '—';

  return (
    <div className="bg-synth-surface border border-synth-border rounded-xl p-5 space-y-4 relative overflow-hidden">
      {/* Header glow line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-synth-green/0 via-synth-green/60 to-synth-green/0" />

      {/* Top row: avatar + name */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-lg bg-synth-bg border border-synth-border flex-shrink-0 overflow-hidden">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-synth-muted">
              🤖
            </div>
          )}
        </div>

        {/* Name + platform */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-synth-text truncate">{name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-synth-green/15 text-synth-green border border-synth-green/30 rounded font-mono">
              #{agentId}
            </span>
          </div>
          <a
            href={platformLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-synth-cyan hover:underline flex items-center gap-1 mt-0.5"
          >
            <span>{badge.emoji}</span>
            <span>{badge.label}</span>
            <span className="text-synth-muted">@{platformId}</span>
          </a>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-synth-muted leading-relaxed">{description}</p>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 bg-synth-purple/15 text-synth-purple border border-synth-purple/30 rounded-full font-mono"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-synth-muted pt-2 border-t border-synth-border">
        <div className="flex items-center gap-3">
          <span>{t('identity.registered')}: {dateStr}</span>
          <span className="text-synth-green/60">⛓ {t('identity.soulbound')}</span>
        </div>
        <span className="font-mono">{owner.slice(0, 6)}...{owner.slice(-4)}</span>
      </div>
    </div>
  );
}
