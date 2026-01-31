'use client';

import Link from 'next/link';
import type { Token } from '@/lib/api';

export function TokenCard({ address, name, symbol, image, marketCap, price, priceChange24h, taxRate, agentName, createdAt }: Token) {
  const isPositive = priceChange24h >= 0;
  const changeStr = `${isPositive ? '+' : ''}${priceChange24h.toFixed(1)}%`;

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
                {symbol.slice(0, 2)}
              </div>
            )}
            <div>
              <h3 className="font-bold text-synth-text group-hover:text-synth-green transition-colors">
                {name}
              </h3>
              <span className="text-xs text-synth-muted">${symbol}</span>
            </div>
          </div>
          <span className={`text-xs font-bold ${isPositive ? 'text-synth-green' : 'text-red-400'}`}>
            {changeStr}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <span className="text-[10px] text-synth-muted block">Price</span>
            <span className="text-sm text-synth-text">{price}</span>
          </div>
          <div>
            <span className="text-[10px] text-synth-muted block">MCap</span>
            <span className="text-sm text-synth-text">{marketCap}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-synth-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 bg-synth-cyan/10 text-synth-cyan rounded">
              {taxRate}% tax
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-synth-purple/10 text-synth-purple rounded">
              🤖 {agentName}
            </span>
          </div>
          <span className="text-[10px] text-synth-muted">{createdAt}</span>
        </div>
      </div>
    </Link>
  );
}
