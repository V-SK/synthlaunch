'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Token } from '@/lib/api';
import { formatPrice, formatMarketCap, formatTimeAgo, statusLabel, chainLabelOf } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { CHAIN_CONFIG, type SupportedChainId } from '@/lib/contracts';

type FanFiProof = {
  launch: {
    fanId: string;
    name: string;
    symbol: string;
    tokenAddress: string;
    txHash: string;
    receiptHash?: string;
    settlementRule?: string;
    settlementSource?: string;
    settlementCutoff?: string;
    settlementStatus?: 'open' | 'locked' | 'resolved';
    marketCapUsd: number;
    revenueOkb: number;
    createdAt: string;
  };
  campaign: {
    title: string;
    objective: string;
    targetMatch: string;
    tone: string;
    launchDraft: string;
  } | null;
  progress: {
    fanId: string;
    handle: string;
    wallet: string;
    totalPoints: number;
    rank: number;
    completedMissions: number;
    totalMissions: number;
    completions: Array<{
      missionId: string;
      title: string;
      proof: string;
      points: number;
      completedAt: string;
    }>;
  };
};

function TokenPageInner({ params }: { params: { address: string } }) {
  const { t, locale } = useI18n();
  const isZh = locale === 'zh';
  const searchParams = useSearchParams();
  const [token, setToken] = useState<Token | null>(null);
  const [tokenChainId, setTokenChainId] = useState<SupportedChainId>(56);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [taxRevenue, setTaxRevenue] = useState<{
    totalFeesNative: number; totalFeesUsd: number;
    claimedNative: number; claimedUsd: number;
    pendingNative: number; pendingUsd: number;
  } | null>(null);
  const [fanfiProof, setFanfiProof] = useState<FanFiProof | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadToken() {
      setLoading(true);
      setToken(null);
      setTaxRevenue(null);
      setFanfiProof(null);

      const preferredChainId: SupportedChainId = searchParams.get('chainId') === '196' ? 196 : 56;
      const fallbackChainId: SupportedChainId = preferredChainId === 196 ? 56 : 196;

      for (const chainId of [preferredChainId, fallbackChainId]) {
        try {
          const tokenRes = await fetch(`/api/tokens?address=${params.address}&chainId=${chainId}`);
          if (!tokenRes.ok) continue;

          const tokenData = await tokenRes.json();
          if (cancelled) return;

          setToken(tokenData);
          setTokenChainId(chainId);
          setLoading(false);

          fetch(`/api/leaderboard?chainId=${chainId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (cancelled || !data?.entries) return;
              const entry = data.entries.find(
                (e: any) => e.tokenAddress?.toLowerCase() === params.address.toLowerCase()
              );
              if (entry) {
                setTaxRevenue({
                  totalFeesNative: entry.totalFeesNative ?? entry.totalFeesBnb ?? 0,
                  totalFeesUsd: entry.totalFeesUsd ?? 0,
                  claimedNative: entry.claimedNative ?? entry.claimedBnb ?? 0,
                  claimedUsd: entry.claimedUsd ?? 0,
                  pendingNative: entry.pendingNative ?? entry.pendingBnb ?? 0,
                  pendingUsd: entry.pendingUsd ?? 0,
                });
              }
            })
            .catch(() => {});

          return;
        } catch {
          // Try the next supported chain.
        }
      }

      if (!cancelled) setLoading(false);
    }

    loadToken();

    return () => {
      cancelled = true;
    };
  }, [params.address, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadFanFiProof() {
      if (!token || tokenChainId !== 196) {
        setFanfiProof(null);
        return;
      }

      try {
        const proofRes = await fetch(`/api/fanfi/proof?tokenAddress=${params.address}`, {
          cache: 'no-store',
        });
        if (!proofRes.ok) {
          if (!cancelled) setFanfiProof(null);
          return;
        }

        const proof = await proofRes.json();
        if (!cancelled) setFanfiProof(proof);
      } catch {
        if (!cancelled) setFanfiProof(null);
      }
    }

    loadFanFiProof();

    return () => {
      cancelled = true;
    };
  }, [params.address, token, tokenChainId]);

  const copyAddress = () => {
    navigator.clipboard.writeText(params.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
          {t('token.backToTokens')}
        </Link>
        <div className="card animate-pulse py-20 text-center">
          <span className="text-synth-muted">{t('token.loadingToken')}</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
          {t('token.backToTokens')}
        </Link>
        <div className="card py-20 text-center space-y-4">
          <span className="text-3xl">🔍</span>
          <p className="text-synth-muted">{t('token.notFound')}</p>
          <p className="text-xs text-synth-muted">
            {t('token.notFoundDesc')}
          </p>
        </div>
      </div>
    );
  }

  const isOnDex = token.status === 4;
  const chainConfig = CHAIN_CONFIG[tokenChainId];
  const nativeSymbol = chainConfig.nativeSymbol;
  const chainLabel = tokenChainId === 196 ? 'X Layer' : 'BSC';
  const flapChain = tokenChainId === 196 ? 'xlayer' : 'bsc';
  const explorerTokenUrl = tokenChainId === 196
    ? `${chainConfig.explorer}/address/${params.address}`
    : `${chainConfig.explorer}/token/${params.address}`;
  const realTxHash = fanfiProof?.launch.txHash && /^0x[0-9a-fA-F]{64}$/.test(fanfiProof.launch.txHash)
    ? fanfiProof.launch.txHash
    : '';
  const hasRealTxHash = Boolean(realTxHash);
  const explorerTxUrl = hasRealTxHash
    ? `${chainConfig.explorer.replace(/\/$/, '')}/tx/${realTxHash}`
    : '';
  const isFanFiToken =
    tokenChainId === 196 &&
    (token.agent_name === 'tw:SynthFanFi' ||
      token.description?.toLowerCase().includes('fanfi') ||
      token.meta?.startsWith('fanfi-demo:') ||
      token.meta?.startsWith('sportfi-prediction-proof:'));
  const isFanFiMarketProof =
    token.meta?.startsWith('fanfi-demo:') ||
    token.meta?.startsWith('sportfi-prediction-proof:') ||
    Boolean(fanfiProof?.launch.receiptHash);
  const metricPrefix = '';
  const externalActionClass =
    'block cursor-not-allowed rounded border border-synth-border bg-synth-surface/70 px-3 py-3 text-center text-sm font-mono text-synth-muted opacity-70';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/" className="text-sm text-synth-muted hover:text-synth-green transition-colors">
        {t('token.backToTokens')}
      </Link>

      {/* Token Header */}
      <div className="flex items-start gap-6">
        {token.image ? (
          <img src={token.image} alt={token.symbol} className="w-16 h-16 rounded-full object-cover border border-synth-border flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-synth-green/10 border border-synth-green/20 flex items-center justify-center text-synth-green text-xl font-bold flex-shrink-0">
            {token.symbol ? token.symbol.slice(0, 2) : '??'}
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-synth-text">{token.name || token.symbol}</h1>
            <span className="text-sm text-synth-muted">${token.symbol}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              isOnDex ? 'bg-synth-cyan/10 text-synth-cyan' : 'bg-synth-green/10 text-synth-green'
            }`}>
              {statusLabel(token.status)}
            </span>
            {isFanFiMarketProof && (
              <span className="rounded border border-synth-cyan/40 bg-synth-cyan/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-synth-cyan">
                {isZh ? 'Market Proof' : 'Market Proof'}
              </span>
            )}
          </div>
          {token.description && (
            <p className="text-sm text-synth-muted">{token.description}</p>
          )}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={copyAddress}
              className="text-[10px] px-1.5 py-0.5 bg-synth-surface text-synth-muted border border-synth-border rounded font-mono hover:border-synth-green/30 transition-colors"
            >
              {copied ? t('token.copied') : `${params.address.slice(0, 10)}...${params.address.slice(-6)}`}
            </button>
            {token.taxRate > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-synth-cyan/10 text-synth-cyan rounded">
                {token.taxRate}% {t('home.tax')}
              </span>
            )}
            <span className="text-[10px] text-synth-muted">
              {t('token.created')} {formatTimeAgo(token.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {isFanFiMarketProof && (
        <div className="rounded border border-synth-cyan/30 bg-synth-cyan/10 px-4 py-3 text-sm leading-6 text-synth-cyan">
          {isZh
            ? '这是 SportFi Arena 的市场证明资产，用于连接预测 Arena、排行榜积分、OKX 报价路径和 X Layer proof。'
            : 'This is a SportFi Arena market proof asset connecting the prediction arena, leaderboard points, OKX quote path, and X Layer proof.'}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: `${metricPrefix}${t('token.priceLabel')}`, value: formatPrice(token.priceUsd), color: 'text-synth-text' },
          { label: `${metricPrefix}${t('token.marketCapLabel')}`, value: formatMarketCap(token.marketCap), color: 'text-synth-green' },
          { label: `${metricPrefix}${nativeSymbol} ${isZh ? '价格' : 'Price'}`, value: token.price > 0 ? token.price.toExponential(3) : '—', color: 'text-synth-cyan' },
          { label: `${metricPrefix}${t('token.progressLabel')}`, value: isOnDex ? t('token.migrated') : `${(token.progress * 100).toFixed(1)}%`, color: isOnDex ? 'text-synth-cyan' : 'text-synth-green' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
              {stat.label}
            </span>
            <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {!isOnDex && (
        <div className="card">
          <div className="flex justify-between text-xs text-synth-muted mb-2">
            <span>{t('token.bondingCurveProgress')}</span>
            <span>{(token.progress * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-synth-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-synth-green to-synth-cyan rounded-full transition-all"
              style={{ width: `${Math.min(100, token.progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-synth-muted mt-2">
            <span>{t('token.reserve')}: {token.reserve?.toFixed(4)} {chainLabelOf(token.chain_id).nativeSymbol}</span>
            <span>{t('token.supply')}: {(token.circulatingSupply / 1e6).toFixed(1)}M / 1B</span>
          </div>
        </div>
      )}

      {/* Fee Sharing Info */}
      {token.taxRate > 0 && token.agent_name && (
        <div className="card border-synth-purple/30 bg-synth-purple/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-sm font-bold text-synth-purple uppercase tracking-wider">{isZh ? '手续费分润' : 'Fee Sharing'}</h2>
              <p className="text-sm text-synth-muted mt-1">
                {token.taxRate}% {isZh ? '交易税分润给' : 'trading tax shared with'}
              </p>
            </div>
            <a
              href={token.agent_name.startsWith('tw:')
                ? `https://x.com/${token.agent_name.slice(3)}`
                : `https://moltbook.com/u/${token.agent_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-sm px-3 py-1.5 bg-synth-purple/10 text-synth-purple rounded-lg font-mono hover:bg-synth-purple/20 transition-colors"
            >
              {token.agent_name.startsWith('tw:')
                ? `🐦 @${token.agent_name.slice(3)}`
                : `🦞 ${token.agent_name}`}
              <span className="ml-1 text-[10px]">↗</span>
            </a>
          </div>
        </div>
      )}

      {/* Tax Revenue */}
      {taxRevenue && (
        <div className="card">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider mb-4">
            💰 {t('token.taxRevenue')}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
                {t('token.totalRevenue')}
              </span>
              <span className="text-lg font-bold text-synth-green">{taxRevenue.totalFeesBnb.toFixed(4)} {chainLabelOf(token.chain_id).nativeSymbol}</span>
              <span className="text-xs text-synth-muted block">${taxRevenue.totalFeesUsd.toFixed(2)}</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
                {t('token.claimed')}
              </span>
              <span className="text-lg font-bold text-synth-cyan">{taxRevenue.claimedBnb.toFixed(4)} {chainLabelOf(token.chain_id).nativeSymbol}</span>
              <span className="text-xs text-synth-muted block">${taxRevenue.claimedUsd.toFixed(2)}</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-synth-muted uppercase tracking-wider block mb-1">
                {t('token.pendingClaim')}
              </span>
              <span className="text-lg font-bold text-synth-green">{taxRevenue.pendingBnb.toFixed(4)} {chainLabelOf(token.chain_id).nativeSymbol}</span>
              <span className="text-xs text-synth-muted block">${taxRevenue.pendingUsd.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* FanFi Proof */}
      {(isFanFiToken || fanfiProof) && (
        <div className="card border-synth-cyan/30 bg-synth-cyan/5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-synth-cyan">
                {isZh ? 'SportFi 证明' : 'SportFi Proof'}
              </div>
              <h2 className="mt-2 text-lg font-bold text-synth-text">
                {isZh ? 'X Cup Market Proof' : 'X Cup Market Proof'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-synth-muted">
                {isZh
                  ? '该 X Layer 资产的球迷 Agent、活动、任务积分和 OKX 报价审核路径。'
                  : 'Fan agent, campaign, mission points, and OKX quote-review path for this X Layer asset.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/fanfi/xcup" className="btn-secondary text-xs">
                {isZh ? '竞技场' : 'Arena'}
              </Link>
              <Link href="/fanfi/xcup/audit" className="btn-secondary text-xs">
                {isZh ? '审计' : 'Audit'}
              </Link>
            </div>
          </div>

          {fanfiProof ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    Fan ID
                  </div>
                  <div className="mt-2 truncate text-sm font-bold text-synth-text">
                    {fanfiProof.progress.fanId}
                  </div>
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {isZh ? '积分' : 'Points'}
                  </div>
                  <div className="mt-2 text-sm font-bold text-synth-green">
                    {fanfiProof.progress.totalPoints}
                  </div>
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {isZh ? '任务' : 'Missions'}
                  </div>
                  <div className="mt-2 text-sm font-bold text-synth-cyan">
                    {fanfiProof.progress.completedMissions}/{fanfiProof.progress.totalMissions}
                  </div>
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {isZh ? '排名' : 'Rank'}
                  </div>
                  <div className="mt-2 text-sm font-bold text-synth-text">
                    #{fanfiProof.progress.rank}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border border-synth-border bg-synth-bg px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                    {isZh ? '活动任务' : 'Campaign Mission'}
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-synth-text">
                    {fanfiProof.campaign?.title || fanfiProof.launch.name}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-synth-muted">
                    {fanfiProof.campaign?.objective || (isZh ? '已附加 SportFi 活动证明。' : 'SportFi campaign proof attached.')}
                  </p>
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                    {isZh ? '交易审核' : 'Trading Review'}
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-synth-text">
                    {isZh ? 'OKX 路径已准备' : 'OKX route prepared'}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-synth-muted">
                    {isZh
                      ? `搜索 $${fanfiProof.launch.symbol}，检查 OKB 余额，生成报价证明，并把 swap 执行交给钱包确认。`
                      : `Search $${fanfiProof.launch.symbol}, inspect OKB balance, build quote proof, and route swap execution through wallet confirmation.`}
                  </p>
                </div>
              </div>

              <div className="rounded border border-synth-green/20 bg-synth-green/5 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                  {isZh ? 'Receipt Proof' : 'Receipt Proof'}
                </div>
                <div className="mt-2 break-all text-xs text-synth-green">
                  {fanfiProof.launch.tokenAddress} / {fanfiProof.launch.receiptHash || fanfiProof.launch.txHash || 'pending'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border border-synth-border bg-synth-bg px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                        {isZh ? '结算规则' : 'Settlement Rule'}
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-synth-text">
                        {fanfiProof.launch.settlementStatus || 'open'}
                      </h3>
                    </div>
                    <span className="rounded border border-synth-green/30 bg-synth-green/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-synth-green">
                      X Layer
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-synth-muted">
                    {fanfiProof.launch.settlementRule ||
                      (isZh
                        ? '按官方结果结算方向，按概率接近度、早期提交和理由质量更新 reputation。'
                        : 'Resolve direction against the official result, then update reputation by probability distance, early receipt, and reason quality.')}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                        {isZh ? '结算源' : 'Source'}
                      </div>
                      <div className="mt-1 text-synth-text">
                        {fanfiProof.launch.settlementSource || (isZh ? '官方最终比分' : 'Official final score')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                        {isZh ? '锁盘' : 'Lock'}
                      </div>
                      <div className="mt-1 text-synth-text">
                        {fanfiProof.launch.settlementCutoff || (isZh ? 'Kickoff 前 30 分钟' : '30 minutes before kickoff')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-synth-border bg-synth-bg px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                    {isZh ? 'Receipt / OKLink' : 'Receipt / OKLink'}
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                        Receipt Hash
                      </div>
                      <div className="mt-1 break-all text-xs text-synth-text">
                        {fanfiProof.launch.receiptHash || fanfiProof.launch.txHash}
                      </div>
                    </div>
                    {hasRealTxHash ? (
                      <a
                        href={explorerTxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block break-all text-xs text-synth-cyan hover:text-synth-green"
                      >
                        {explorerTxUrl}
                      </a>
                    ) : (
                      <div className="rounded border border-synth-border bg-synth-surface px-3 py-2 text-xs leading-5 text-synth-muted">
                        {isZh ? '等待真实 X Layer tx hash 后再显示 OKLink 链接。' : 'OKLink link appears after a real X Layer tx hash is attached.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm leading-6 text-yellow-300">
              {isZh
                ? '这看起来像 SportFi 资产，但还没有附加任务证明。请从 Arena 同步预测榜生成证据链。'
                : 'This looks like a SportFi asset, but no mission proof is attached yet. Sync the prediction board from the Arena to generate the evidence chain.'}
            </div>
          )}
        </div>
      )}

      {/* Trade on Flap - Prominent CTA */}
      <div className={`card ${isFanFiMarketProof ? 'border-synth-cyan/30 bg-synth-cyan/10' : 'border-synth-green/30 bg-synth-green/5'}`}>
        <div className="text-center space-y-4">
          <h2 className={`text-lg font-bold ${isFanFiMarketProof ? 'text-synth-cyan' : 'text-synth-green'}`}>
            {isFanFiMarketProof ? (isZh ? 'OKX Swap Handoff' : 'OKX Swap Handoff') : t('token.tradeOnFlap')}
          </h2>
          <p className="text-sm text-synth-muted">
            {isFanFiMarketProof
              ? (isZh
                ? '这个市场证明资产承接 SportFi Arena 的热度，报价、swap review 和交易执行都通过 OKX/X Layer 与钱包确认完成。'
                : 'This market proof asset routes SportFi Arena demand into OKX/X Layer quote, swap review, and wallet-confirmed execution.')
              : t('token.tradeHint')}
          </p>
          {isFanFiMarketProof ? (
            <span className="inline-block rounded border border-synth-cyan/30 bg-synth-cyan/10 px-8 py-3 text-lg font-mono text-synth-cyan">
              {isZh ? '钱包确认执行' : 'Wallet Confirmation'}
            </span>
          ) : (
            <a
              href={`${chainConfig.flapUrl}/token/${params.address}?chain=${flapChain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-block px-8 py-3 text-lg"
            >
              {t('token.tradeBtn', { symbol: token.symbol })}
            </a>
          )}
        </div>
      </div>

      {/* Token Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            {t('token.tokenDetails')}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.contract')}</span>
              <button onClick={copyAddress} className="text-synth-text font-mono text-xs hover:text-synth-green transition-colors">
                {params.address.slice(0, 10)}...{params.address.slice(-8)}
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.creator')}</span>
              <span className="text-synth-text font-mono text-xs">
                {token.creator ? `${token.creator.slice(0, 10)}...${token.creator.slice(-8)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.status')}</span>
              <span className="text-synth-text">{statusLabel(token.status)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.chain')}</span>
              <span className="text-synth-text">{chainLabelOf(token.chain_id).name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.protocol')}</span>
              <span className="text-synth-text">Flap</span>
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-synth-purple uppercase tracking-wider">
            {t('token.bondingCurve')}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.circulatingSupply')}</span>
              <span className="text-synth-text">{(token.circulatingSupply / 1e6).toFixed(2)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.totalSupply')}</span>
              <span className="text-synth-text">1,000,000,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synth-muted">{t('token.reserve')} {nativeSymbol}</span>
              <span className="text-synth-cyan">{token.reserve?.toFixed(4)}</span>
            </div>
            {token.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-synth-muted">{t('token.taxRate')}</span>
                <span className="text-synth-cyan">{token.taxRate}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-green uppercase tracking-wider">
          {t('token.explore')}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {isFanFiMarketProof ? (
            // FanFi prediction receipts are not tradeable — show review-only placeholders
            // instead of misleading users to Flap/OKLink/DexScreener with a non-deployed address.
            <>
              <span className={externalActionClass}>{isZh ? 'Flap Review' : 'Flap Review'}</span>
              <span className={externalActionClass}>{isZh ? 'OKLink Proof' : 'OKLink Proof'}</span>
              <span className={externalActionClass}>{isZh ? 'DexScreener Review' : 'DexScreener Review'}</span>
            </>
          ) : (
            <>
              <a
                href={`${chainConfig.flapUrl}/token/${params.address}?chain=${flapChain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary py-3 text-center"
              >
                {t('token.tradeOnFlap')}
              </a>
              <a
                href={explorerTokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-3 text-center"
              >
                {tokenChainId === 196 ? 'View on OKLink' : t('token.viewOnBscScan')}
              </a>
              <a
                href={`https://dexscreener.com/${tokenChainId === 196 ? 'xlayer' : 'bsc'}/${params.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-3 text-center"
              >
                DexScreener
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


export default function TokenPage({ params }: { params: { address: string } }) {
  return (
    <ErrorBoundary>
      <TokenPageInner params={params} />
    </ErrorBoundary>
  );
}
