import Link from 'next/link';
import { MOCK_TOKENS } from '@/lib/constants';

export default function TokenPage({ params }: { params: { address: string } }) {
  // Find mock token or use fallback
  const token = MOCK_TOKENS.find((t) => t.address === params.address) || MOCK_TOKENS[0];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
        ← Back to tokens
      </Link>

      {/* Token Header */}
      <div className="flex items-start gap-6">
        <div className="w-16 h-16 rounded-full bg-synth-green/10 border border-synth-green/20 flex items-center justify-center text-synth-green text-xl font-bold flex-shrink-0">
          {token.symbol.slice(0, 2)}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-synth-text">{token.name}</h1>
            <span className="text-sm text-synth-muted">${token.symbol}</span>
          </div>
          <p className="text-sm text-synth-muted">{token.description}</p>
          <div className="flex items-center gap-2 pt-1">
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
          {
            label: '24h Change',
            value: token.change24h,
            color: token.change24h.startsWith('+') ? 'text-synth-green' : 'text-red-400',
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

      {/* Chart Placeholder */}
      <div className="card h-64 flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-synth-muted text-sm">📊 Chart coming soon</span>
          <p className="text-[10px] text-synth-muted">
            Price chart will be integrated in the next update
          </p>
        </div>
      </div>

      {/* Token Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            Token Details
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">Contract</span>
              <span className="text-synth-text font-mono text-xs">
                {params.address.slice(0, 10)}...{params.address.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Creator</span>
              <span className="text-synth-text font-mono text-xs">
                {token.creator.slice(0, 10)}...{token.creator.slice(-8)}
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
              <span className="text-synth-muted">Fees Earned</span>
              <span className="text-synth-green">0.42 BNB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">Verified</span>
              <span className="text-synth-green">✓ Moltbook</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trade Actions */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-green uppercase tracking-wider">
          Trade
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <button className="btn-primary py-3">Buy {token.symbol}</button>
          <button className="btn-secondary py-3">Sell {token.symbol}</button>
        </div>
        <p className="text-[10px] text-synth-muted text-center">
          Trading is handled via Flap Protocol on BSC
        </p>
      </div>
    </div>
  );
}
