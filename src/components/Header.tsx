'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { WalletConnect } from './WalletConnect';
import { useI18n, LanguageToggle } from '@/lib/i18n';

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  const NAV_ITEMS = [
    { label: t('nav.home'), href: '/' },
    { label: t('nav.launch'), href: '/launch' },
    { label: `⚡ ${t('nav.mint')}`, href: '/mint' },
    { label: t('nav.claim'), href: '/claim' },
    { label: t('nav.leaderboard'), href: '/leaderboard' },
    { label: t('nav.identity'), href: '/identity' },
  ];

  return (
    <header className="border-b border-synth-border bg-synth-bg/95 backdrop-blur-md fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-3 md:px-4 h-12 md:h-14 flex items-center justify-between gap-2">
        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1 p-1.5 -ml-1 flex-shrink-0"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          <span className={`block w-4 h-0.5 bg-synth-green transition-transform ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`block w-4 h-0.5 bg-synth-green transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-4 h-0.5 bg-synth-green transition-transform ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 min-w-0 flex-shrink-1">
          <Image
            src="/logo.jpg"
            alt="SynthLaunch Logo"
            width={28}
            height={28}
            className="rounded-md flex-shrink-0 md:w-8 md:h-8"
          />
          <span className="text-base md:text-xl font-bold text-synth-green glow-text-green tracking-wider truncate">
            synthlaunch
          </span>
          <span className="hidden lg:inline text-[10px] text-synth-muted font-mono flex-shrink-0">
            {t('header.tagline')}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded text-sm font-mono transition-all duration-200 ${
                pathname === item.href
                  ? 'text-synth-green bg-synth-green/10'
                  : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden md:block"><LanguageToggle /></div>
          <WalletConnect />
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-synth-border bg-synth-bg/95 backdrop-blur-md px-4 py-2 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2 rounded text-sm font-mono transition-all duration-200 ${
                pathname === item.href
                  ? 'text-synth-green bg-synth-green/10'
                  : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="px-3 py-2 border-t border-synth-border mt-1 pt-2">
            <LanguageToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
