'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { SYNTHID_ADDRESS } from '@/lib/synthid';
import { BnbThemeProvider, BnbCard, BscChainBadge, PlatformBadge, BnbBadge, BnbButton } from '@/components/identity/BnbTheme';
import { IdentityNav } from '@/components/identity/IdentityNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface AgentData {
  name: string;
  platform: string;
  platformId: string;
  agentURI: string;
  avatar: string;
  description: string;
  skills: string[];
  createdAt: string;
  owner: string;
  revoked: boolean;
}

interface MoltbookData {
  found: boolean;
  karma?: number;
  is_claimed?: boolean;
  post_count?: number;
  comment_count?: number;
}

const PLATFORM_LINKS: Record<string, (id: string) => string> = {
  moltbook: (id) => `https://www.moltbook.com/u/${id}`,
  twitter: (id) => `https://x.com/${id}`,
};

function AgentDetailPageInner() {
  const { t } = useI18n();
  const params = useParams();
  const rawId = typeof params.id === 'string' ? params.id : '0';
  const agentId = rawId;

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [moltbookData, setMoltbookData] = useState<MoltbookData | null>(null);

  const isZh = (() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('synthlaunch-lang') : null;
      if (saved === 'zh') return true;
      if (saved === 'en') return false;
      return typeof navigator !== 'undefined' && navigator.language?.startsWith('zh');
    } catch { return false; }
  })();

  // Fetch agent data from our API (reads from chain server-side)
  useEffect(() => {
    if (!agentId || agentId === '0') {
      setError(true);
      setLoading(false);
      return;
    }
    
    fetch(`/api/synthid/${agentId}`)
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(data => {
        // Parse from NFT metadata format
        const attrs = data.attributes || [];
        const getAttr = (key: string) => {
          const a = attrs.find((x: { trait_type: string; value: string }) => x.trait_type === key);
          return a?.value || '';
        };
        setAgent({
          name: getAttr('Name'),
          platform: getAttr('Platform'),
          platformId: getAttr('Platform ID'),
          agentURI: `https://synthlaunch.fun/api/synthid/${agentId}`,
          avatar: data.image || '',
          description: data.description?.replace(/^AI Agent Identity on BSC — \w+\. ?/, '') || '',
          skills: getAttr('Skills') ? getAttr('Skills').split(', ') : [],
          createdAt: getAttr('Created'),
          owner: getAttr('Owner'),
          revoked: getAttr('Status') === 'REVOKED',
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [agentId]);

  // Fetch Moltbook data
  useEffect(() => {
    if (agent?.platform === 'moltbook' && agent.platformId) {
      fetch(`/api/synthid/moltbook?name=${encodeURIComponent(agent.platformId)}`)
        .then(r => r.json())
        .then(d => setMoltbookData(d))
        .catch(() => setMoltbookData({ found: false }));
    }
  }, [agent?.platform, agent?.platformId]);

  // Loading
  if (loading) {
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
                {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-[#2B3139] rounded" />)}
              </BnbCard>
            </div>
          </div>
        </div>
      </BnbThemeProvider>
    );
  }

  // Not found
  if (error || !agent) {
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

  const platformLink = PLATFORM_LINKS[agent.platform]?.(agent.platformId) || '#';

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
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F0B90B]/60 to-transparent" />

              <div className="flex items-start gap-5">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-[#0B0E11] border-2 border-[#F0B90B]/20 flex-shrink-0 overflow-hidden">
                  {agent.avatar ? (
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-[#848E9C]">🤖</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h1 className="text-2xl font-bold text-[#EAECEF]">{agent.name}</h1>
                    <span className="text-xs px-2 py-0.5 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded font-mono font-bold">
                      #{agentId}
                    </span>
                    {agent.revoked ? (
                      <BnbBadge variant="red">🚫 REVOKED</BnbBadge>
                    ) : (
                      <BnbBadge variant="green">⛓ {t('sid.detail.soulbound')}</BnbBadge>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-2 text-sm mb-3">
                    <PlatformBadge platform={agent.platform} />
                    <span className="text-[#848E9C]">@{agent.platformId}</span>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <BscChainBadge />
                    <BnbBadge variant="muted">{t('sid.detail.nonTransferable')}</BnbBadge>
                  </div>
                </div>
              </div>

              {agent.description && (
                <div className="mt-4 pt-4 border-t border-[#2B3139]">
                  <p className="text-sm text-[#EAECEF] leading-relaxed">{agent.description}</p>
                </div>
              )}

              {agent.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {agent.skills.map((skill, i) => (
                    <span key={i} className="text-xs px-3 py-1 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded-full font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </BnbCard>

            {agent.agentURI && (
              <BnbCard className="p-6">
                <h2 className="text-base font-bold text-[#EAECEF] mb-2">{t('sid.detail.metadata')}</h2>
                <div className="flex items-start gap-3 py-2">
                  <span className="text-xs text-[#F0B90B] font-mono min-w-[100px] flex-shrink-0">agentURI</span>
                  <a href={agent.agentURI} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#EAECEF] font-mono break-all hover:text-[#F0B90B] transition-colors">
                    {agent.agentURI} ↗
                  </a>
                </div>
              </BnbCard>
            )}
          </div>

          {/* Sidebar */}
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
                  <a href={`https://bscscan.com/address/${agent.owner}`} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-[#EAECEF] font-mono mt-0.5 break-all hover:text-[#F0B90B] transition-colors">
                    {agent.owner}
                  </a>
                </div>
                <div>
                  <span className="text-[10px] text-[#848E9C] uppercase tracking-wider">{t('sid.detail.createdAt')}</span>
                  <p className="text-sm text-[#EAECEF] mt-0.5">{agent.createdAt}</p>
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

            <a href={`https://bscscan.com/token/${SYNTHID_ADDRESS}?a=${agentId}`} target="_blank" rel="noopener noreferrer" className="block">
              <BnbCard hover className="p-4 flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center text-sm">🔎</div>
                  <span className="text-sm text-[#EAECEF] group-hover:text-[#F0B90B] transition-colors">{t('sid.detail.viewOnBscscan')}</span>
                </div>
                <span className="text-[#848E9C] group-hover:text-[#F0B90B] transition-colors">↗</span>
              </BnbCard>
            </a>

            {/* Moltbook Verification Card */}
            {agent.platform === 'moltbook' && (
              <BnbCard className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🦞</span>
                  <h3 className="text-sm font-bold text-[#EAECEF]">Moltbook Verification</h3>
                </div>
                {!moltbookData ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-3 w-24 bg-[#2B3139] rounded" />
                    <div className="h-3 w-32 bg-[#2B3139] rounded" />
                  </div>
                ) : moltbookData.found ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-2.5 bg-[#0ECB81]/5 border border-[#0ECB81]/20 rounded-lg">
                      <span className="text-[#0ECB81] text-base">✓</span>
                      <span className="text-xs text-[#0ECB81] font-medium">
                        {moltbookData.is_claimed ? 'Verified & Claimed' : 'Registered'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-[#0B0E11] rounded-lg text-center">
                        <div className="text-sm font-bold text-[#F0B90B]">{moltbookData.karma || 0}</div>
                        <div className="text-[10px] text-[#848E9C]">Karma</div>
                      </div>
                      <div className="p-2 bg-[#0B0E11] rounded-lg text-center">
                        <div className="text-sm font-bold text-[#EAECEF]">{(moltbookData.post_count || 0) + (moltbookData.comment_count || 0)}</div>
                        <div className="text-[10px] text-[#848E9C]">Activity</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-[#848E9C] flex items-center gap-1">
                      🔗 Data from <span className="text-[#F0B90B]">moltbook.com</span> API · Live
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#F6465D]/5 border border-[#F6465D]/20 rounded-lg">
                    <span className="text-xs text-[#F6465D]">⚠ Unable to verify on Moltbook</span>
                  </div>
                )}
              </BnbCard>
            )}

            {agent.platform === 'twitter' && platformLink !== '#' && (
              <a href={platformLink} target="_blank" rel="noopener noreferrer" className="block">
                <BnbCard hover className="p-4 flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center text-sm">𝕏</div>
                    <span className="text-sm text-[#EAECEF] group-hover:text-[#F0B90B] transition-colors">View on Twitter</span>
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

export default function AgentDetailPage() {
  return (
    <ErrorBoundary>
      <AgentDetailPageInner />
    </ErrorBoundary>
  );
}
