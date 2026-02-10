'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { WalletConnect } from './WalletConnect';
import { useI18n, LanguageToggle } from '@/lib/i18n';

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopToolsOpen, setDesktopToolsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const { isConnected } = useAccount();
  const { t } = useI18n();
  const desktopToolsRef = useRef<HTMLDivElement | null>(null);

  const MAIN_ITEMS = [
    { label: t('nav.home'), href: '/' },
    { label: `🤖 ${t('nav.nfa')}`, href: '/nfa', highlight: true },
    { label: t('nav.dashboard'), href: '/dashboard', highlight: true },
    { label: t('nav.chat'), href: '/chat' },
  ];

  const DROPDOWN_ITEMS = [
    { label: `🚀 ${t('nav.launch')}`, href: '/launch' },
    { label: t('nav.claim'), href: '/claim' },
    { label: t('nav.leaderboard'), href: '/leaderboard' },
    { label: t('nav.docs'), href: '/docs' },
  ];

  const getNavItemClasses = (item: { href: string; highlight?: boolean }) => {
    const isActive = pathname === item.href;
    if (item.highlight) {
      return isActive
        ? 'text-synth-bg bg-synth-green'
        : 'text-synth-green bg-synth-green/20 hover:bg-synth-green/30';
    }
    return isActive
      ? 'text-synth-green bg-synth-green/10'
      : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface';
  };

  const isToolsActive = DROPDOWN_ITEMS.some((item) => pathname === item.href);
  const getToolsButtonClasses = (isOpen: boolean) =>
    isToolsActive || isOpen
      ? 'text-synth-green bg-synth-green/10'
      : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface';

  useEffect(() => {
    setDesktopToolsOpen(false);
    setMobileToolsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!desktopToolsRef.current) {
        return;
      }
      if (!desktopToolsRef.current.contains(event.target as Node)) {
        setDesktopToolsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  return (
    <header className="border-b border-synth-border bg-synth-bg/95 backdrop-blur-md fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-3 md:px-4 h-12 md:h-14 flex items-center justify-between gap-2">
        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1 p-1.5 -ml-1 flex-shrink-0"
          onClick={() => {
            setMobileOpen((open) => {
              const next = !open;
              if (!next) {
                setMobileToolsOpen(false);
              }
              return next;
            });
          }}
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
          {MAIN_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded text-sm font-mono transition-all duration-200 ${getNavItemClasses(item)}`}
            >
              {item.label}
            </Link>
          ))}
          <div ref={desktopToolsRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={desktopToolsOpen}
              onClick={() => setDesktopToolsOpen((open) => !open)}
              className={`px-3 py-1.5 rounded text-sm font-mono transition-all duration-200 inline-flex items-center gap-1 ${getToolsButtonClasses(desktopToolsOpen)}`}
            >
              更多
              <svg
                className={`w-3.5 h-3.5 transition-transform ${desktopToolsOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {desktopToolsOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-44 rounded-md border border-synth-border bg-synth-bg/95 backdrop-blur-md shadow-lg shadow-black/40 py-1"
              >
                {DROPDOWN_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setDesktopToolsOpen(false)}
                    className={`block px-3 py-2 text-sm font-mono transition-all duration-200 ${getNavItemClasses(item)}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
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
          {MAIN_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setMobileOpen(false);
                setMobileToolsOpen(false);
              }}
              className={`px-3 py-2 rounded text-sm font-mono transition-all duration-200 ${getNavItemClasses(item)}`}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            aria-expanded={mobileToolsOpen}
            onClick={() => setMobileToolsOpen((open) => !open)}
            className={`px-3 py-2 rounded text-sm font-mono transition-all duration-200 text-left ${getToolsButtonClasses(mobileToolsOpen)}`}
          >
            更多
          </button>
          {mobileToolsOpen && (
            <div className="flex flex-col gap-1 border-l border-synth-border/60 pl-3">
              {DROPDOWN_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setMobileOpen(false);
                    setMobileToolsOpen(false);
                  }}
                  className={`px-3 py-2 rounded text-sm font-mono transition-all duration-200 ${getNavItemClasses(item)}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
          <div className="px-3 py-2 border-t border-synth-border mt-1 pt-2">
            <LanguageToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
