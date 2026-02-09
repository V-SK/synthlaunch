'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { WalletConnect } from '@/components/WalletConnect';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ERC20_ABI } from '@/lib/erc20';
import { SYNTH_TOKEN_ADDRESS } from '@/lib/contracts';

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const USD_FEE = 10;
const FALLBACK_SYNTH_AMOUNT = 10;
const PRICE_REFRESH_MS = 60_000;

type FormState = {
  name: string;
  botToken: string;
  description: string;
};

const toAmountString = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value.toFixed(18).replace(/\.?0+$/, '');
};

const formatSynthDisplay = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '--';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

function CreateAgentPageInner() {
  const router = useRouter();
  const { isConnected } = useAccount();

  const [form, setForm] = useState<FormState>({
    name: '',
    botToken: '',
    description: '',
  });
  const [formError, setFormError] = useState('');
  const [synthUsdPrice, setSynthUsdPrice] = useState<number | null>(null);

  const { writeContract, data: burnTxHash, isPending, error: burnError } = useWriteContract();
  const { isSuccess: isBurnSuccess } = useWaitForTransactionReceipt({ hash: burnTxHash });

  useEffect(() => {
    let active = true;
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain?contract_addresses=${SYNTH_TOKEN_ADDRESS}&vs_currencies=usd`
        );
        const data = await res.json();
        const price = data?.[SYNTH_TOKEN_ADDRESS.toLowerCase()]?.usd;
        if (active) {
          setSynthUsdPrice(typeof price === 'number' && price > 0 ? price : null);
        }
      } catch {
        if (active) setSynthUsdPrice(null);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, PRICE_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const computedSynthAmount = useMemo(() => {
    if (!synthUsdPrice || synthUsdPrice <= 0) return null;
    return USD_FEE / synthUsdPrice;
  }, [synthUsdPrice]);

  const burnAmount = computedSynthAmount ?? FALLBACK_SYNTH_AMOUNT;
  const burnAmountString = useMemo(() => toAmountString(burnAmount), [burnAmount]);
  const approxSynthDisplay = formatSynthDisplay(computedSynthAmount ?? FALLBACK_SYNTH_AMOUNT);

  const isFormValid = form.name.trim().length > 0 && form.botToken.trim().length > 0;
  const isConfirming = Boolean(burnTxHash) && !isBurnSuccess;

  useEffect(() => {
    if (isBurnSuccess) {
      const timer = setTimeout(() => router.push('/dashboard'), 1500);
      return () => clearTimeout(timer);
    }
  }, [isBurnSuccess, router]);

  const handleBurn = () => {
    if (!isFormValid) {
      setFormError('请填写 Agent 名称和 Telegram Bot Token');
      return;
    }
    setFormError('');
    writeContract({
      address: SYNTH_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [DEAD_ADDRESS, parseEther(burnAmountString)],
    });
  };

  return (
    <main className="min-h-screen bg-synth-bg pt-20 px-4 pb-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-synth-text">创建 AI Agent</h1>
            <p className="text-sm text-synth-muted">填写信息并燃烧 SYNTH 开通</p>
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
              placeholder="从 @BotFather 获取"
            />
            <p className="text-[11px] text-synth-muted">
              请在 Telegram 中使用 @BotFather 创建机器人并获取 Token
            </p>
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

        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">费用与燃烧</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-synth-muted">费用</span>
            <span className="text-synth-green font-bold">
              $10 SYNTH（约 {approxSynthDisplay} 个 SYNTH）
            </span>
          </div>

          {isBurnSuccess ? (
            <div className="border border-synth-green/30 bg-synth-green/5 rounded-lg p-4 text-center space-y-2">
              <div className="text-2xl">✅</div>
              <p className="text-synth-green font-bold">创建成功</p>
              <p className="text-xs text-synth-muted">正在返回 Dashboard…</p>
            </div>
          ) : !isConnected ? (
            <div className="text-center">
              <p className="text-sm text-synth-muted mb-3">连接钱包后可燃烧并创建</p>
              <WalletConnect />
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
                onClick={handleBurn}
                disabled={!isFormValid || isPending || isConfirming}
              >
                {isPending || isConfirming ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    燃烧中...
                  </>
                ) : (
                  <>🔥 燃烧并创建</>
                )}
              </button>

              {formError && (
                <p className="text-red-400 text-xs text-center mt-2">{formError}</p>
              )}
              {burnError && (
                <p className="text-red-400 text-xs text-center mt-2">
                  燃烧失败：{burnError.message}
                </p>
              )}
              {burnTxHash && !isBurnSuccess && (
                <p className="text-synth-cyan text-xs text-center mt-2">
                  Tx submitted:{' '}
                  <a
                    href={`https://bscscan.com/tx/${burnTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {burnTxHash.slice(0, 10)}...
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
