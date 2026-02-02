'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useReadContract } from 'wagmi';
import { useI18n } from '@/lib/i18n';
import { SYNTHID_ABI, SYNTHID_ADDRESS } from '@/lib/synthid';
import { BnbThemeProvider, BnbCard, BscChainBadge, PlatformBadge, BnbBadge, BnbButton } from '@/components/identity/BnbTheme';
import { IdentityNav } from '@/components/identity/IdentityNav';

const PLATFORM_LINKS: Record<string, (id: string) => string> = {
  moltbook: (id) => `https://moltbook.com/u/${id}`,
  twitter: (id) => `https://x.com/${id}`,
};

export default function AgentDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const agentId = Number(params.id);

  const { data: identityData, isLoading: idLoading, error: idError } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'getAgentIdentity',
    args: [BigInt(agentId)],
    query: { enabled: agentId > 0 },
  });

  const { data: profileData, isLoading: profLoading } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'getAgentProfile',
    args: [BigInt(agentId)],
    query: { enabled: agentId > 0 },
  });

  const isLoading = idLoading || profLoading;

  // Parse data
  const identity = identityData as [string, string, string, string, bigint, string, boolean] | undefined;
  const profile = profileData as [string, string, string[]] | undefined;

  const name = identity?.[0] || '';
  const platform = identity?.[1] || '';
  const platformId = identity?.[2] || '';
  const agentURI = identity?.[3] || '';
  const createdAt = identity?.[4] ? Number(identity[4]) : 0;
  const owner = identity?.[5] || '';
  const revoked = identity?.[6] || false;
  const avatar = profile?.[0] || '';
  const description = profile?.[1] || '';
  const skills = profile?.[2] || [];

  // Loading skeleton
  if (isLoading) {
    return (
      <BnbThemeProvider>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <IdentityNav />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2">
              <BnbCard className="p-6 animate-pulse">
                <div className="flex items-start gap-5">
                  <div className="w-24 h-24 rounded-xl bg-[#2B3139]" />
                  <div className="flex-1 space-y-3">
                    <div className="h-6 w-48 bg-[#2B3139] rounded" />
                    <div className="h-4 w-32 bg-[#2B3139] rounded" />
                    <div className="h-4 w-24 bg-[#2B3139] rounded" />
                  </div>
                </div>
              </BnbCard>
            </div>
            <div>
              <BnbCard className="p-6 animate-pulse space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 bg-[#2B3139] rounded" />
                ))}
              </BnbCard>
            </div>
          </div>
        </div>
      </BnbThemeProvider>
    );
  }

  // Not found
  if (idError || !name) {
    return (
      <BnbThemeProvider>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <IdentityNav />
          <BnbCard className="p-12 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-[#EAECEF] mb-2">{t('sid.detail.notFound')}</h3>
            <p className="text-sm text-[#848E9C] mb-6">{t('sid.detail.notFoundDesc')}</p>
            <Link href="/identity/agents">
              <BnbButton variant="secondary">{t('sid.detail.backToRegistry')}</BnbButton>
            </Link>
          </BnbCard>
        </div>
      </BnbThemeProvider>
    );
  }

  const dateStr = new Date(createdAt * 1000).toLocaleString();
  const platformLink = PLATFORM_LINKS[platform]?.(platformId) || '#';

  return (
    <BnbThemeProvider>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <IdentityNav />

        <Link href="/identity/agents" className="inline-flex items-center text-sm text-[#848E9C] hover:text-[#EAECEF] transition-colors mb-6">
          {t('sid.detail.backToRegistry')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Identity Card */}
          <div className="lg:col-span-2 space-y-6">
            <BnbCard className="p-6 relative overflow-hidden">
              {/* Top accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F0B90B]/60 to-transparent" />

              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-[#0B0E11] border-2 border-[#F0B90B]/20 flex-shrink-0 overflow-hidden">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-[#848E9C]">🤖</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h1 className="text-2xl font-bold text-[#EAECEF]">{name}</h1>
                    <span className="text-xs px-2 py-0.5 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded font-mono font-bold">
                      #{agentId}
                    </span>
                    {revoked ? (
                      <BnbBadge variant="red">🚫 REVOKED</BnbBadge>
                    ) : (
                      <BnbBadge variant="green">⛓ {t('sid.detail.soulbound')}</BnbBadge>
                    )}
                  </div>

                  {/* Platform */}
                  <a
                    href={platformLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm hover:opacity-80 transition-opacity mb-3"
                  >
                    <PlatformBadge platform={platform} />
                    <span className="text-[#848E9C]">@{platformId}</span>
                    <span className="text-[10px] text-[#848E9C]">↗</span>
                  </a>

                  {/* Chain badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <BscChainBadge />
                    <BnbBadge variant="muted">{t('sid.detail.nonTransferable')}</BnbBadge>
                  </div>
                </div>
              </div>

              {/* Description */}
              {description && (
                <div className="mt-4 pt-4 border-t border-[#2B3139]">
                  <p className="text-sm text-[#EAECEF] leading-relaxed">{description}</p>
                </div>
              )}

              {/* Skills */}
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {skills.map((skill, i) => (
                    <span
                      key={i}
                      className="text-xs px-3 py-1 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded-full font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </BnbCard>

            {/* Agent URI */}
            {agentURI && (
              <BnbCard className="p-6">
                <h2 className="text-base font-bold text-[#EAECEF] mb-2">{t('sid.detail.metadata')}</h2>
                <div className="flex items-start gap-3 py-2">
                  <span className="text-xs text-[#F0B90B] font-mono min-w-[100px] flex-shrink-0">agentURI</span>
                  <a
                    href={agentURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#EAECEF] font-mono break-all hover:text-[#F0B90B] transition-colors"
                  >
                    {agentURI} ↗
                  </a>
                </div>
              </BnbCard>
            )}
          </div>

          {/* Sidebar - On-chain data */}
          <div className="space-y-6">
            <BnbCard className="p-6">
              <h2 className="text-base font-bold text-[#EAECEF] mb-4">{t('sid.detail.onChainData')}</h2>
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] text-[#848E9C] uppercase tracking-wider">{t('sid.detail.tokenId')}</span>
                  <p className="text-sm text-[#EAECEF] font-mono mt-0.5">{agentId}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#848E9C] uppercase tracking-wider">{t('sid.detail.owner')}</span>
                  <a
                    href={`https://bscscan.com/address/${owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-[#EAECEF] font-mono mt-0.5 break-all hover:text-[#F0B90B] transition-colors"
                  >
                    {owner}
                  </a>
                </div>
                <div>
                  <span className="text-[10px] text-[#848E9C] uppercase tracking-wider">{t('sid.detail.createdAt')}</span>
                  <p className="text-sm text-[#EAECEF] mt-0.5">{dateStr}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#848E9C] uppercase tracking-wider">{t('sid.detail.chain')}</span>
                  <div className="mt-1"><BscChainBadge /></div>
                </div>
                <div>
                  <span className="text-[10px] text-[#848E9C] uppercase tracking-wider">{t('sid.detail.standard')}</span>
                  <p className="text-sm text-[#EAECEF] mt-0.5">ERC-721 / ERC-8004</p>
                </div>
              </div>
            </BnbCard>

            {/* BscScan link */}
            <a
              href={`https://bscscan.com/token/${SYNTHID_ADDRESS}?a=${agentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <BnbCard hover className="p-4 flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center text-sm">🔎</div>
                  <span className="text-sm text-[#EAECEF] group-hover:text-[#F0B90B] transition-colors">
                    {t('sid.detail.viewOnBscscan')}
                  </span>
                </div>
                <span className="text-[#848E9C] group-hover:text-[#F0B90B] transition-colors">↗</span>
              </BnbCard>
            </a>

            {/* Platform link */}
            {platformLink !== '#' && (
              <a
                href={platformLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <BnbCard hover className="p-4 flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center text-sm">
                      {platform === 'moltbook' ? '🦞' : '𝕏'}
                    </div>
                    <span className="text-sm text-[#EAECEF] group-hover:text-[#F0B90B] transition-colors">
                      View on {platform === 'moltbook' ? 'Moltbook' : 'Twitter'}
                    </span>
                  </div>
                  <span className="text-[#848E9C] group-hover:text-[#F0B90B] transition-colors">↗</span>
                </BnbCard>
              </a>
            )}
          </div>
        </div>
      </div>
    </BnbThemeProvider>
  );
}
