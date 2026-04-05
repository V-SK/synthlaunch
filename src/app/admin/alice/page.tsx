'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { WalletConnect } from '@/components/WalletConnect';

const ADMIN_ADDRESS = '0x0198b366978ff0ee67bf308b0367c9b6fced2725';
const ALICE_DECIMALS = 12;

function formatAlice(raw: string): string {
  const n = BigInt(raw);
  const divisor = BigInt(10 ** ALICE_DECIMALS);
  const whole = n / divisor;
  const frac = (n % divisor).toString().padStart(ALICE_DECIMALS, '0').slice(0, 4);
  return `${whole.toLocaleString()}.${frac}`;
}

interface Round {
  round_id: string;
  total_pool: string;
  pool_balance: string;
  recipient_count: number;
  success_count: number;
  fail_count: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface PerAddress {
  bscAddress: string;
  aliceAddress: string;
  totalAlice: string;
}

export default function AdminAlicePage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_ADDRESS;

  // Auth state
  const [authed, setAuthed] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState('');

  // Data
  const [rounds, setRounds] = useState<Round[]>([]);
  const [perAddress, setPerAddress] = useState<PerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState('');

  const authenticate = useCallback(async () => {
    if (!isAdmin) return;
    setAuthError('');
    try {
      const ts = Date.now();
      const message = `SynthLaunch Admin\nTimestamp: ${ts}`;
      const signature = await signMessageAsync({ message });
      const headers = {
        'x-admin-signature': signature,
        'x-admin-message': encodeURIComponent(message),
      };
      setAuthHeaders(headers);
      setAuthed(true);
    } catch (e) {
      setAuthError('签名失败: ' + String(e instanceof Error ? e.message : e));
    }
  }, [isAdmin, signMessageAsync]);

  // Fetch data after auth
  const fetchData = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/alice-distribute', { headers: authHeaders });
      if (res.status === 401) {
        setAuthed(false);
        setAuthError('签名已过期，请重新签名');
        return;
      }
      const data = await res.json();
      setRounds(data.rounds ?? []);
      setPerAddress(data.perAddress ?? []);
    } catch (e) {
      console.error('fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [authed, authHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Manual trigger
  const triggerDistribution = useCallback(async () => {
    if (!authed) return;
    setTriggering(true);
    setTriggerResult('');
    try {
      const res = await fetch('/api/admin/alice-distribute', {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      setTriggerResult(JSON.stringify(data, null, 2));
      // Refresh data
      setTimeout(fetchData, 2000);
    } catch (e) {
      setTriggerResult('Error: ' + String(e));
    } finally {
      setTriggering(false);
    }
  }, [authed, authHeaders, fetchData]);

  // Not admin
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-synth-dark text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-synth-muted">Connect admin wallet</p>
          <WalletConnect />
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-synth-dark text-white flex items-center justify-center">
        <p className="text-red-400">Access denied. Admin wallet required.</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-synth-dark text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-synth-green">Admin Authentication</h1>
          <p className="text-synth-muted text-sm">Sign a message to verify your identity</p>
          <button
            onClick={authenticate}
            className="bg-synth-green text-black font-bold rounded-lg px-8 py-3 hover:opacity-90"
          >
            Sign to Enter
          </button>
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-synth-dark text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-synth-green">ALICE Distribution Admin</h1>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-xs text-synth-muted hover:text-white border border-synth-border rounded px-3 py-1"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Manual Trigger */}
        <div className="card border border-synth-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">Manual Trigger</h2>
          <p className="text-synth-muted text-sm">
            Manually trigger a distribution round (same as hourly cron: 1% of pool balance).
          </p>
          <button
            onClick={triggerDistribution}
            disabled={triggering}
            className="bg-synth-green text-black font-bold rounded-lg px-6 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {triggering ? 'Distributing...' : 'Trigger Distribution'}
          </button>
          {triggerResult && (
            <pre className="bg-black/30 border border-synth-border rounded-lg p-4 text-xs text-synth-text overflow-x-auto whitespace-pre-wrap">
              {triggerResult}
            </pre>
          )}
        </div>

        {/* Recent Rounds */}
        <div className="card border border-synth-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">Recent Distribution Rounds</h2>
          {rounds.length === 0 ? (
            <p className="text-synth-muted text-sm">No distribution rounds yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-synth-muted border-b border-synth-border">
                    <th className="text-left py-2 pr-4">Time</th>
                    <th className="text-right py-2 pr-4">Pool Balance</th>
                    <th className="text-right py-2 pr-4">Distributed</th>
                    <th className="text-center py-2 pr-4">Recipients</th>
                    <th className="text-center py-2 pr-4">OK/Fail</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r) => (
                    <tr key={r.round_id} className="border-b border-synth-border/50">
                      <td className="py-2 pr-4">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="text-right py-2 pr-4">{formatAlice(r.pool_balance)}</td>
                      <td className="text-right py-2 pr-4 text-synth-green">{formatAlice(r.total_pool)}</td>
                      <td className="text-center py-2 pr-4">{r.recipient_count}</td>
                      <td className="text-center py-2 pr-4">
                        <span className="text-green-400">{r.success_count}</span>
                        {r.fail_count > 0 && <span className="text-red-400">/{r.fail_count}</span>}
                      </td>
                      <td className="text-center py-2">
                        <span className={r.status === 'completed' ? 'text-green-400' : r.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Per-Address Totals */}
        <div className="card border border-synth-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">Per-Address Totals</h2>
          {perAddress.length === 0 ? (
            <p className="text-synth-muted text-sm">No distributions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-synth-muted border-b border-synth-border">
                    <th className="text-left py-2 pr-4">BSC Address</th>
                    <th className="text-left py-2 pr-4">Alice Address</th>
                    <th className="text-right py-2">Total ALICE Received</th>
                  </tr>
                </thead>
                <tbody>
                  {perAddress.map((p) => (
                    <tr key={p.bscAddress} className="border-b border-synth-border/50">
                      <td className="py-2 pr-4 truncate max-w-[200px]">{p.bscAddress}</td>
                      <td className="py-2 pr-4 truncate max-w-[200px] text-synth-green">{p.aliceAddress}</td>
                      <td className="text-right py-2">{formatAlice(p.totalAlice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
