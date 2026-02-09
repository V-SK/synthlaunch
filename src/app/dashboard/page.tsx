'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  plan: string;
  status: 'running' | 'stopped' | 'pending' | 'deploying' | 'expired';
  created_at: string;
  expires_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  '7d': '7 天',
  '14d': '14 天',
  '30d': '30 天',
};

const statusStyles: Record<string, { label: string; className: string }> = {
  running: { label: '✅ Running', className: 'bg-synth-green/20 text-synth-green' },
  deploying: { label: '🚀 Deploying', className: 'bg-blue-500/20 text-blue-300' },
  pending: { label: '⏳ Pending', className: 'bg-yellow-500/20 text-yellow-400' },
  stopped: { label: '⏹ Stopped', className: 'bg-red-500/20 text-red-400' },
  expired: { label: '⌛ Expired', className: 'bg-slate-500/20 text-slate-300' },
};

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!address) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents?user_address=${encodeURIComponent(address)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch agents');
      }
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[dashboard] fetch agents error:', error);
      setAgents([]);
      setError(error instanceof Error ? error.message : 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      void fetchAgents();
    } else {
      setAgents([]);
      setError(null);
      setLoading(false);
    }
  }, [isConnected, address, fetchAgents]);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-synth-bg pt-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-synth-surface border border-synth-border rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">🔗</div>
            <h1 className="text-2xl font-bold text-synth-text mb-2">
              {t('dashboard.connectWallet')}
            </h1>
            <p className="text-synth-muted mb-6">
              {t('dashboard.connectWalletDesc')}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-synth-bg pt-20 px-4 pb-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-synth-text">
              {t('dashboard.title')}
            </h1>
            <p className="text-synth-muted text-sm font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void fetchAgents()}
              disabled={loading}
              className="px-3 py-2 border border-synth-border text-synth-text rounded hover:border-synth-green/50 transition-colors text-sm disabled:opacity-50"
            >
              {loading ? '⏳' : '↻'} {t('dashboard.refresh')}
            </button>
            <Link
              href="/dashboard/create"
              className="px-4 py-2 bg-synth-green text-synth-bg font-bold rounded hover:bg-synth-green/90 transition-colors"
            >
              + {t('dashboard.createAgent')}
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-synth-surface border border-synth-border rounded-lg p-4">
            <div className="text-synth-muted text-sm">{t('dashboard.totalAgents')}</div>
            <div className="text-2xl font-bold text-synth-text">{agents.length}</div>
          </div>
          <div className="bg-synth-surface border border-synth-border rounded-lg p-4">
            <div className="text-synth-muted text-sm">{t('dashboard.running')}</div>
            <div className="text-2xl font-bold text-synth-green">
              {agents.filter(a => a.status === 'running').length}
            </div>
          </div>
          <div className="bg-synth-surface border border-synth-border rounded-lg p-4">
            <div className="text-synth-muted text-sm">{t('dashboard.stopped')}</div>
            <div className="text-2xl font-bold text-red-400">
              {agents.filter(a => a.status === 'stopped').length}
            </div>
          </div>
        </div>

        {/* Agents List */}
        <div className="bg-synth-surface border border-synth-border rounded-lg">
          <div className="p-4 border-b border-synth-border">
            <h2 className="font-bold text-synth-text">{t('dashboard.myAgents')}</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-synth-muted">
              {t('dashboard.loading')}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-3">⚠️</div>
              <p className="text-red-400 mb-3">{error}</p>
              <button
                type="button"
                className="px-4 py-2 bg-synth-green/20 text-synth-green border border-synth-green/30 rounded hover:bg-synth-green/30 transition-colors"
                onClick={() => void fetchAgents()}
              >
                {t('dashboard.retry')}
              </button>
            </div>
          ) : agents.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-synth-muted mb-4">{t('dashboard.noAgents')}</p>
              <Link
                href="/dashboard/create"
                className="inline-block px-4 py-2 bg-synth-green/20 text-synth-green border border-synth-green/30 rounded hover:bg-synth-green/30 transition-colors"
              >
                {t('dashboard.createFirst')}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-synth-border">
              {agents.map((agent) => (
                <div key={agent.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-synth-green/20 rounded-full flex items-center justify-center text-xl">
                      🤖
                    </div>
                    <div>
                      <div className="font-bold text-synth-text">{agent.name}</div>
                      <div className="text-xs text-synth-muted">
                        Plan: {PLAN_LABELS[agent.plan] ?? agent.plan} · Expires:{' '}
                        {agent.expires_at ? new Date(agent.expires_at).toLocaleDateString() : '--'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        statusStyles[agent.status]?.className ?? 'bg-slate-500/20 text-slate-300'
                      }`}
                    >
                      {statusStyles[agent.status]?.label ?? agent.status}
                    </span>
                    <Link
                      href={`/dashboard/agent/${agent.id}`}
                      className="text-synth-green hover:underline text-sm"
                    >
                      {t('dashboard.manage')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pricing Box */}
        <div className="mt-6 bg-synth-green/5 border border-synth-green/30 rounded-lg p-4">
          <h3 className="font-bold text-synth-text mb-3">💰 {t('dashboard.pricing')}</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-synth-surface border border-synth-border rounded-lg p-3 text-center">
              <div className="text-synth-muted text-xs mb-1">7 {t('dashboard.days')}</div>
              <div className="text-synth-green font-bold text-lg">$10</div>
              <div className="text-synth-muted text-[10px]">~$1.43/{t('dashboard.day')}</div>
            </div>
            <div className="bg-synth-surface border border-synth-green/50 rounded-lg p-3 text-center relative">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-synth-green text-synth-bg text-[9px] px-2 py-0.5 rounded font-bold">
                {t('dashboard.popular')}
              </div>
              <div className="text-synth-muted text-xs mb-1">14 {t('dashboard.days')}</div>
              <div className="text-synth-green font-bold text-lg">$18.50</div>
              <div className="text-synth-muted text-[10px]">~$1.32/{t('dashboard.day')}</div>
            </div>
            <div className="bg-synth-surface border border-synth-border rounded-lg p-3 text-center">
              <div className="text-synth-muted text-xs mb-1">30 {t('dashboard.days')}</div>
              <div className="text-synth-green font-bold text-lg">$30</div>
              <div className="text-synth-muted text-[10px]">~$1.00/{t('dashboard.day')}</div>
            </div>
          </div>
          <ul className="text-synth-muted text-sm space-y-1">
            <li>• {t('dashboard.paymentMethods')}</li>
            <li>• 🔥 {t('dashboard.synthDiscount')}</li>
            <li>• {t('dashboard.pricingIncludes')}</li>
          </ul>
        </div>

        {/* Info Box */}
        <div className="mt-4 bg-synth-surface/50 border border-synth-border rounded-lg p-4">
          <h3 className="font-bold text-synth-text mb-2">💡 {t('dashboard.howItWorks')}</h3>
          <ol className="text-synth-muted text-sm space-y-1 list-decimal list-inside">
            <li>{t('dashboard.step1')}</li>
            <li>{t('dashboard.step2')}</li>
            <li>{t('dashboard.step3')}</li>
            <li>{t('dashboard.step4')}</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
