'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { WalletConnect } from '@/components/WalletConnect';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Agent {
  id: string;
  user_address: string;
  name: string;
  description: string | null;
  plan: string;
  status: 'running' | 'stopped' | 'pending' | 'deploying' | 'expired';
  created_at: string;
  expires_at: string;
  payment_method: string;
  payment_amount: number;
}

const PLAN_LABELS: Record<string, string> = {
  '7d': '7 Days',
  '14d': '14 Days',
  '30d': '30 Days',
};

const statusStyles: Record<string, { label: string; className: string }> = {
  running: { label: '✅ Running', className: 'bg-synth-green/20 text-synth-green' },
  deploying: { label: '🚀 Deploying', className: 'bg-blue-500/20 text-blue-300' },
  pending: { label: '⏳ Pending', className: 'bg-yellow-500/20 text-yellow-400' },
  stopped: { label: '⏹ Stopped', className: 'bg-red-500/20 text-red-400' },
  expired: { label: '⌛ Expired', className: 'bg-slate-500/20 text-slate-300' },
};

function AgentDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const agentId = params?.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchAgent = useCallback(async () => {
    if (!agentId || !address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}?user_address=${encodeURIComponent(address)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch agent');
      }
      const data = await res.json();
      setAgent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent');
    } finally {
      setLoading(false);
    }
  }, [agentId, address]);

  useEffect(() => {
    if (isConnected && address && agentId) {
      fetchAgent();
    } else {
      setLoading(false);
    }
  }, [isConnected, address, agentId, fetchAgent]);

  const handleAction = async (action: 'stop' | 'restart' | 'delete' | 'deploy') => {
    if (!agent) return;
    if (action === 'delete' && !confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setActionLoading(action);
    setConfirmDelete(false);
    try {
      const res = await fetch(`/api/agents/${agentId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_address: address }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Action failed');
      }
      if (action === 'delete') {
        router.push('/dashboard');
      } else {
        await fetchAgent();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-synth-bg text-synth-text">
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="card text-center">
            <div className="text-4xl mb-4">🔐</div>
            <h2 className="text-lg font-bold text-synth-text mb-2">Connect Wallet</h2>
            <p className="text-synth-muted text-sm mb-4">Connect your wallet to manage your agent.</p>
            <WalletConnect />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-synth-bg text-synth-text">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard" className="text-synth-cyan hover:underline text-sm">
            ← Back to Dashboard
          </Link>
          <WalletConnect />
        </div>

        {loading ? (
          <div className="card text-center py-12">
            <div className="text-2xl animate-pulse">⏳</div>
            <p className="text-synth-muted mt-2">Loading agent...</p>
          </div>
        ) : error ? (
          <div className="card text-center py-12">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={fetchAgent} className="btn-primary px-6 py-2">
              Retry
            </button>
          </div>
        ) : !agent ? (
          <div className="card text-center py-12">
            <div className="text-3xl mb-3">🤷</div>
            <p className="text-synth-muted">Agent not found or you don&apos;t have access.</p>
          </div>
        ) : (
          <>
            {/* Agent Info Card */}
            <div className="card mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-synth-text">{agent.name}</h1>
                  {agent.description && (
                    <p className="text-synth-muted text-sm mt-1">{agent.description}</p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    statusStyles[agent.status]?.className ?? 'bg-slate-500/20 text-slate-300'
                  }`}
                >
                  {statusStyles[agent.status]?.label ?? agent.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-synth-muted">Plan</span>
                  <p className="text-synth-text font-medium">{PLAN_LABELS[agent.plan] ?? agent.plan}</p>
                </div>
                <div>
                  <span className="text-synth-muted">Payment</span>
                  <p className="text-synth-text font-medium">
                    {agent.payment_amount?.toFixed(4)} {agent.payment_method?.toUpperCase()}
                  </p>
                </div>
                <div>
                  <span className="text-synth-muted">Created</span>
                  <p className="text-synth-text font-medium">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-synth-muted">Expires</span>
                  <p className="text-synth-text font-medium">
                    {new Date(agent.expires_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="card">
              <h2 className="text-lg font-bold text-synth-text mb-4">Actions</h2>
              <div className="flex flex-wrap gap-3">
                {agent.status === 'pending' && (
                  <button
                    onClick={() => handleAction('deploy')}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'deploy' ? '⏳ Deploying...' : '🚀 Deploy'}
                  </button>
                )}
                {agent.status === 'running' && (
                  <button
                    onClick={() => handleAction('stop')}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'stop' ? '⏳ Stopping...' : '⏹ Stop'}
                  </button>
                )}
                {(agent.status === 'stopped' || agent.status === 'expired') && (
                  <button
                    onClick={() => handleAction('restart')}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-synth-green/20 text-synth-green border border-synth-green/30 rounded hover:bg-synth-green/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'restart' ? '⏳ Restarting...' : '▶️ Restart'}
                  </button>
                )}
                {confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('delete')}
                      disabled={actionLoading !== null}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'delete' ? '⏳ Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 bg-synth-surface text-synth-text border border-synth-border rounded hover:bg-synth-surface/80 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAction('delete')}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
              <p className="text-synth-muted text-xs mt-4">
                Note: Deleting an agent is permanent and cannot be undone.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function AgentDetailPage() {
  return (
    <ErrorBoundary>
      <AgentDetailPageInner />
    </ErrorBoundary>
  );
}
