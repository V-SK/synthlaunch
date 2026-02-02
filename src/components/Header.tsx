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
    { label: t('nav.claim'), href: '/claim' },
    { label: t('nav.leaderboard'), href: '/leaderboard' },
    { label: t('nav.identity'), href: '/identity' },
  ];

  return (
    <header className="border-b border-synth-border bg-synth-bg/95 backdrop-blur-md fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1 p-2 -ml-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          <span className={`block w-5 h-0.5 bg-synth-green transition-transform ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`block w-5 h-0.5 bg-synth-green transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-synth-green transition-transform ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.jpg"
              alt="SynthLaunch Logo"
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="text-xl font-bold text-synth-green glow-text-green tracking-wider">
              synthlaunch
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-synth-cyan/20 text-synth-cyan border border-synth-cyan/30 rounded font-mono uppercase tracking-widest">
              beta
            </span>
          </div>
          <span className="hidden lg:inline text-[10px] text-synth-muted font-mono">
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

        {/* Wallet (language toggle moved to nav areas) */}
        <div className="flex items-center gap-2">
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
