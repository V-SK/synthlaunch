import { StatsBar } from '@/components/StatsBar';
import { TokenCard } from '@/components/TokenCard';
import { MOCK_TOKENS } from '@/lib/constants';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-12 space-y-4">
        <div className="inline-block text-[10px] px-2 py-1 bg-synth-green/10 text-synth-green border border-synth-green/20 rounded font-mono mb-4">
          ● LIVE ON BSC MAINNET
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-synth-text">
          AI Agent Token Launches
          <br />
          <span className="text-synth-green glow-text-green">on BSC</span>
        </h1>
        <p className="text-synth-muted max-w-xl mx-auto text-sm">
          Launch tokens with built-in AI agent tax routing. Agents earn fees on every trade.
          <br />
          Powered by Flap Protocol.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Link href="/launch" className="btn-primary">
            Launch Token →
          </Link>
          <Link href="/claim" className="btn-purple">
            Claim Fees
          </Link>
        </div>
      </section>

      {/* Stats */}
      <StatsBar />

      {/* Token List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-synth-text terminal-prompt">
            Recent Launches
          </h2>
          <span className="text-xs text-synth-muted animate-blink">█</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MOCK_TOKENS.map((token) => (
            <TokenCard key={token.address} {...token} />
          ))}
        </div>
      </section>
    </div>
  );
}
