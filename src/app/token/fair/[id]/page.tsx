'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FAIR_MINT_TOKENS, getFairMintProgress, getTimeRemaining, formatSupply, isCompleted } from '@/lib/fairMintMocks';
import type { FairMintToken } from '@/lib/fairMintMocks';

function FairMintDetailInner({ id }: { id: string }) {
  const token = FAIR_MINT_TOKENS.find(t => t.id === id);
  const [mintAmount, setMintAmount] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
          ← Back to tokens
        </Link>
        <div className="card py-20 text-center space-y-4">
          <span className="text-3xl">🔍</span>
          <p className="text-synth-muted">Token not found</p>
        </div>
      </div>
    );
  }

  const progress = getFairMintProgress(token);
  const timeLeft = getTimeRemaining(token);
  const isAgentOnly = token.tokenType === 'agentOnly';
  const isEnded = token.endTime <= Math.floor(Date.now() / 1000);
  const isSoldOut = token.minted >= token.totalSupply;
  const publicPercent = 100 - token.lpRatio * 100;
  const lpPercent = token.lpRatio * 100;

  const mintCostBnb = mintAmount ? (parseFloat(mintAmount) * token.mintPrice).toFixed(4) : '0';
  const completed = isCompleted(token);

  function truncateAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
        ← Back to tokens
      </Link>

      {/* Token Header */}
      <div className="flex items-start gap-6">
        {token.image ? (
          <img src={token.image} alt={token.symbol} className="w-16 h-16 rounded-full object-cover border border-synth-border flex-shrink-0" />
        ) : (
          <div className={`w-16 h-16 rounded-full border flex items-center justify-center text-xl font-bold flex-shrink-0 ${
            isAgentOnly
              ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
              : 'bg-synth-cyan/10 border-synth-cyan/20 text-synth-cyan'
          }`}>
            {token.symbol.slice(0, 2)}
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-synth-text">{token.name}</h1>
            <span className="text-sm text-synth-muted">${token.symbol}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-mono ${
              isAgentOnly
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                : 'bg-synth-cyan/10 text-synth-cyan border border-synth-cyan/20'
            }`}>
              {isAgentOnly ? '🦞 Agent-Only' : '⚡ Fair Mint'}
            </span>
          </div>
          {token.description && (
            <p className="text-sm text-synth-muted">{token.description}</p>
          )}
          {isAgentOnly && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20 font-mono">
                🦞 SynthID Required
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Mint Price', value: `${token.mintPrice} BNB`, color: 'text-synth-text' },
          { label: 'Per Wallet Limit', value: formatSupply(token.perWalletLimit), color: 'text-synth-green' },
          { label: 'Total Supply', value: formatSupply(token.totalSupply), color: 'text-synth-cyan' },
          {
            label: 'Time Remaining',
            value: isSoldOut ? 'Sold Out' : timeLeft,
            color: isSoldOut ? 'text-synth-cyan' : isEnded ? 'text-red-400' : 'text-synth-green',
          },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
              {stat.label}
            </span>
            <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Mint Progress */}
      <div className="card">
        <div className="flex justify-between text-xs text-synth-muted mb-2">
          <span>Mint Progress</span>
          <span>{formatSupply(token.minted)} / {formatSupply(token.totalSupply)} ({(progress * 100).toFixed(1)}%)</span>
        </div>
        <div className="w-full h-4 bg-synth-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isSoldOut
                ? 'bg-gradient-to-r from-synth-cyan to-synth-green'
                : 'bg-gradient-to-r from-synth-green to-synth-cyan'
            }`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-synth-muted mt-2">
          <span>{formatSupply(token.minted)} minted</span>
          <span>{formatSupply(token.totalSupply - token.minted)} remaining</span>
        </div>
      </div>

      {/* Contract Info */}
      {token.contractAddress && (
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">📋 Contract Info</h2>
          <div className="space-y-3 text-sm">
            {/* Token Contract */}
            <div className="flex items-center justify-between">
              <span className="text-synth-muted">Token Contract</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-synth-text">{truncateAddress(token.contractAddress)}</span>
                <button
                  onClick={() => copyToClipboard(token.contractAddress!, 'contract')}
                  className="text-synth-muted hover:text-synth-cyan transition-colors"
                  title="Copy address"
                >
                  {copiedField === 'contract' ? (
                    <span className="text-synth-green text-xs">Copied!</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
                <a
                  href={`https://bscscan.com/address/${token.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-synth-muted hover:text-synth-cyan transition-colors"
                  title="View on BscScan"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </div>

            {/* LP Pair */}
            <div className="flex items-center justify-between">
              <span className="text-synth-muted">LP Pair</span>
              {completed && token.lpPairAddress ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-synth-text">{truncateAddress(token.lpPairAddress)}</span>
                  <button
                    onClick={() => copyToClipboard(token.lpPairAddress!, 'lp')}
                    className="text-synth-muted hover:text-synth-cyan transition-colors"
                    title="Copy address"
                  >
                    {copiedField === 'lp' ? (
                      <span className="text-synth-green text-xs">Copied!</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                  <a
                    href={`https://bscscan.com/address/${token.lpPairAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-synth-muted hover:text-synth-cyan transition-colors"
                    title="View on BscScan"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              ) : (
                <span className="text-synth-muted italic text-xs">Created after mint ends</span>
              )}
            </div>

            {/* PancakeSwap Trade Link — only after completion */}
            {completed && token.contractAddress && (
              <div className="flex items-center justify-between">
                <span className="text-synth-muted">Trade</span>
                <a
                  href={`https://pancakeswap.finance/swap?outputCurrency=${token.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-synth-green hover:text-synth-cyan transition-colors font-mono text-xs"
                >
                  🥞 PancakeSwap
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mint Action */}
      {!isSoldOut && !isEnded && (
        <div className="card border border-synth-green/30 bg-synth-green/5 space-y-4">
          <h2 className="text-lg font-bold text-synth-green text-center">Mint Now</h2>
          <div className="space-y-2">
            <label className="text-sm text-synth-muted">Amount to mint</label>
            <div className="flex gap-3">
              <input
                type="number"
                placeholder={`Max ${formatSupply(token.perWalletLimit)}`}
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                max={token.perWalletLimit}
                min={1}
                className="input-field flex-1"
              />
              <button
                onClick={() => setMintAmount(String(token.perWalletLimit))}
                className="btn-secondary px-4 text-xs"
              >
                MAX
              </button>
            </div>
            {mintAmount && (
              <p className="text-xs text-synth-muted">
                Cost: <span className="text-synth-green font-mono">{mintCostBnb} BNB</span>
              </p>
            )}
          </div>
          <button
            onClick={() => alert('Minting coming soon! Smart contract integration pending.')}
            className="btn-primary w-full py-4 text-lg font-bold"
          >
            {isAgentOnly ? '🦞' : '⚡'} Mint {mintAmount || '0'} ${token.symbol}
          </button>
          {isAgentOnly && (
            <p className="text-center text-[10px] text-orange-400">
              🦞 This mint requires SynthID verification
            </p>
          )}
        </div>
      )}

      {/* Sold Out / Ended Banner */}
      {(isSoldOut || isEnded) && (
        <div className={`card border text-center py-8 ${
          isSoldOut ? 'border-synth-cyan/30 bg-synth-cyan/5' : 'border-red-500/30 bg-red-500/5'
        }`}>
          <span className="text-3xl block mb-2">{isSoldOut ? '✅' : '⏰'}</span>
          <h2 className={`text-lg font-bold ${isSoldOut ? 'text-synth-cyan' : 'text-red-400'}`}>
            {isSoldOut ? 'Mint Sold Out!' : 'Mint Ended'}
          </h2>
          <p className="text-sm text-synth-muted mt-1">
            {isSoldOut ? 'All tokens have been minted. LP has been locked.' : 'The minting period has ended.'}
          </p>
        </div>
      )}

      {/* Token Allocation */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Token Allocation</h2>
        <div className="space-y-3">
          {/* Visual bar */}
          <div className="w-full h-8 rounded-lg overflow-hidden flex">
            <div
              className="bg-synth-green flex items-center justify-center text-[10px] text-black font-bold"
              style={{ width: `${publicPercent}%` }}
            >
              {publicPercent.toFixed(0)}% Public Mint
            </div>
            <div
              className="bg-synth-cyan flex items-center justify-center text-[10px] text-black font-bold"
              style={{ width: `${lpPercent}%` }}
            >
              {lpPercent.toFixed(0)}% LP
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-synth-green" />
              <div>
                <span className="text-sm text-synth-text">{publicPercent.toFixed(0)}% Public Mint</span>
                <p className="text-[10px] text-synth-muted">Available for community minting</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-synth-cyan" />
              <div>
                <span className="text-sm text-synth-text">{lpPercent.toFixed(0)}% LP (Locked)</span>
                <p className="text-[10px] text-synth-muted">Permanently locked liquidity</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LP Info */}
      <div className="card border border-synth-cyan/20 space-y-3">
        <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">🔒 LP Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-synth-muted">LP Status</span>
            <span className="text-synth-green font-mono">Permanently Locked</span>
          </div>
          <div className="flex justify-between">
            <span className="text-synth-muted">LP Ratio</span>
            <span className="text-synth-text">{lpPercent.toFixed(0)}% of raised BNB</span>
          </div>
        </div>
        <div className="border-t border-synth-border pt-3 space-y-2">
          <h3 className="text-xs text-synth-muted uppercase tracking-wider">Fee Distribution</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <span className="text-lg font-bold text-orange-400">10%</span>
              <p className="text-[10px] text-synth-muted">Agent</p>
            </div>
            <div className="text-center">
              <span className="text-lg font-bold text-synth-cyan">10%</span>
              <p className="text-[10px] text-synth-muted">Platform</p>
            </div>
            <div className="text-center">
              <span className="text-lg font-bold text-synth-green">80%</span>
              <p className="text-[10px] text-synth-muted">Back to LP</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mint Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Mint Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">Type</span>
              <span className="text-synth-text">{isAgentOnly ? '🦞 Agent-Only Mint' : '⚡ Fair Mint'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Price</span>
              <span className="text-synth-text">{token.mintPrice} BNB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Duration</span>
              <span className="text-synth-text">{token.mintDuration}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Wallet Limit</span>
              <span className="text-synth-text">{formatSupply(token.perWalletLimit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Chain</span>
              <span className="text-synth-text">BSC</span>
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-green uppercase tracking-wider">Supply Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">Total Supply</span>
              <span className="text-synth-text">{formatSupply(token.totalSupply)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Minted</span>
              <span className="text-synth-green">{formatSupply(token.minted)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Remaining</span>
              <span className="text-synth-text">{formatSupply(token.totalSupply - token.minted)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Total Raised</span>
              <span className="text-synth-cyan">{(token.minted * token.mintPrice).toFixed(2)} BNB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Progress</span>
              <span className="text-synth-green">{(progress * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function FairMintDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ErrorBoundary>
      <FairMintDetailInner id={id} />
    </ErrorBoundary>
  );
}
