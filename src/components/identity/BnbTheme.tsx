'use client';

import React from 'react';

// BNB Theme wrapper — applies BNB color scheme via CSS variables
export function BnbThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <div className="bnb-theme min-h-screen" style={{
      ['--bnb-yellow' as string]: '#F0B90B',
      ['--bnb-dark' as string]: '#0B0E11',
      ['--bnb-card' as string]: '#1E2329',
      ['--bnb-border' as string]: '#2B3139',
      ['--bnb-text' as string]: '#EAECEF',
      ['--bnb-muted' as string]: '#848E9C',
      ['--bnb-green' as string]: '#0ECB81',
      ['--bnb-red' as string]: '#F6465D',
      backgroundColor: '#0B0E11',
      color: '#EAECEF',
    }}>
      {children}
    </div>
  );
}

// Reusable BNB-themed components
export function BnbBadge({ children, variant = 'yellow' }: { children: React.ReactNode; variant?: 'yellow' | 'green' | 'red' | 'muted' }) {
  const colors = {
    yellow: 'bg-[#F0B90B]/15 text-[#F0B90B] border-[#F0B90B]/30',
    green: 'bg-[#0ECB81]/15 text-[#0ECB81] border-[#0ECB81]/30',
    red: 'bg-[#F6465D]/15 text-[#F6465D] border-[#F6465D]/30',
    muted: 'bg-[#848E9C]/15 text-[#848E9C] border-[#848E9C]/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 border rounded-full font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

export function BnbCard({ children, className = '', hover = false }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`bg-[#1E2329] border border-[#2B3139] rounded-xl ${hover ? 'hover:border-[#F0B90B]/40 hover:shadow-[0_0_20px_rgba(240,185,11,0.08)] transition-all duration-300' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function BnbButton({ children, onClick, disabled, variant = 'primary', className = '', type = 'button' }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-[#0B0E11] font-bold',
    secondary: 'bg-[#2B3139] hover:bg-[#2B3139]/80 text-[#EAECEF] border border-[#2B3139]',
    ghost: 'bg-transparent hover:bg-[#1E2329] text-[#848E9C] hover:text-[#EAECEF]',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function BscChainBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded font-mono">
      <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
        <path d="M16 0L19.88 3.88L9.88 13.88L6 10L16 0Z" fill="#F0B90B"/>
        <path d="M22.12 6.12L26 10L16 20L12.12 16.12L22.12 6.12Z" fill="#F0B90B"/>
        <path d="M28.12 12.12L32 16L28.12 19.88L24.24 16L28.12 12.12Z" fill="#F0B90B"/>
        <path d="M3.88 12.12L7.76 16L3.88 19.88L0 16L3.88 12.12Z" fill="#F0B90B"/>
        <path d="M16 12.12L19.88 16L16 19.88L12.12 16L16 12.12Z" fill="#F0B90B"/>
        <path d="M9.88 18.12L16 24.24L22.12 18.12L26 22L16 32L6 22L9.88 18.12Z" fill="#F0B90B"/>
      </svg>
      BSC
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  const badges: Record<string, { emoji: string; label: string; color: string }> = {
    moltbook: { emoji: '🦞', label: 'Moltbook', color: 'text-orange-400' },
    twitter: { emoji: '𝕏', label: 'Twitter', color: 'text-white' },
    custom: { emoji: '🔗', label: 'Custom', color: 'text-[#848E9C]' },
  };
  const b = badges[platform] || badges.custom;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${b.color}`}>
      <span>{b.emoji}</span>
      <span>{b.label}</span>
    </span>
  );
}
