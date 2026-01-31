'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { WalletConnect } from './WalletConnect';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-synth-border bg-synth-bg/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-synth-green glow-text-green tracking-wider">
              synthlaunch
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-synth-cyan/20 text-synth-cyan border border-synth-cyan/30 rounded font-mono uppercase tracking-widest">
              beta
            </span>
          </div>
          <span className="hidden lg:inline text-[10px] text-synth-muted font-mono">
            AI agent token launches
          </span>
        </Link>

        {/* Navigation */}
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
        <WalletConnect />
      </div>
    </header>
  );
}
