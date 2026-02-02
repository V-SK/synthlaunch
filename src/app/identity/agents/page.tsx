'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useAllAgents, type OnChainAgent } from '@/hooks/useSynthID';
import { BnbThemeProvider, BnbCard, BscChainBadge, PlatformBadge, BnbButton } from '@/components/identity/BnbTheme';
import { IdentityNav } from '@/components/identity/IdentityNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const ITEMS_PER_PAGE = 10;

function searchAgentsLocal(agents: OnChainAgent[], query: string): OnChainAgent[] {
  const q = query.toLowerCase();
  return agents.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.platformId.toLowerCase().includes(q) ||
    a.owner.toLowerCase().includes(q) ||
    a.description.toLowerCase().includes(q) ||
    a.skills.some(s => s.toLowerCase().includes(q))
  );
}

function AgentsPageInner() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { agents: allAgents, isLoading } = useAllAgents();

  const [query, setQuery] = useState(initialQuery);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name'>('newest');
  const [page, setPage] = useState(1);

  const filteredAgents = useMemo(() => {
    let agents = query ? searchAgentsLocal(allAgents, query) : [...allAgents];

    if (platformFilter !== 'all') {
      agents = agents.filter(a => a.platform === platformFilter);
    }

    if (sortBy === 'newest') {
      agents.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      agents.sort((a, b) => a.name.localeCompare(b.name));
    }

    return agents;
  }, [allAgents, query, platformFilter, sortBy]);

  const totalPages = Math.ceil(filteredAgents.length / ITEMS_PER_PAGE);
  const paginatedAgents = filteredAgents.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString();
  const truncAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const filters = [
    { key: 'all', label: t('sid.agents.filterAll') },
    { key: 'moltbook', label: t('sid.agents.filterMoltbook') },
    { key: 'custom', label: t('sid.agents.filterCustom') },
  ];

  // Pagination with ellipsis
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <BnbThemeProvider>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <IdentityNav />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#EAECEF] mb-1">{t('sid.agents.title')}</h1>
          <p className="text-sm text-[#848E9C]">{t('sid.agents.subtitle')}</p>
        </div>

        {/* Filters */}
        <BnbCard className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#848E9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder={t('sid.agents.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors"
              />
            </div>

            {/* Platform filter */}
            <div className="flex items-center gap-1">
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setPlatformFilter(f.key); setPage(1); }}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                    platformFilter === f.key
                      ? 'bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/30'
                      : 'text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#1E2329] border border-transparent'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSortBy('newest')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  sortBy === 'newest'
                    ? 'bg-[#2B3139] text-[#EAECEF]'
                    : 'text-[#848E9C] hover:text-[#EAECEF]'
                }`}
              >
                {t('sid.agents.sortNewest')}
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  sortBy === 'name'
                    ? 'bg-[#2B3139] text-[#EAECEF]'
                    : 'text-[#848E9C] hover:text-[#EAECEF]'
                }`}
              >
                {t('sid.agents.sortName')}
              </button>
            </div>
          </div>
        </BnbCard>

        {/* Loading state */}
        {isLoading ? (
          <BnbCard className="p-8">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-[#2B3139]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-[#2B3139] rounded" />
                    <div className="h-3 w-48 bg-[#2B3139] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </BnbCard>
        ) : (
          <>
            {/* Table */}
            <BnbCard className="overflow-hidden mb-6">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2B3139]">
                      <th className="text-left text-xs text-[#848E9C] font-medium px-4 py-3">{t('sid.agents.colName')}</th>
                      <th className="text-left text-xs text-[#848E9C] font-medium px-4 py-3">{t('sid.agents.colChain')}</th>
                      <th className="text-left text-xs text-[#848E9C] font-medium px-4 py-3">{t('sid.agents.colPlatform')}</th>
                      <th className="text-left text-xs text-[#848E9C] font-medium px-4 py-3">{t('sid.agents.colSkills')}</th>
                      <th className="text-left text-xs text-[#848E9C] font-medium px-4 py-3">{t('sid.agents.colOwner')}</th>
                      <th className="text-left text-xs text-[#848E9C] font-medium px-4 py-3">{t('sid.agents.colCreated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAgents.map(agent => (
                      <tr key={agent.agentId} className="border-b border-[#2B3139]/50 hover:bg-[#1E2329]/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/identity/agent/${agent.agentId}`} className="flex items-center gap-3 group">
                            <div className="w-8 h-8 rounded-lg bg-[#0B0E11] border border-[#2B3139] flex-shrink-0 overflow-hidden group-hover:border-[#F0B90B]/40 transition-colors">
                              {agent.avatar ? (
                                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-sm text-[#848E9C]">🤖</div>
                              )}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-[#EAECEF] group-hover:text-[#F0B90B] transition-colors">{agent.name}</span>
                              <span className="text-[10px] text-[#848E9C] ml-2">#{agent.agentId}</span>
                              {agent.revoked && (
                                <span className="text-[10px] text-[#F6465D] ml-2">REVOKED</span>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3"><BscChainBadge /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <PlatformBadge platform={agent.platform} />
                            <span className="text-xs text-[#848E9C]">@{agent.platformId}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {agent.skills.slice(0, 3).map((s, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#2B3139] text-[#848E9C] rounded">{s}</span>
                            ))}
                            {agent.skills.length > 3 && (
                              <span className="text-[10px] text-[#848E9C]">+{agent.skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://bscscan.com/address/${agent.owner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#848E9C] font-mono hover:text-[#F0B90B] transition-colors"
                          >
                            {truncAddr(agent.owner)}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-[#848E9C]">{formatDate(agent.createdAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#2B3139]">
                {paginatedAgents.map(agent => (
                  <Link key={agent.agentId} href={`/identity/agent/${agent.agentId}`} className="block p-4 hover:bg-[#1E2329]/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#0B0E11] border border-[#2B3139] flex-shrink-0 overflow-hidden">
                        {agent.avatar ? (
                          <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg text-[#848E9C]">🤖</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#EAECEF] truncate">{agent.name}</span>
                          <span className="text-[10px] text-[#F0B90B]">#{agent.agentId}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <PlatformBadge platform={agent.platform} />
                          <BscChainBadge />
                          <span className="text-[10px] text-[#848E9C]">{formatDate(agent.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {filteredAgents.length === 0 && (
                <div className="text-center py-12 text-[#848E9C] text-sm">{t('sid.agents.noResults')}</div>
              )}
            </BnbCard>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#848E9C]">
                  {t('sid.agents.showingOf', {
                    from: String((page - 1) * ITEMS_PER_PAGE + 1),
                    to: String(Math.min(page * ITEMS_PER_PAGE, filteredAgents.length)),
                    total: String(filteredAgents.length),
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <BnbButton
                    variant="secondary"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-xs px-3 py-1.5"
                  >
                    ‹
                  </BnbButton>
                  {getPageNumbers().map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-[#848E9C]">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs transition-all ${
                          p === page
                            ? 'bg-[#F0B90B] text-[#0B0E11] font-bold'
                            : 'text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#1E2329]'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <BnbButton
                    variant="secondary"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="text-xs px-3 py-1.5"
                  >
                    ›
                  </BnbButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </BnbThemeProvider>
  );
}

export default function AgentsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-[#0B0E11]" />}>
        <AgentsPageInner />
      </Suspense>
    </ErrorBoundary>
  );
}
