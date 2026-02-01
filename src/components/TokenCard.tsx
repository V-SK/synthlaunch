'use client';

import Link from 'next/link';
import type { Token } from '@/lib/api';
import { formatPrice, formatMarketCap, formatTimeAgo, statusLabel } from '@/lib/api';

export function TokenCard({ address, name, symbol, image, price, priceUsd, marketCap, taxRate, status, progress, createdAt }: Token) {
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
                {name || symbol || 'Unknown'}
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
            <span className="text-[10px] text-synth-muted block">Price</span>
            <span className="text-sm text-synth-text">{formatPrice(priceUsd)}</span>
          </div>
          <div>
            <span className="text-[10px] text-synth-muted block">MCap</span>
            <span className="text-sm text-synth-text">{formatMarketCap(marketCap)}</span>
          </div>
        </div>

        {/* Progress bar */}
        {!isOnDex && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-synth-muted mb-1">
              <span>Progress</span>
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-synth-border">
          <div className="flex items-center gap-2">
            {taxRate > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-synth-cyan/10 text-synth-cyan rounded">
                {taxRate}% tax
              </span>
            )}
          </div>
          <span className="text-[10px] text-synth-muted">{formatTimeAgo(createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
