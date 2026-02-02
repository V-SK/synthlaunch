'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { SYNTHID_ADDRESS } from '@/lib/synthid';
import { useAllAgents } from '@/hooks/useSynthID';
import { BnbThemeProvider, BnbButton, BscChainBadge } from '@/components/identity/BnbTheme';
import { IdentityNav } from '@/components/identity/IdentityNav';
import { SearchBar } from '@/components/identity/SearchBar';
import { StatsCards } from '@/components/identity/StatsCards';
import { AgentCardCompact } from '@/components/identity/AgentCard';
import { FeatureCards } from '@/components/identity/FeatureCards';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function IdentityPageInner() {
  const { t } = useI18n();
  const carouselRef = useRef<HTMLDivElement>(null);
  const { agents, isLoading, totalMinted, activeCount } = useAllAgents();

  const latestAgents = [...agents]
    .filter(a => !a.revoked)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);

  const stats = [
    { label: t('sid.statsAgents'), value: isLoading ? '...' : agents.filter(a => !a.revoked).length, icon: '🤖' },
    { label: t('sid.statsMints'), value: isLoading ? '...' : (totalMinted || agents.length), icon: '🔨' },
    { label: t('sid.statsActive'), value: isLoading ? '...' : (activeCount || agents.filter(a => !a.revoked).length), icon: '⚡' },
  ];

  const scrollCarousel = (dir: number) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir * 240, behavior: 'smooth' });
    }
  };

  return (
    <BnbThemeProvider>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <IdentityNav />

        {/* Hero */}
        <section className="text-center py-12 relative">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#F0B90B]/5 rounded-full blur-[100px]" />
          </div>

          <div className="relative">
            <div className="flex items-center justify-center gap-3 mb-4">
              <BscChainBadge />
              <span className="text-[10px] px-2 py-0.5 bg-[#0ECB81]/10 text-[#0ECB81] border border-[#0ECB81]/20 rounded font-mono">
                ERC-8004
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-[#EAECEF] mb-2">
              <span className="text-[#F0B90B]">{t('sid.heroTitle')}</span>
            </h1>
            <h2 className="text-xl md:text-2xl text-[#EAECEF] mb-4 font-medium">
              {t('sid.heroSubtitle')}
            </h2>
            <p className="text-sm md:text-base text-[#848E9C] max-w-2xl mx-auto leading-relaxed mb-8">
              {t('sid.heroDesc')}
            </p>

            {/* Search */}
            <SearchBar />
          </div>
        </section>

        {/* Stats */}
        <section className="mb-12">
          <StatsCards stats={stats} />
        </section>

        {/* Latest Agents Carousel */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#EAECEF]">{t('sid.latestAgents')}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => scrollCarousel(-1)} className="w-8 h-8 rounded-lg bg-[#1E2329] border border-[#2B3139] text-[#848E9C] hover:text-[#EAECEF] hover:border-[#F0B90B]/40 transition-all flex items-center justify-center">
                ‹
              </button>
              <button onClick={() => scrollCarousel(1)} className="w-8 h-8 rounded-lg bg-[#1E2329] border border-[#2B3139] text-[#848E9C] hover:text-[#EAECEF] hover:border-[#F0B90B]/40 transition-all flex items-center justify-center">
                ›
              </button>
              <Link href="/identity/agents" className="text-sm text-[#F0B90B] hover:text-[#F0B90B]/80 transition-colors ml-2">
                {t('sid.viewAll')}
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="min-w-[220px] max-w-[220px] h-[88px] rounded-xl bg-[#1E2329] animate-pulse" />
              ))}
            </div>
          ) : latestAgents.length === 0 ? (
            <div className="text-center py-8 text-[#848E9C] text-sm">
              {t('sid.agents.noResults') || 'No agents yet. Be the first to register!'}
            </div>
          ) : (
            <div
              ref={carouselRef}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {latestAgents.map(agent => (
                <AgentCardCompact key={agent.agentId} agent={agent} />
              ))}
            </div>
          )}
        </section>

        {/* Register CTA */}
        <section className="mb-12">
          <div className="bg-gradient-to-r from-[#F0B90B]/10 via-[#F0B90B]/5 to-transparent border border-[#F0B90B]/20 rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-[#EAECEF] mb-1">{t('sid.registerCta')}</h3>
              <p className="text-sm text-[#848E9C]">{t('sid.registerCtaDesc')}</p>
            </div>
            <Link href="/identity/register">
              <BnbButton variant="primary" className="whitespace-nowrap text-base px-8 py-3">
                {t('sid.registerCta')} →
              </BnbButton>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="mb-12">
          <FeatureCards />
        </section>

        {/* Footer */}
        <footer className="border-t border-[#2B3139] pt-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#848E9C]">
          <div className="flex items-center gap-4">
            <span className="text-[#F0B90B] font-bold">SynthID</span>
            <span>{t('sid.footerBuilt')}</span>
            <span>{t('sid.footerProtocol')}</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`https://bscscan.com/address/${SYNTHID_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#EAECEF] transition-colors font-mono text-[10px]"
            >
              {SYNTHID_ADDRESS.slice(0, 6)}...{SYNTHID_ADDRESS.slice(-4)}
            </a>
            <Link href="/identity/agents" className="hover:text-[#EAECEF] transition-colors">Registry</Link>
            <Link href="/identity/register" className="hover:text-[#EAECEF] transition-colors">Register</Link>
            <a href="https://github.com/V-SK/synthlaunch" target="_blank" rel="noopener noreferrer" className="hover:text-[#EAECEF] transition-colors">GitHub</a>
            <a href="https://x.com/synth_fun" target="_blank" rel="noopener noreferrer" className="hover:text-[#EAECEF] transition-colors">Twitter</a>
          </div>
        </footer>
      </div>
    </BnbThemeProvider>
  );
}

export default function IdentityPage() {
  return (
    <ErrorBoundary>
      <IdentityPageInner />
    </ErrorBoundary>
  );
}
