'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSendTransaction,
  useSignMessage,
} from 'wagmi';
import { parseEther, formatEther, parseUnits } from 'viem';
import Link from 'next/link';
import { WalletConnect } from '@/components/WalletConnect';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ERC20_ABI } from '@/lib/erc20';
import { SYNTH_TOKEN_ADDRESS } from '@/lib/contracts';

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
  soul_md?: string | null;
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

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const TREASURY_ADDRESS = '0x8028227C43947F41bB431571002D512815D77C4F';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
const PRICE_REFRESH_MS = 60_000;
const SYNTH_WBNB_PAIR = '0xc0289861Ce670ecB8a75768e021b5e3e313d5940';
const SYNTH_DISCOUNT = 0.9; // 10% off for SYNTH

const PLANS = [
  { id: '7d', days: 7, usdPrice: 10, label: '7 天', perDay: '~$1.43/天' },
  { id: '14d', days: 14, usdPrice: 18.5, label: '14 天', perDay: '~$1.32/天', popular: true },
  { id: '30d', days: 30, usdPrice: 30, label: '30 天', perDay: '~$1.00/天' },
] as const;

const PAYMENT_METHODS = [
  { id: 'synth', label: 'SYNTH', icon: '🔥', discount: true },
  { id: 'usdt', label: 'USDT', icon: '💵', discount: false },
  { id: 'bnb', label: 'BNB', icon: '🟡', discount: false },
] as const;

const PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const toAmountString = (value: number, decimals = 18) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value.toFixed(decimals).replace(/\.?0+$/, '');
};

