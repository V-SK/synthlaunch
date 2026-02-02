'use client';

import Link from 'next/link';
import type { FairMintToken } from '@/lib/fairMintMocks';
import { getFairMintProgress, getTimeRemaining, formatSupply } from '@/lib/fairMintMocks';

export function FairMintTokenCard({ token }: { token: FairMintToken }) {
  const progress = getFairMintProgress(token);
  const timeLeft = getTimeRemaining(token);
  const isAgentOnly = token.tokenType === 'agentOnly';
  const isEnded = token.endTime <= Math.floor(Date.now() / 1000);
  const isSoldOut = token.minted >= token.totalSupply;

  return (
    <Link href={`/token/fair/${token.id}`}>
      <div className="card cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {token.image ? (
              <img src={token.image} alt={token.symbol} className="w-10 h-10 rounded-full object-cover border border-synth-border" />
            ) : (
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-bold ${
                isAgentOnly
                  ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                  : 'bg-synth-cyan/10 border-synth-cyan/20 text-synth-cyan'
              }`}>
                {token.symbol.slice(0, 2)}
              </div>
            )}
            <div>
              <h3 className="font-bold text-synth-text group-hover:text-synth-green transition-colors">
                {token.name}
              </h3>
              <span className="text-xs text-synth-muted">${token.symbol}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              isAgentOnly
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                : 'bg-synth-cyan/10 text-synth-cyan border border-synth-cyan/20'
            }`}>
              {isAgentOnly ? '🦞 Agent-Only' : '⚡ Fair Mint'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <span className="text-[10px] text-synth-muted block">Mint Price</span>
            <span className="text-sm text-synth-text">{token.mintPrice} BNB</span>
          </div>
          <div>
            <span className="text-[10px] text-synth-muted block">Per Wallet</span>
            <span className="text-sm text-synth-text">{formatSupply(token.perWalletLimit)}</span>
          </div>
        </div>

        {/* Mint Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-synth-muted mb-1">
            <span>Minted</span>
            <span>{formatSupply(token.minted)} / {formatSupply(token.totalSupply)} ({(progress * 100).toFixed(1)}%)</span>
          </div>
          <div className="w-full h-1.5 bg-synth-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isSoldOut ? 'bg-synth-cyan' : 'bg-synth-green'
              }`}
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Agent-only badge */}
        {isAgentOnly && (
          <div className="mb-3 flex items-center gap-1.5">
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded font-mono">
              🦞 SynthID Required
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-synth-border">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            isSoldOut
              ? 'bg-synth-cyan/10 text-synth-cyan'
              : isEnded
              ? 'bg-red-500/10 text-red-400'
              : 'bg-synth-green/10 text-synth-green'
          }`}>
            {isSoldOut ? '✓ Sold Out' : isEnded ? 'Ended' : `⏱ ${timeLeft}`}
          </span>
          <span className="text-[10px] text-synth-muted">LP: {(token.lpRatio * 100).toFixed(0)}% locked</span>
        </div>
      </div>
    </Link>
  );
}
