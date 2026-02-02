'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

export function IdentityNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const links = [
    { href: '/identity', label: t('sid.nav.home') },
    { href: '/identity/agents', label: t('sid.nav.agents') },
    { href: '/identity/register', label: t('sid.nav.register') },
  ];

  return (
    <nav className="flex items-center gap-1 border-b border-[#2B3139] pb-3 mb-8 overflow-x-auto">
      <Link href="/" className="text-[#848E9C] hover:text-[#EAECEF] text-sm mr-2 transition-colors whitespace-nowrap">
        ← SynthLaunch
      </Link>
      <div className="w-px h-4 bg-[#2B3139] mx-2" />
      {links.map(link => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              active
                ? 'bg-[#F0B90B]/10 text-[#F0B90B]'
                : 'text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#1E2329]'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