const formatTokenDisplay = (value: number, decimals = 2) => {
  if (!Number.isFinite(value) || value <= 0) return '--';
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
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
  const [soulMd, setSoulMd] = useState('');
  const [soulDirty, setSoulDirty] = useState(false);
  const [soulSaving, setSoulSaving] = useState(false);
  const [soulMessage, setSoulMessage] = useState<string | null>(null);

  const [renewPlan, setRenewPlan] = useState<string>('14d');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<string>('synth');
  const [renewFormError, setRenewFormError] = useState('');
  const [renewError, setRenewError] = useState('');
  const [renewFlowStep, setRenewFlowStep] = useState<'idle' | 'paying' | 'signing' | 'renewing' | 'success'>('idle');
  const [bnbUsdPrice, setBnbUsdPrice] = useState(0);
  const [planInitialized, setPlanInitialized] = useState(false);

  const { writeContract, data: tokenTxHash, isPending: isTokenPending, error: tokenError } = useWriteContract();
  const { sendTransaction, data: bnbTxHash, isPending: isBnbPending, error: bnbError } = useSendTransaction();
  const { signMessageAsync } = useSignMessage();
  const renewTxHash = renewPaymentMethod === 'bnb' ? bnbTxHash : tokenTxHash;
  const isRenewPending = renewPaymentMethod === 'bnb' ? isBnbPending : isTokenPending;
  const renewTxError = renewPaymentMethod === 'bnb' ? bnbError : tokenError;
  const { isSuccess: isRenewTxSuccess } = useWaitForTransactionReceipt({ hash: renewTxHash });

  const { data: reserves } = useReadContract({
    address: SYNTH_WBNB_PAIR,
    abi: PAIR_ABI,
    functionName: 'getReserves',
    query: { refetchInterval: PRICE_REFRESH_MS },
  });

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

  useEffect(() => {
    if (agent && !planInitialized) {
      setRenewPlan(agent.plan || '14d');
      setPlanInitialized(true);
    }
    if (agent && !soulDirty) {
      setSoulMd(agent.soul_md ?? '');
    }
  }, [agent, planInitialized, soulDirty]);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
        const data = await res.json();
        setBnbUsdPrice(data.binancecoin?.usd || 0);
      } catch {
        setBnbUsdPrice(0);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, PRICE_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const synthUsdPrice = useMemo(() => {
    if (!reserves || bnbUsdPrice <= 0) return null;
    const [reserve0, reserve1] = reserves as readonly [bigint, bigint, number];
    if (!reserve0 || !reserve1 || reserve0 === 0n || reserve1 === 0n) return null;
    const reserve0Amount = Number(formatEther(reserve0));
    const reserve1Amount = Number(formatEther(reserve1));
    if (!Number.isFinite(reserve0Amount) || !Number.isFinite(reserve1Amount)) return null;
    if (reserve0Amount <= 0 || reserve1Amount <= 0) return null;
    const synthPriceInBnb = reserve1Amount / reserve0Amount;
    return synthPriceInBnb * bnbUsdPrice;
  }, [reserves, bnbUsdPrice]);

  const currentPlan = useMemo(
    () => PLANS.find(plan => plan.id === renewPlan) || PLANS[1],
    [renewPlan]
  );

  const currentPayment = useMemo(
    () => PAYMENT_METHODS.find(method => method.id === renewPaymentMethod) || PAYMENT_METHODS[0],
    [renewPaymentMethod]
  );

  const paymentInfo = useMemo(() => {
    const baseUsd = currentPlan.usdPrice;

    if (renewPaymentMethod === 'synth') {
      const discountedUsd = baseUsd * SYNTH_DISCOUNT;
      if (!synthUsdPrice || synthUsdPrice <= 0) return { amount: 0, display: '--', usd: discountedUsd };
      const amount = discountedUsd / synthUsdPrice;
      return { amount, display: formatTokenDisplay(amount, 0), usd: discountedUsd };
    }

    if (renewPaymentMethod === 'bnb') {
      if (!bnbUsdPrice || bnbUsdPrice <= 0) return { amount: 0, display: '--', usd: baseUsd };
      const amount = baseUsd / bnbUsdPrice;
      return { amount, display: formatTokenDisplay(amount, 4), usd: baseUsd };
    }

    return { amount: baseUsd, display: formatTokenDisplay(baseUsd, 2), usd: baseUsd };
  }, [currentPlan.usdPrice, renewPaymentMethod, synthUsdPrice, bnbUsdPrice]);

  const isRenewConfirming = Boolean(renewTxHash) && !isRenewTxSuccess;
  const isRenewPaying = renewFlowStep === 'paying' || isRenewPending || isRenewConfirming;
  const isRenewSigning = renewFlowStep === 'signing';
  const isRenewing = renewFlowStep === 'renewing';

  useEffect(() => {
    if (renewTxError) {
      setRenewFlowStep('idle');
    }
  }, [renewTxError]);

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

  const handleSoulSave = async () => {
    if (!agentId || !address) return;
    setSoulSaving(true);
    setSoulMessage(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soul_md: soulMd,
          user_address: address,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save SOUL.md');
      }
      const updated = await res.json();
      setAgent(updated);
      setSoulDirty(false);
      setSoulMessage('SOUL.md saved');
    } catch (err) {
      setSoulMessage(err instanceof Error ? err.message : 'Failed to save SOUL.md');
    } finally {
      setSoulSaving(false);
    }
  };

  const renewAgent = useCallback(async () => {
    if (!address || !renewTxHash) {
      setRenewError('缺少钱包地址或交易哈希');
      setRenewFlowStep('idle');
      return;
    }

    try {
      setRenewError('');
      setRenewFlowStep('signing');
      const message = `SynthLaunch Agent Renewal\n\nAgent ID: ${agentId}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      setRenewFlowStep('renewing');

      const payload = {
        user_address: address,
        plan: renewPlan,
        payment_method: renewPaymentMethod,
        payment_amount: paymentInfo.amount,
        tx_hash: renewTxHash,
        signature,
        message,
      };

      const res = await fetch(`/api/agents/${agentId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '续费失败，请稍后重试');
      }

      setRenewFlowStep('success');
      await fetchAgent();
    } catch (err) {
      console.error('[renew-agent] error:', err);
      setRenewError(err instanceof Error ? err.message : '续费失败，请稍后重试');
      setRenewFlowStep('idle');
    }
  }, [
    address,
    renewTxHash,
    signMessageAsync,
    renewPlan,
    renewPaymentMethod,
    paymentInfo.amount,
    agentId,
    fetchAgent,
  ]);

  useEffect(() => {
    if (isRenewTxSuccess && renewFlowStep === 'paying') {
      void renewAgent();
    }
  }, [isRenewTxSuccess, renewFlowStep, renewAgent]);

  const handleRenewPayment = () => {
    if (!paymentInfo.amount || paymentInfo.amount <= 0) {
      setRenewFormError('价格获取中，请稍后重试');
      return;
    }
    setRenewFormError('');
    setRenewError('');
    setRenewFlowStep('paying');

    if (renewPaymentMethod === 'synth') {
      writeContract({
        address: SYNTH_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [DEAD_ADDRESS, parseEther(toAmountString(paymentInfo.amount))],
      });
    } else if (renewPaymentMethod === 'usdt') {
      writeContract({
        address: USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [TREASURY_ADDRESS, parseUnits(toAmountString(paymentInfo.amount, 18), 18)],
      });
    } else {
      sendTransaction({
        to: TREASURY_ADDRESS,
        value: parseEther(toAmountString(paymentInfo.amount)),
      });
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

              {/* Prominent Deploy Button for Pending status */}
              {agent.status === 'pending' && (
                <div className="mt-6 p-4 border border-blue-500/30 rounded-lg bg-blue-500/10">
                  <p className="text-blue-300 text-sm mb-3">
                    ⚡ Your agent is ready to deploy! Click the button below to start your AI agent.
                  </p>
                  <button
                    onClick={() => handleAction('deploy')}
                    disabled={actionLoading !== null}
                    className="w-full px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-lg"
                  >
                    {actionLoading === 'deploy' ? '⏳ Deploying...' : '🚀 Deploy Agent'}
                  </button>
                </div>
              )}
            </div>

            {/* SOUL.md Editor */}
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-synth-text">SOUL.md</h2>
                {soulMessage && (
                  <span className="text-xs text-synth-muted">{soulMessage}</span>
                )}
              </div>
              <textarea
                className="input-field w-full min-h-[220px] font-mono text-sm"
                value={soulMd}
                onChange={(e) => {
                  setSoulMd(e.target.value);
                  setSoulDirty(true);
                  setSoulMessage(null);
                }}
                placeholder="Define your agent personality here..."
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-synth-muted text-xs">
                  Updates are applied to the running agent after save.
                </p>
                <button
                  type="button"
                  onClick={handleSoulSave}
                  disabled={!soulDirty || soulSaving}
                  className="btn-primary px-4 py-2 disabled:opacity-50"
                >
                  {soulSaving ? 'Saving...' : 'Save SOUL.md'}
                </button>
              </div>
            </div>

            {/* Renew Subscription */}
            <div className="card mb-6 space-y-4">
              <h2 className="text-lg font-bold text-synth-text">Renew Subscription</h2>

              <div className="space-y-3">
                <div className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Choose Plan</div>
                <div className="grid grid-cols-3 gap-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setRenewPlan(plan.id)}
                      className={`relative p-3 rounded-lg border-2 transition-all text-center ${
                        renewPlan === plan.id
                          ? 'border-synth-green bg-synth-green/10'
                          : 'border-synth-border bg-synth-surface hover:border-synth-green/50'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-synth-green text-synth-bg text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap">
                          推荐
                        </div>
                      )}
                      <div className="text-synth-muted text-sm mb-1">{plan.label}</div>
                      <div className="text-synth-green font-bold text-xl">${plan.usdPrice}</div>
                      <div className="text-synth-muted text-[10px]">{plan.perDay}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Payment Method</div>
                <div className="grid grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setRenewPaymentMethod(method.id)}
                      className={`relative p-3 rounded-lg border-2 transition-all text-center ${
                        renewPaymentMethod === method.id
                          ? 'border-synth-green bg-synth-green/10'
                          : 'border-synth-border bg-synth-surface hover:border-synth-green/50'
                      }`}
                    >
                      {method.discount && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap">
                          -10%
                        </div>
                      )}
                      <div className="text-xl mb-1">{method.icon}</div>
                      <div className="text-synth-text font-bold text-sm">{method.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Payment Summary</div>
                <div className="bg-synth-surface/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-synth-muted">Plan</span>
                    <span className="text-synth-text">{currentPlan.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-synth-muted">Payment</span>
                    <span className="text-synth-text">{currentPayment.icon} {currentPayment.label}</span>
                  </div>
                  {renewPaymentMethod === 'synth' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-synth-muted">SYNTH Discount</span>
                      <span className="text-red-400">-10%</span>
                    </div>
                  )}
                  <div className="border-t border-synth-border pt-2 flex items-center justify-between">
                    <span className="text-synth-muted font-bold">Total</span>
                    <span className="text-synth-green font-bold text-lg">
                      {paymentInfo.display} {currentPayment.label}
                      {renewPaymentMethod !== 'usdt' && (
                        <span className="text-synth-muted text-xs ml-1">(≈${paymentInfo.usd})</span>
                      )}
                    </span>
                  </div>
                </div>

                {renewPaymentMethod === 'synth' && (
                  <p className="text-[11px] text-synth-muted">
                    🔥 SYNTH will be burned (sent to dead address)
                  </p>
                )}
                {renewPaymentMethod !== 'synth' && (
                  <p className="text-[11px] text-synth-muted">
                    💰 {currentPayment.label} will be sent to the treasury
                  </p>
                )}

                {renewFlowStep === 'success' ? (
                  <div className="border border-synth-green/30 bg-synth-green/5 rounded-lg p-4 text-center space-y-2">
                    <div className="text-2xl">✅</div>
                    <p className="text-synth-green font-bold">Renewal successful</p>
                    <p className="text-xs text-synth-muted">Expiration updated.</p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
                      onClick={handleRenewPayment}
                      disabled={isRenewPaying || isRenewSigning || isRenewing || renewFlowStep === 'success'}
                    >
                      {isRenewPaying ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Processing payment...
                        </>
                      ) : isRenewSigning ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Waiting for signature...
                        </>
                      ) : isRenewing ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Renewing...
                        </>
                      ) : (
                        <>
                          {renewPaymentMethod === 'synth' ? '🔥' : '💳'} Pay {paymentInfo.display} {currentPayment.label}
                        </>
                      )}
                    </button>

                    {isRenewTxSuccess && renewFlowStep === 'idle' && renewError && (
                      <button
                        type="button"
                        className="mt-3 w-full px-4 py-2 border border-synth-cyan/40 text-synth-cyan rounded hover:bg-synth-cyan/10 transition-colors text-sm"
                        onClick={() => void renewAgent()}
                      >
                        Retry signature and renew
                      </button>
                    )}

                    {(renewFlowStep !== 'idle' || renewTxHash) && (
                      <div className="mt-3 space-y-1 text-xs text-synth-muted">
                        <div className={isRenewTxSuccess ? 'text-synth-green' : isRenewPaying ? 'text-synth-cyan' : ''}>
                          {isRenewTxSuccess ? '✅ Payment complete' : isRenewPaying ? '⏳ Paying' : '• Awaiting payment'}
                        </div>
                        <div className={isRenewSigning ? 'text-synth-cyan' : isRenewing || renewFlowStep === 'success' ? 'text-synth-green' : ''}>
                          {isRenewSigning ? '⏳ Signing' : isRenewing || renewFlowStep === 'success' ? '✅ Signed' : '• Signature'}
                        </div>
                        <div className={isRenewing ? 'text-synth-cyan' : renewFlowStep === 'success' ? 'text-synth-green' : ''}>
                          {isRenewing ? '⏳ Renewing' : renewFlowStep === 'success' ? '✅ Renewed' : '• Renew'}
                        </div>
                      </div>
                    )}

                    {renewFormError && (
                      <p className="text-red-400 text-xs text-center mt-2">{renewFormError}</p>
                    )}
                    {renewError && (
                      <p className="text-red-400 text-xs text-center mt-2">
                        Renewal failed: {renewError}
                      </p>
                    )}
                    {renewTxError && (
                      <p className="text-red-400 text-xs text-center mt-2">
                        Payment failed: {renewTxError.message}
                      </p>
                    )}
                    {renewTxHash && !isRenewTxSuccess && (
                      <p className="text-synth-cyan text-xs text-center mt-2">
                        Tx submitted:{' '}
                        <a
                          href={`https://bscscan.com/tx/${renewTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {renewTxHash.slice(0, 10)}...
                        </a>
                      </p>
                    )}
                  </>
                )}
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
