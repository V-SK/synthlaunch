'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { formatEther, parseEther, type Address } from 'viem';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useFairMintToken, useMint, useFinalize } from '@/hooks/useFairMint';

function formatSupply(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(2);
}

function getTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function FairMintDetailInner({ address }: { address: Address }) {
  const { isConnected, address: userAddress, chain } = useAccount();
  const { token, userMinted, loading, error, refetch } = useFairMintToken(address);
  // Native gas symbol of the chain the wallet is currently on. The fair-mint
  // token contract is per-chain, so the connected chain is the right
  // assumption here for displaying mint price units.
  const nativeSymbol = chain?.id === 196 ? 'OKB' : 'BNB';
  const { mint, isPending: isMinting, hash: mintHash, error: mintError } = useMint(address);
  const { finalize, isPending: isFinalizing, hash: finalizeHash, error: finalizeError } = useFinalize(address);
  
  const [mintAmount, setMintAmount] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Refetch after mint/finalize
  useEffect(() => {
    if (mintHash || finalizeHash) {
      const timer = setTimeout(() => refetch(), 2000);
      return () => clearTimeout(timer);
    }
  }, [mintHash, finalizeHash, refetch]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/mint" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
          ← Back to Fair Mints
        </Link>
        <div className="card py-20 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-synth-cyan border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-synth-muted">Loading token data...</p>
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/mint" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
          ← Back to Fair Mints
        </Link>
        <div className="card py-20 text-center space-y-4">
          <span className="text-3xl">🔍</span>
          <p className="text-synth-muted">{error || 'Token not found'}</p>
        </div>
      </div>
    );
  }

  const isAgentOnly = token.agentOnly;
  const progress = token.progress * 100;
  const timeLeft = getTimeRemaining(token.endTime);
  const publicPercent = ((token.mintableSupply * 100n) / token.totalSupply);
  const lpPercent = 100n - publicPercent;
  
  const userMintedTokens = Number(formatEther(userMinted));
  const maxCanMint = token.perWalletLimitTokens - userMintedTokens;
  
  const mintCostBnb = mintAmount 
    ? (parseFloat(mintAmount) * token.mintPriceBnb).toFixed(6) 
    : '0';
  const mintFeeAmount = mintAmount 
    ? (parseFloat(mintCostBnb) * token.mintFeeRate / 100).toFixed(6) 
    : '0';

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }

  async function handleMint() {
    if (!mintAmount || parseFloat(mintAmount) <= 0) return;
    await mint(parseFloat(mintAmount));
    setMintAmount('');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/mint" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
        ← Back to Fair Mints
      </Link>

      {/* Token Header */}
      <div className="flex items-start gap-6">
        <div className={`w-16 h-16 rounded-full border flex items-center justify-center text-xl font-bold flex-shrink-0 ${
          isAgentOnly
            ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
            : 'bg-synth-cyan/10 border-synth-cyan/20 text-synth-cyan'
        }`}>
          {token.symbol.slice(0, 2)}
        </div>
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
          { label: 'Mint Price', value: `${token.mintPriceBnb} ${nativeSymbol}`, color: 'text-synth-text' },
          { label: 'Per Wallet Limit', value: formatSupply(token.perWalletLimitTokens), color: 'text-synth-green' },
          { label: 'Total Supply', value: formatSupply(token.totalSupplyTokens), color: 'text-synth-cyan' },
          {
            label: 'Time Remaining',
            value: token.isSoldOut ? 'Sold Out' : timeLeft,
            color: token.isSoldOut ? 'text-synth-cyan' : token.isEnded ? 'text-red-400' : 'text-synth-green',
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
      <div className="card border-2 border-synth-green/30 bg-synth-green/5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-bold text-synth-green">⚡ Mint Progress</span>
          <span className="text-lg font-bold font-mono text-synth-green">{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full h-6 bg-synth-bg rounded-full overflow-hidden border border-synth-border">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              token.isSoldOut
                ? 'bg-gradient-to-r from-synth-cyan to-synth-green shadow-[0_0_20px_rgba(0,255,136,0.5)]'
                : 'bg-gradient-to-r from-synth-green to-synth-cyan shadow-[0_0_15px_rgba(0,255,136,0.3)]'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="flex justify-between text-sm mt-3">
          <div>
            <span className="text-synth-muted">Minted: </span>
            <span className="font-mono text-synth-text font-bold">{formatSupply(token.totalMintedTokens)}</span>
          </div>
          <div>
            <span className="text-synth-muted">Remaining: </span>
            <span className="font-mono text-synth-cyan font-bold">{formatSupply(token.remainingTokens)}</span>
          </div>
        </div>
      </div>

      {/* Contract Info */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">📋 Contract Info</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-synth-muted">Token Contract</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-synth-text">{truncateAddress(token.address)}</span>
              <button
                onClick={() => copyToClipboard(token.address, 'contract')}
                className="text-synth-muted hover:text-synth-cyan transition-colors"
              >
                {copiedField === 'contract' ? <span className="text-synth-green text-xs">Copied!</span> : '📋'}
              </button>
              <a
                href={`https://bscscan.com/address/${token.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-synth-muted hover:text-synth-cyan transition-colors"
              >
                ↗
              </a>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-synth-muted">LP Pair</span>
            {token.lpPair ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-synth-text">{truncateAddress(token.lpPair)}</span>
                <a
                  href={`https://bscscan.com/address/${token.lpPair}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-synth-muted hover:text-synth-cyan transition-colors"
                >
                  ↗
                </a>
              </div>
            ) : (
              <span className="text-synth-muted italic text-xs">Created after mint ends</span>
            )}
          </div>

          {token.finalized && token.lpPair && (
            <div className="flex items-center justify-between">
              <span className="text-synth-muted">Trade</span>
              <a
                href={`https://pancakeswap.finance/swap?outputCurrency=${token.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-synth-green hover:text-synth-cyan transition-colors font-mono text-xs"
              >
                🥞 PancakeSwap ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Mint Action */}
      {token.isActive && (
        <div className="card border border-synth-green/30 bg-synth-green/5 space-y-4">
          <h2 className="text-lg font-bold text-synth-green text-center">Mint Now</h2>
          
          {isConnected ? (
            <>
              <div className="text-xs text-synth-muted text-center">
                You have minted: <span className="text-synth-cyan">{userMintedTokens.toFixed(2)}</span> / {token.perWalletLimitTokens} max
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-synth-muted">Amount to mint</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder={`Max ${maxCanMint.toFixed(0)}`}
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    max={maxCanMint}
                    min={1}
                    className="input-field flex-1"
                    disabled={isMinting}
                  />
                  <button
                    onClick={() => setMintAmount(String(Math.floor(maxCanMint)))}
                    className="btn-secondary px-4 text-xs"
                    disabled={isMinting}
                  >
                    MAX
                  </button>
                </div>
                {mintAmount && (
                  <div className="space-y-1">
                    <p className="text-xs text-synth-muted">
                      Cost: <span className="text-synth-green font-mono">{mintCostBnb} {nativeSymbol}</span>
                    </p>
                    <p className="text-[10px] text-synth-muted">
                      Includes {token.mintFeeRate}% platform fee ({mintFeeAmount} {nativeSymbol})
                    </p>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleMint}
                disabled={isMinting || !mintAmount || parseFloat(mintAmount) <= 0 || parseFloat(mintAmount) > maxCanMint}
                className="btn-primary w-full py-4 text-lg font-bold disabled:opacity-50"
              >
                {isMinting ? 'Minting...' : `${isAgentOnly ? '🦞' : '⚡'} Mint ${mintAmount || '0'} $${token.symbol}`}
              </button>
              
              {mintError && (
                <p className="text-red-400 text-xs text-center">{mintError}</p>
              )}
              {mintHash && (
                <p className="text-synth-green text-xs text-center">
                  ✅ Mint successful! <a href={`https://bscscan.com/tx/${mintHash}`} target="_blank" className="underline">View tx</a>
                </p>
              )}
            </>
          ) : (
            <p className="text-center text-synth-muted text-sm">Connect wallet to mint</p>
          )}
        </div>
      )}

      {/* Finalize Button */}
      {token.canFinalize && !token.finalized && (
        <div className="card border border-synth-cyan/30 bg-synth-cyan/5 space-y-4">
          <h2 className="text-lg font-bold text-synth-cyan text-center">Finalize & Create LP</h2>
          <p className="text-xs text-synth-muted text-center">
            Mint has ended. Anyone can finalize to create the PancakeSwap liquidity pool.
          </p>
          <button
            onClick={finalize}
            disabled={isFinalizing || !isConnected}
            className="btn-primary w-full py-3 disabled:opacity-50"
          >
            {isFinalizing ? 'Finalizing...' : '🚀 Finalize & Lock LP'}
          </button>
          {finalizeError && (
            <p className="text-red-400 text-xs text-center">{finalizeError}</p>
          )}
          {finalizeHash && (
            <p className="text-synth-green text-xs text-center">
              ✅ Finalized! <a href={`https://bscscan.com/tx/${finalizeHash}`} target="_blank" className="underline">View tx</a>
            </p>
          )}
        </div>
      )}

      {/* Sold Out / Ended Banner */}
      {(token.isSoldOut || token.isEnded) && !token.canFinalize && token.finalized && (
        <div className={`card border text-center py-8 ${
          token.isSoldOut ? 'border-synth-cyan/30 bg-synth-cyan/5' : 'border-synth-green/30 bg-synth-green/5'
        }`}>
          <span className="text-3xl block mb-2">✅</span>
          <h2 className="text-lg font-bold text-synth-cyan">Mint Complete & LP Locked</h2>
          <p className="text-sm text-synth-muted mt-1">
            Token is now trading on PancakeSwap
          </p>
        </div>
      )}

      {/* Mint Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Mint Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">Type</span>
              <span className="text-synth-text">{isAgentOnly ? '🦞 Agent-Only' : '⚡ Fair Mint'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Price</span>
              <span className="text-synth-text">{token.mintPriceBnb} {nativeSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Wallet Limit</span>
              <span className="text-synth-text">{formatSupply(token.perWalletLimitTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Mint Fee</span>
              <span className="text-synth-cyan">{token.mintFeeRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Chain</span>
              <span className="text-synth-text">X Layer / BSC</span>
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-green uppercase tracking-wider">Supply Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">Total Supply</span>
              <span className="text-synth-text">{formatSupply(token.totalSupplyTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Minted</span>
              <span className="text-synth-green">{formatSupply(token.totalMintedTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Remaining</span>
              <span className="text-synth-text">{formatSupply(token.remainingTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Total Raised</span>
              <span className="text-synth-cyan">{(token.totalMintedTokens * token.mintPriceBnb).toFixed(4)} {nativeSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Progress</span>
              <span className="text-synth-green">{progress.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fee Distribution */}
      <div className="card border border-synth-cyan/20 space-y-3">
        <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">🔒 Fee Distribution (at finalize)</h2>
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
        <p className="text-[10px] text-synth-muted text-center pt-2 border-t border-synth-border/50 mt-2">
          + {token.mintFeeRate}% platform fee collected during mint
        </p>
      </div>
    </div>
  );
}

export default function FairMintDetailPage() {
  const { address } = useParams<{ address: string }>();
  
  if (!address || !address.startsWith('0x')) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/mint" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
          ← Back to Fair Mints
        </Link>
        <div className="card py-20 text-center space-y-4">
          <span className="text-3xl">🔍</span>
          <p className="text-synth-muted">Invalid token address</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <FairMintDetailInner address={address as Address} />
    </ErrorBoundary>
  );
}
