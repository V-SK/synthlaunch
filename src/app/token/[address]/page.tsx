'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { Token } from '@/lib/api';
import { formatPrice, formatMarketCap, formatTimeAgo, statusLabel } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export default function TokenPage({ params }: { params: { address: string } }) {
  const { t, locale } = useI18n();
  const isZh = locale === 'zh';
  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [taxRevenue, setTaxRevenue] = useState<{
    totalFeesBnb: number; totalFeesUsd: number;
    claimedBnb: number; claimedUsd: number;
    pendingBnb: number; pendingUsd: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/tokens?address=${params.address}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => {
        setToken(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch tax revenue data
    fetch('/api/leaderboard')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.entries) return;
        const entry = data.entries.find(
          (e: any) => e.tokenAddress?.toLowerCase() === params.address.toLowerCase()
        );
        if (entry) {
          setTaxRevenue({
            totalFeesBnb: entry.totalFeesBnb,
            totalFeesUsd: entry.totalFeesUsd,
            claimedBnb: entry.claimedBnb,
            claimedUsd: entry.claimedUsd,
            pendingBnb: entry.pendingBnb,
            pendingUsd: entry.pendingUsd,
          });
        }
      })
      .catch(() => {});
  }, [params.address]);

  const copyAddress = () => {
    navigator.clipboard.writeText(params.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
          {t('token.backToTokens')}
        </Link>
        <div className="card animate-pulse py-20 text-center">
          <span className="text-synth-muted">{t('token.loadingToken')}</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
          {t('token.backToTokens')}
        </Link>
        <div className="card py-20 text-center space-y-4">
          <span className="text-3xl">🔍</span>
          <p className="text-synth-muted">{t('token.notFound')}</p>
          <p className="text-xs text-synth-muted">
            {t('token.notFoundDesc')}
          </p>
        </div>
      </div>
    );
  }

  const isOnDex = token.status === 4;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
        {t('token.backToTokens')}
      </Link>

      {/* Token Header */}
      <div className="flex items-start gap-6">
        {token.image ? (
          <img src={token.image} alt={token.symbol} className="w-16 h-16 rounded-full object-cover border border-synth-border flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-synth-green/10 border border-synth-green/20 flex items-center justify-center text-synth-green text-xl font-bold flex-shrink-0">
            {token.symbol ? token.symbol.slice(0, 2) : '??'}
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-synth-text">{token.name || token.symbol}</h1>
            <span className="text-sm text-synth-muted">${token.symbol}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              isOnDex ? 'bg-synth-cyan/10 text-synth-cyan' : 'bg-synth-green/10 text-synth-green'
            }`}>
              {statusLabel(token.status)}
            </span>
          </div>
          {token.description && (
            <p className="text-sm text-synth-muted">{token.description}</p>
          )}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={copyAddress}
              className="text-[10px] px-1.5 py-0.5 bg-synth-surface text-synth-muted border border-synth-border rounded font-mono hover:border-synth-green/30 transition-colors"
            >
              {copied ? t('token.copied') : `${params.address.slice(0, 10)}...${params.address.slice(-6)}`}
            </button>
            {token.taxRate > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-synth-cyan/10 text-synth-cyan rounded">
                {token.taxRate}% {t('home.tax')}
              </span>
            )}
            <span className="text-[10px] text-synth-muted">
              {t('token.created')} {formatTimeAgo(token.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('token.priceLabel'), value: formatPrice(token.priceUsd), color: 'text-synth-text' },
          { label: t('token.marketCapLabel'), value: formatMarketCap(token.marketCap), color: 'text-synth-green' },
          { label: t('token.priceBnbLabel'), value: token.price > 0 ? token.price.toExponential(3) : '—', color: 'text-synth-cyan' },
          { label: t('token.progressLabel'), value: isOnDex ? t('token.migrated') : `${(token.progress * 100).toFixed(1)}%`, color: isOnDex ? 'text-synth-cyan' : 'text-synth-green' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
              {stat.label}
            </span>
            <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {!isOnDex && (
        <div className="card">
          <div className="flex justify-between text-xs text-synth-muted mb-2">
            <span>{t('token.bondingCurveProgress')}</span>
            <span>{(token.progress * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-synth-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-synth-green to-synth-cyan rounded-full transition-all"
              style={{ width: `${Math.min(100, token.progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-synth-muted mt-2">
            <span>{t('token.reserve')}: {token.reserve?.toFixed(4)} BNB</span>
            <span>{t('token.supply')}: {(token.circulatingSupply / 1e6).toFixed(1)}M / 1B</span>
          </div>
        </div>
      )}

      {/* Fee Sharing Info */}
      {token.taxRate > 0 && token.agent_name && (
        <div className="card border-synth-purple/30 bg-synth-purple/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-sm font-bold text-synth-purple uppercase tracking-wider">Fee Sharing</h2>
              <p className="text-sm text-synth-muted mt-1">
                {token.taxRate}% {isZh ? '交易税分润给' : 'trading tax shared with'}
              </p>
            </div>
            <a
              href={token.agent_name.startsWith('tw:')
                ? `https://x.com/${token.agent_name.slice(3)}`
                : `https://moltbook.com/u/${token.agent_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-sm px-3 py-1.5 bg-synth-purple/10 text-synth-purple rounded-lg font-mono hover:bg-synth-purple/20 transition-colors"
            >
              {token.agent_name.startsWith('tw:')
                ? `🐦 @${token.agent_name.slice(3)}`
                : `🦞 ${token.agent_name}`}
              <span className="ml-1 text-[10px]">↗</span>
            </a>
          </div>
        </div>
      )}

      {/* Tax Revenue */}
      {taxRevenue && (
        <div className="card">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider mb-4">
            💰 {t('token.taxRevenue')}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
                {t('token.totalRevenue')}
              </span>
              <span className="text-lg font-bold text-synth-green">{taxRevenue.totalFeesBnb.toFixed(4)} BNB</span>
              <span className="text-xs text-synth-muted block">${taxRevenue.totalFeesUsd.toFixed(2)}</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
                {t('token.claimed')}
              </span>
              <span className="text-lg font-bold text-synth-cyan">{taxRevenue.claimedBnb.toFixed(4)} BNB</span>
              <span className="text-xs text-synth-muted block">${taxRevenue.claimedUsd.toFixed(2)}</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
                {t('token.pendingClaim')}
              </span>
              <span className="text-lg font-bold text-synth-green">{taxRevenue.pendingBnb.toFixed(4)} BNB</span>
              <span className="text-xs text-synth-muted block">${taxRevenue.pendingUsd.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Trade on Flap - Prominent CTA */}
      <div className="card border-synth-green/30 bg-synth-green/5">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-bold text-synth-green">{t('token.tradeOnFlap')}</h2>
          <p className="text-sm text-synth-muted">
            {t('token.tradeHint')}
          </p>
          <a
            href={`https://flap.sh/token/${params.address}?chain=bsc`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-block px-8 py-3 text-lg"
          >
            {t('token.tradeBtn', { symbol: token.symbol })}
          </a>
        </div>
      </div>

      {/* Token Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            {t('token.tokenDetails')}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.contract')}</span>
              <button onClick={copyAddress} className="text-synth-text font-mono text-xs hover:text-synth-green transition-colors">
                {params.address.slice(0, 10)}...{params.address.slice(-8)}
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.creator')}</span>
              <span className="text-synth-text font-mono text-xs">
                {token.creator ? `${token.creator.slice(0, 10)}...${token.creator.slice(-8)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.status')}</span>
              <span className="text-synth-text">{statusLabel(token.status)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.chain')}</span>
              <span className="text-synth-text">BSC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.protocol')}</span>
              <span className="text-synth-text">Flap</span>
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-purple uppercase tracking-wider">
            {t('token.bondingCurve')}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.circulatingSupply')}</span>
              <span className="text-synth-text">{(token.circulatingSupply / 1e6).toFixed(2)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.totalSupply')}</span>
              <span className="text-synth-text">1,000,000,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.reserveBnb')}</span>
              <span className="text-synth-cyan">{token.reserve?.toFixed(4)}</span>
            </div>
            {token.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-synth-muted">{t('token.taxRate')}</span>
                <span className="text-synth-cyan">{token.taxRate}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-green uppercase tracking-wider">
          {t('token.explore')}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <a
            href={`https://flap.sh/token/${params.address}?chain=bsc`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary py-3 text-center"
          >
            {t('token.tradeOnFlap')}
          </a>
          <a
            href={`https://bscscan.com/token/${params.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-3 text-center"
          >
            {t('token.viewOnBscScan')}
          </a>
          <a
            href={`https://dexscreener.com/bsc/${params.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-3 text-center"
          >
            DexScreener
          </a>
        </div>
      </div>
    </div>
  );
}
