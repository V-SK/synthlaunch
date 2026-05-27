'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { WalletConnect } from './WalletConnect';
import { WalletDownload } from './WalletDownload';
import { useI18n, LanguageToggle } from '@/lib/i18n';
import { isAdminAddress } from '@/lib/admin';

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { locale, t } = useI18n();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { address } = useAccount();

  const isAdmin = isMounted && isAdminAddress(address);

  const MENU_ITEMS = [
    { label: t('nav.ai'), href: '/ai' },
    { label: locale === 'zh' ? 'FanFi 竞技场' : 'FanFi Arena', href: '/fanfi/xcup' },
    { label: locale === 'zh' ? 'Hook 控制台' : 'Build X Hook', href: '/build-x-hook' },
    { label: t('nav.launch'), href: '/launch' },
    { label: t('nav.tokens'), href: '/tokens' },
    { label: t('nav.claim'), href: '/claim' },
    { label: 'Alice Wallet', href: '/alice-wallet' },
    { label: t('nav.docs'), href: '/docs' },
    ...(isAdmin ? [
      { label: 'Admin', href: '/admin/alice' },
    ] : []),
  ];

  const getNavItemClasses = (item: { href: string }) => {
    const isActive = pathname === item.href;
    return isActive
      ? 'text-synth-green bg-synth-green/10'
      : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface';
  };

  const isMenuActive = MENU_ITEMS.some((item) => pathname === item.href);
  const getMenuButtonClasses = (isOpen: boolean) =>
    isMenuActive || isOpen
      ? 'text-synth-green bg-synth-green/10'
      : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
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

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden md:block">
            <LanguageToggle />
          </div>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className={`flex flex-col gap-1 p-2 rounded transition-all duration-200 ${getMenuButtonClasses(menuOpen)}`}
              aria-label="Menu"
            >
              <span className={`block w-4 h-0.5 bg-current transition-transform ${menuOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
              <span className={`block w-4 h-0.5 bg-current transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-4 h-0.5 bg-current transition-transform ${menuOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 rounded-md border border-synth-border bg-synth-bg/95 backdrop-blur-md shadow-lg shadow-black/40 py-1"
              >
                {MENU_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className={`block px-3 py-2 text-sm font-mono transition-all duration-200 ${getNavItemClasses(item)}`}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="px-3 py-2 border-t border-synth-border md:hidden">
                  <LanguageToggle />
                </div>
              </div>
            )}
          </div>
          <WalletDownload />
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
