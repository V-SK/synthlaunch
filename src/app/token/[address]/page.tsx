'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getTokenByAddress, MOCK_TOKENS } from '@/lib/api';

export default function TokenPage({ params }: { params: { address: string } }) {
  const token = getTokenByAddress(params.address) || MOCK_TOKENS[0];
  const [copied, setCopied] = useState(false);

  const isPositive = token.priceChange24h >= 0;
  const changeStr = `${isPositive ? '+' : ''}${token.priceChange24h.toFixed(1)}%`;

  const copyAddress = () => {
    navigator.clipboard.writeText(params.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <div className="w-16 h-16 rounded-full bg-synth-green/10 border border-synth-green/20 flex items-center justify-center text-synth-green text-xl font-bold flex-shrink-0">
            {token.symbol.slice(0, 2)}
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-synth-text">{token.name}</h1>
            <span className="text-sm text-synth-muted">${token.symbol}</span>
            <span className={`text-sm font-bold ${isPositive ? 'text-synth-green' : 'text-red-400'}`}>
              {changeStr}
            </span>
          </div>
          <p className="text-sm text-synth-muted">{token.description}</p>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={copyAddress}
              className="text-[10px] px-1.5 py-0.5 bg-synth-surface text-synth-muted border border-synth-border rounded font-mono hover:border-synth-green/30 transition-colors"
            >
              {copied ? '✓ Copied' : `${params.address.slice(0, 10)}...${params.address.slice(-6)}`}
            </button>
            <span className="text-[10px] px-1.5 py-0.5 bg-synth-purple/10 text-synth-purple rounded">
              🤖 {token.agentName}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-synth-cyan/10 text-synth-cyan rounded">
              {token.taxRate}% tax
            </span>
            <span className="text-[10px] text-synth-muted">
              Created {token.createdAt}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Price', value: token.price, color: 'text-synth-text' },
          { label: 'Market Cap', value: token.marketCap, color: 'text-synth-green' },
          { label: '24h Volume', value: token.volume24h, color: 'text-synth-cyan' },
          { label: '24h Change', value: changeStr, color: isPositive ? 'text-synth-green' : 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
              {stat.label}
            </span>
            <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Chart / Trade Link */}
      <div className="card h-32 flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-synth-green text-sm">📊 View chart and trade on Flap</span>
          <p className="text-[10px]">
            <a
              href={`https://flap.sh/token/${params.address}?chain=bsc`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-synth-cyan hover:text-synth-green transition-colors underline"
            >
              flap.sh/token/{params.address.slice(0, 8)}...
            </a>
          </p>
        </div>
      </div>

      {/* Token Details + Agent Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            Token Details
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">Contract</span>
              <button onClick={copyAddress} className="text-synth-text font-mono text-xs hover:text-synth-green transition-colors">
                {params.address.slice(0, 10)}...{params.address.slice(-8)}
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Creator</span>
              <span className="text-synth-text font-mono text-xs">
                {token.creator.slice(0, 10)}...{token.creator.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Beneficiary</span>
              <span className="text-synth-text font-mono text-xs">
                {token.beneficiary.slice(0, 10)}...{token.beneficiary.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Chain</span>
              <span className="text-synth-text">BSC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Protocol</span>
              <span className="text-synth-text">Flap v5</span>
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-purple uppercase tracking-wider">
            AI Agent Info
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">Agent</span>
              <span className="text-synth-purple">🤖 {token.agentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Tax Rate</span>
              <span className="text-synth-cyan">{token.taxRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Tax Duration</span>
              <span className="text-synth-text">Permanent</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Migrator</span>
              <span className="text-synth-text">V2 (PancakeSwap)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Platform</span>
              <span className="text-synth-green">✓ Moltbook</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-green uppercase tracking-wider">
          Trade & Explore
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <a
            href={`https://flap.sh/token/${params.address}?chain=bsc`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary py-3 text-center"
          >
            🚀 Trade on Flap
          </a>
          <a
            href={`https://pancakeswap.finance/swap?outputCurrency=${params.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-3 text-center"
          >
            Trade on PancakeSwap
          </a>
          <a
            href={`https://bscscan.com/token/${params.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-3 text-center"
          >
            View on BscScan
          </a>
        </div>
      </div>
    </div>
  );
}
