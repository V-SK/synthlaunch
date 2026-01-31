'use client';

import Link from 'next/link';

interface TokenCardProps {
  address: string;
  name: string;
  symbol: string;
  description: string;
  marketCap: string;
  volume24h: string;
  price: string;
  change24h: string;
  taxRate: number;
  agentName: string;
  createdAt: string;
}

export function TokenCard({
  address,
  name,
  symbol,
  description,
  marketCap,
  price,
  change24h,
  taxRate,
  agentName,
  createdAt,
}: TokenCardProps) {
  const isPositive = change24h.startsWith('+');

  return (
    <Link href={`/token/${address}`}>
      <div className="card cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-synth-green/10 border border-synth-green/20 flex items-center justify-center text-synth-green text-sm font-bold">
              {symbol.slice(0, 2)}
            </div>
            <div>
              <h3 className="font-bold text-synth-text group-hover:text-synth-green transition-colors">
                {name}
              </h3>
              <span className="text-xs text-synth-muted">${symbol}</span>
            </div>
          </div>
          <span className="text-[10px] text-synth-muted">{createdAt}</span>
        </div>

        {/* Description */}
        <p className="text-xs text-synth-muted mb-3 line-clamp-2">
          {description}
        </p>

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
          <span
            className={`text-xs font-bold ${
              isPositive ? 'text-synth-green' : 'text-red-400'
            }`}
          >
            {change24h}
          </span>
        </div>
      </div>
    </Link>
  );
}
