'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSendTransaction,
  useSignMessage,
} from 'wagmi';
import { parseEther, formatEther, parseUnits } from 'viem';
import { WalletConnect } from '@/components/WalletConnect';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ERC20_ABI } from '@/lib/erc20';
import { SYNTH_TOKEN_ADDRESS } from '@/lib/contracts';

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

type FormState = {
  name: string;
  botToken: string;
  description: string;
};

const toAmountString = (value: number, decimals = 18) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value.toFixed(decimals).replace(/\.?0+$/, '');
};

const formatTokenDisplay = (value: number, decimals = 2) => {
  if (!Number.isFinite(value) || value <= 0) return '--';
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

function CreateAgentPageInner() {
  const router = useRouter();
  const { isConnected, address } = useAccount();

  const [form, setForm] = useState<FormState>({
    name: '',
    botToken: '',
    description: '',
  });
  const [selectedPlan, setSelectedPlan] = useState<string>('14d');
  const [paymentMethod, setPaymentMethod] = useState<string>('synth');
  const [formError, setFormError] = useState('');
  const [createError, setCreateError] = useState('');
  const [flowStep, setFlowStep] = useState<'idle' | 'paying' | 'signing' | 'creating' | 'success'>('idle');
  const [bnbUsdPrice, setBnbUsdPrice] = useState(0);

  const { writeContract, data: tokenTxHash, isPending: isTokenPending, error: tokenError } = useWriteContract();
  const { sendTransaction, data: bnbTxHash, isPending: isBnbPending, error: bnbError } = useSendTransaction();
  const { signMessageAsync } = useSignMessage();
  
  const txHash = paymentMethod === 'bnb' ? bnbTxHash : tokenTxHash;
  const isPending = paymentMethod === 'bnb' ? isBnbPending : isTokenPending;
  const txError = paymentMethod === 'bnb' ? bnbError : tokenError;
  
  const { isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const currentPlan = PLANS.find(p => p.id === selectedPlan) || PLANS[1];
  const currentPayment = PAYMENT_METHODS.find(p => p.id === paymentMethod) || PAYMENT_METHODS[0];

  // Fetch BNB price
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

  // Fetch SYNTH price from pair
  const { data: reserves } = useReadContract({
    address: SYNTH_WBNB_PAIR,
    abi: PAIR_ABI,
    functionName: 'getReserves',
    query: { refetchInterval: PRICE_REFRESH_MS },
  });

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

  // Calculate payment amounts
  const paymentInfo = useMemo(() => {
    const baseUsd = currentPlan.usdPrice;
    
    if (paymentMethod === 'synth') {
      const discountedUsd = baseUsd * SYNTH_DISCOUNT;
      if (!synthUsdPrice || synthUsdPrice <= 0) return { amount: 0, display: '--', usd: discountedUsd };
      const amount = discountedUsd / synthUsdPrice;
      return { amount, display: formatTokenDisplay(amount, 0), usd: discountedUsd };
    }
    
    if (paymentMethod === 'bnb') {
      if (!bnbUsdPrice || bnbUsdPrice <= 0) return { amount: 0, display: '--', usd: baseUsd };
      const amount = baseUsd / bnbUsdPrice;
      return { amount, display: formatTokenDisplay(amount, 4), usd: baseUsd };
    }
    
    // USDT
    return { amount: baseUsd, display: formatTokenDisplay(baseUsd, 2), usd: baseUsd };
  }, [currentPlan.usdPrice, paymentMethod, synthUsdPrice, bnbUsdPrice]);

  const isFormValid = form.name.trim().length > 0 && form.botToken.trim().length > 0;
  const isConfirming = Boolean(txHash) && !isTxSuccess;
  const isPaying = flowStep === 'paying' || isPending || isConfirming;
  const isSigning = flowStep === 'signing';
  const isCreating = flowStep === 'creating';

  useEffect(() => {
    if (flowStep === 'success') {
      const timer = setTimeout(() => router.push('/dashboard'), 1500);
      return () => clearTimeout(timer);
    }
  }, [flowStep, router]);

  useEffect(() => {
    if (txError) {
      setFlowStep('idle');
    }
  }, [txError]);

  const createAgent = useCallback(async () => {
    if (!address || !txHash) {
      setCreateError('缺少钱包地址或交易哈希');
      setFlowStep('idle');
      return;
    }

    try {
      setCreateError('');
      setFlowStep('signing');
      const message = `SynthLaunch Agent Creation\n\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      setFlowStep('creating');

      const expiresAt = new Date(Date.now() + currentPlan.days * 24 * 60 * 60 * 1000).toISOString();
      const payload = {
        user_address: address,
        name: form.name.trim(),
        bot_token: form.botToken.trim(),
        description: form.description.trim() || null,
        plan: selectedPlan,
        payment_method: paymentMethod,
        payment_amount: paymentInfo.amount,
        expires_at: expiresAt,
        tx_hash: txHash,
        signature,
        message,
      };

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '创建失败，请稍后重试');
      }

      setFlowStep('success');
    } catch (error) {
      console.error('[create-agent] error:', error);
      setCreateError(error instanceof Error ? error.message : '创建失败，请稍后重试');
      setFlowStep('idle');
    }
  }, [
    address,
    txHash,
    signMessageAsync,
    currentPlan.days,
    form.name,
    form.botToken,
    form.description,
    selectedPlan,
    paymentMethod,
    paymentInfo.amount,
  ]);

  useEffect(() => {
    if (isTxSuccess && flowStep === 'paying') {
      void createAgent();
    }
  }, [isTxSuccess, flowStep, createAgent]);

  const handlePayment = () => {
    if (!isFormValid) {
      setFormError('请填写 Agent 名称和 Telegram Bot Token');
      return;
    }
    if (!paymentInfo.amount || paymentInfo.amount <= 0) {
      setFormError('价格获取中，请稍后重试');
      return;
    }
    setFormError('');
    setCreateError('');
    setFlowStep('paying');

    if (paymentMethod === 'synth') {
      // Burn SYNTH to dead address
      writeContract({
        address: SYNTH_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [DEAD_ADDRESS, parseEther(toAmountString(paymentInfo.amount))],
      });
    } else if (paymentMethod === 'usdt') {
      // Send USDT to treasury
      writeContract({
        address: USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [TREASURY_ADDRESS, parseUnits(toAmountString(paymentInfo.amount, 18), 18)],
      });
    } else {
      // Send BNB to treasury
      sendTransaction({
        to: TREASURY_ADDRESS,
        value: parseEther(toAmountString(paymentInfo.amount)),
      });
    }
  };

  return (
    <main className="min-h-screen bg-synth-bg pt-20 px-4 pb-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-synth-text">创建 AI Agent</h1>
            <p className="text-sm text-synth-muted">填写信息并付款开通</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-synth-muted hover:text-synth-green transition-colors"
          >
            ← 返回 Dashboard
          </Link>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Agent 信息</h2>

          <div className="space-y-2">
            <label className="text-sm text-synth-muted">
              Agent 名称 <span className="text-synth-green">*</span>
            </label>
            <input
              className="input-field w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：SynthSupportBot"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-synth-muted">
              Telegram Bot Token <span className="text-synth-green">*</span>
            </label>
            <input
              className="input-field w-full font-mono"
              value={form.botToken}
              onChange={(e) => setForm({ ...form, botToken: e.target.value })}
              placeholder="例如：7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <details className="text-[11px] text-synth-muted">
              <summary className="cursor-pointer hover:text-synth-green transition-colors">
                📖 如何获取 Bot Token？点击展开教程
              </summary>
              <div className="mt-2 p-3 bg-synth-surface/50 rounded-lg space-y-2 border border-synth-border">
                <p className="font-bold text-synth-text">3 步创建 Telegram Bot：</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>打开 Telegram，搜索 <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-synth-cyan underline">@BotFather</a></li>
                  <li>发送 <code className="bg-synth-bg px-1 rounded">/newbot</code>，按提示输入机器人名称和用户名</li>
                  <li>BotFather 会回复一个 Token，格式类似：<code className="bg-synth-bg px-1 rounded text-[10px]">7123456789:AAH...</code></li>
                </ol>
                <p className="text-synth-muted pt-1">复制这个 Token 粘贴到上面的输入框即可 ✅</p>
              </div>
            </details>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-synth-muted">简介/描述</label>
            <textarea
              className="input-field w-full min-h-[96px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="描述 Agent 的用途和能力（选填）"
            />
          </div>
        </div>

        {/* Plan Selection */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">选择套餐</h2>
          <div className="grid grid-cols-3 gap-3">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-4 rounded-lg border-2 transition-all text-center ${
                  selectedPlan === plan.id
                    ? 'border-synth-green bg-synth-green/10'
                    : 'border-synth-border bg-synth-surface hover:border-synth-green/50'
                }`}
              >
                {'popular' in plan && plan.popular && (
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

        {/* Payment Method Selection */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">支付方式</h2>
          <div className="grid grid-cols-3 gap-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id)}
                className={`relative p-3 rounded-lg border-2 transition-all text-center ${
                  paymentMethod === method.id
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

        {/* Payment Summary */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">付款确认</h2>
          
          <div className="bg-synth-surface/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-synth-muted">套餐</span>
              <span className="text-synth-text">{currentPlan.label}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-synth-muted">支付方式</span>
              <span className="text-synth-text">{currentPayment.icon} {currentPayment.label}</span>
            </div>
            {paymentMethod === 'synth' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-synth-muted">SYNTH 专属折扣</span>
                <span className="text-red-400">-10%</span>
              </div>
            )}
            <div className="border-t border-synth-border pt-2 flex items-center justify-between">
              <span className="text-synth-muted font-bold">应付</span>
              <span className="text-synth-green font-bold text-lg">
                {paymentInfo.display} {currentPayment.label}
                {paymentMethod !== 'usdt' && (
                  <span className="text-synth-muted text-xs ml-1">(≈${paymentInfo.usd})</span>
                )}
              </span>
            </div>
          </div>

          {paymentMethod === 'synth' && (
            <p className="text-[11px] text-synth-muted">
              🔥 SYNTH 将被燃烧销毁（发送至死亡地址）
            </p>
          )}
          {paymentMethod !== 'synth' && (
            <p className="text-[11px] text-synth-muted">
              💰 {currentPayment.label} 将发送至平台 Treasury
            </p>
          )}

          {flowStep === 'success' ? (
            <div className="border border-synth-green/30 bg-synth-green/5 rounded-lg p-4 text-center space-y-2">
              <div className="text-2xl">✅</div>
              <p className="text-synth-green font-bold">创建成功</p>
              <p className="text-xs text-synth-muted">正在返回 Dashboard…</p>
            </div>
          ) : !isConnected ? (
            <div className="text-center">
              <p className="text-sm text-synth-muted mb-3">连接钱包后可付款并创建</p>
              <WalletConnect />
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
                onClick={handlePayment}
                disabled={!isFormValid || isPaying || isSigning || isCreating}
              >
                {isPaying ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    付款处理中...
                  </>
                ) : isSigning ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    等待签名...
                  </>
                ) : isCreating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    创建中...
                  </>
                ) : (
                  <>
                    {paymentMethod === 'synth' ? '🔥' : '💳'} 支付 {paymentInfo.display} {currentPayment.label}
                  </>
                )}
              </button>

              {isTxSuccess && flowStep === 'idle' && createError && (
                <button
                  type="button"
                  className="mt-3 w-full px-4 py-2 border border-synth-cyan/40 text-synth-cyan rounded hover:bg-synth-cyan/10 transition-colors text-sm"
                  onClick={() => void createAgent()}
                >
                  重试签名并创建
                </button>
              )}

              {(flowStep !== 'idle' || txHash) && (
                <div className="mt-3 space-y-1 text-xs text-synth-muted">
                  <div className={isTxSuccess ? 'text-synth-green' : isPaying ? 'text-synth-cyan' : ''}>
                    {isTxSuccess ? '✅ 付款完成' : isPaying ? '⏳ 付款中' : '• 等待付款'}
                  </div>
                  <div className={flowStep === 'signing' ? 'text-synth-cyan' : flowStep === 'creating' ? 'text-synth-green' : ''}>
                    {flowStep === 'signing' ? '⏳ 钱包签名中' : flowStep === 'creating' ? '✅ 已签名' : '• 签名'}
                  </div>
                  <div className={flowStep === 'creating' ? 'text-synth-cyan' : ''}>
                    {flowStep === 'creating' ? '⏳ 创建中' : '• 创建'}
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-red-400 text-xs text-center mt-2">{formError}</p>
              )}
              {createError && (
                <p className="text-red-400 text-xs text-center mt-2">
                  创建失败：{createError}
                </p>
              )}
              {txError && (
                <p className="text-red-400 text-xs text-center mt-2">
                  支付失败：{txError.message}
                </p>
              )}
              {txHash && !isTxSuccess && (
                <p className="text-synth-cyan text-xs text-center mt-2">
                  Tx submitted:{' '}
                  <a
                    href={`https://bscscan.com/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {txHash.slice(0, 10)}...
                  </a>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CreateAgentPage() {
  return (
    <ErrorBoundary>
      <CreateAgentPageInner />
    </ErrorBoundary>
  );
}
