'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { t } = useI18n();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/identity/agents?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#848E9C]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sid.searchPlaceholder')}
          className="w-full pl-12 pr-28 py-3.5 bg-[#1E2329] border border-[#2B3139] rounded-xl text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 focus:shadow-[0_0_0_2px_rgba(240,185,11,0.1)] transition-all"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-[#0B0E11] font-bold text-sm rounded-lg transition-colors"
        >
          {t('sid.search')}
        </button>
      </div>
    </form>
  );
}
