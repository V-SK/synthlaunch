'use client';

import Link from 'next/link';
import type { Token } from '@/lib/api';
import { formatPrice, formatMarketCap, formatTimeAgo, statusLabel } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export function TokenCard({ address, name, symbol, image, price, priceUsd, marketCap, taxRate, status, progress, createdAt, agent_name }: Token) {
  const { t } = useI18n();
  const statusText = statusLabel(status);
  const isOnDex = status === 4;

  return (
    <Link href={`/token/${address}`}>
      <div className="card cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {image ? (
              <img src={image} alt={symbol} className="w-10 h-10 rounded-full object-cover border border-synth-border" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-synth-green/10 border border-synth-green/20 flex items-center justify-center text-synth-green text-sm font-bold">
                {symbol ? symbol.slice(0, 2) : '??'}
              </div>
            )}
            <div>
              <h3 className="font-bold text-synth-text group-hover:text-synth-green transition-colors">
                {name || symbol || t('common.unknown')}
              </h3>
              <span className="text-xs text-synth-muted">${symbol}</span>
            </div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            isOnDex ? 'bg-synth-cyan/10 text-synth-cyan' : 'bg-synth-green/10 text-synth-green'
          }`}>
            {statusText}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <span className="text-[10px] text-synth-muted block">{t('home.price')}</span>
            <span className="text-sm text-synth-text">{formatPrice(priceUsd)}</span>
          </div>
          <div>
            <span className="text-[10px] text-synth-muted block">{t('home.mcap')}</span>
            <span className="text-sm text-synth-text">{formatMarketCap(marketCap)}</span>
          </div>
        </div>

        {/* Progress bar */}
        {!isOnDex && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-synth-muted mb-1">
              <span>{t('home.progress')}</span>
              <span>{(progress * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-synth-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-synth-green rounded-full transition-all"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Fee Sharing */}
        {taxRate > 0 && agent_name && (
          <div className="mb-3 flex items-center gap-1.5">
            <span className="text-[10px] text-synth-cyan">⚡ Fee Sharing</span>
            <a
              href={agent_name.startsWith('tw:') 
                ? `https://x.com/${agent_name.slice(3)}` 
                : `https://moltbook.com/u/${agent_name}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] px-1.5 py-0.5 bg-synth-purple/10 text-synth-purple rounded font-mono hover:bg-synth-purple/20 transition-colors"
            >
              {agent_name.startsWith('tw:') ? `🐦 @${agent_name.slice(3)}` : `🦞 ${agent_name}`}
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-synth-border">
          <div className="flex items-center gap-2">
            {taxRate > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-synth-cyan/10 text-synth-cyan rounded border border-synth-cyan/20 font-mono font-bold">
                ⚡ {taxRate}% {t('home.tax')}
              </span>
            )}
          </div>
          <span className="text-[10px] text-synth-muted">{formatTimeAgo(createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
