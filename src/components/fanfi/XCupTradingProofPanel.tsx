'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { CHAIN_CONFIG } from '@/lib/contracts';
import { useI18n } from '@/lib/i18n';

type OkxTokenSearchResult = {
  chainIndex?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenContractAddress?: string;
  decimal?: string;
  explorerUrl?: string;
  holders?: string;
  liquidity?: string;
  marketCap?: string;
  price?: string;
};

type OkxBalanceItem = {
  tokenContractAddress?: string;
  symbol?: string;
  tokenName?: string;
  balance?: string;
  valueUsd?: string;
  price?: string;
};

type FanFiMarketProofRecord = {
  name: string;
  symbol: string;
  tokenAddress: string;
  txHash?: string;
  receiptHash?: string;
  settlementRule?: string;
  settlementSource?: string;
  settlementCutoff?: string;
  settlementStatus?: 'open' | 'locked' | 'resolved';
  createdAt: string;
};

type QuoteRecord = Record<string, unknown>;

const FANFI_FAN_ID_KEY = 'synthlaunch:fanfi-fan-id';
const DEFAULT_FAN_ID = 'fanfi-captain';
const OKX_NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function decimalToBaseUnits(amount: string, decimals = 18): string {
  const [wholePart, fractionalPart = ''] = amount.trim().split('.');
  const normalizedWhole = wholePart.replace(/[^\d]/g, '') || '0';
  const normalizedFraction = fractionalPart.replace(/[^\d]/g, '');
  const paddedFraction = `${normalizedFraction}${'0'.repeat(decimals)}`.slice(0, decimals);
  return `${BigInt(normalizedWhole)}${paddedFraction}`.replace(/^0+(?=\d)/, '') || '0';
}

function formatUsd(value?: string | null): string {
  if (!value) return '$0';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric >= 1000000) return `$${(numeric / 1000000).toFixed(2)}M`;
  if (numeric >= 1000) return `$${(numeric / 1000).toFixed(2)}K`;
  if (numeric > 0) return `$${numeric.toFixed(2)}`;
  return '$0';
}

function formatTokenAmount(value?: string): string {
  if (!value) return '0';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric >= 1000) return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (numeric >= 1) return numeric.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (numeric > 0) return numeric.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return '0';
}

function shortAddress(value?: string): string {
  if (!value) return 'No target';
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getStringValue(source: QuoteRecord | undefined, keys: string[]): string {
  if (!source) return '';

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return '';
}

function compactJson(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    if (!text) return 'No quote payload';
    return text.length > 280 ? `${text.slice(0, 280)}...` : text;
  } catch {
    return 'Quote payload unavailable';
  }
}

function statusClass(tone: 'ready' | 'ok' | 'needs' | 'locked') {
  if (tone === 'ok') return 'border-synth-green/30 bg-synth-green/10 text-synth-green';
  if (tone === 'needs') return 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300';
  if (tone === 'locked') return 'border-synth-border bg-synth-bg text-synth-muted';
  return 'border-synth-cyan/30 bg-synth-cyan/10 text-synth-cyan';
}

function isRealTxHash(hash?: string): hash is string {
  return Boolean(hash && /^0x[0-9a-fA-F]{64}$/.test(hash));
}

function getExplorerTxUrl(hash: string): string {
  return `${CHAIN_CONFIG[196].explorer.replace(/\/$/, '')}/tx/${hash}`;
}

export function XCupTradingProofPanel() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [targetTokenAddress, setTargetTokenAddress] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('0.01');
  const [slippage, setSlippage] = useState('0.5');
  const [searchResults, setSearchResults] = useState<OkxTokenSearchResult[]>([]);
  const [balances, setBalances] = useState<OkxBalanceItem[]>([]);
  const [totalValueUsd, setTotalValueUsd] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<QuoteRecord[]>([]);
  const [marketProof, setMarketProof] = useState<FanFiMarketProofRecord | null>(null);
  const [activeRequest, setActiveRequest] = useState<'search' | 'balances' | 'quote' | 'proof' | null>(null);
  const [searchError, setSearchError] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [quoteError, setQuoteError] = useState('');

  const walletAddress = mounted && isConnected ? address : undefined;
  const quoteSummary = quoteData[0];
  const copy = useMemo(() => (
    isZh
      ? {
        pending: '等待中',
        tokenSearch: '资产搜索',
        balances: '余额',
        quote: '报价',
        swapReview: 'Swap 执行',
        ok: 'OK',
        needsEnv: '需配置环境',
        ready: '就绪',
        wallet: '钱包',
        target: '目标资产',
        locked: '需钱包确认',
        noTarget: '无目标',
        invalidTarget: '请先填写有效的 X Layer 资产地址，再生成报价。',
        amountError: '报价金额必须大于 0。',
        connectWallet: '连接钱包后读取 X Layer 余额。',
        searchFailed: 'OKX 资产搜索失败',
        balanceFailed: 'OKX 余额查询失败',
        quoteFailed: 'OKX 报价失败',
        sectionLabel: 'OKX/X Layer 交易',
        title: '报价、余额与 Swap 路径',
        intro: '搜索预测 Arena 的市场资产、读取 X Layer 余额、生成 OKX 报价，并把 swap 执行交给钱包确认。',
        tokenQuery: '资产查询',
        searching: '搜索中...',
        searchOkx: '搜索 OKX',
        unknownToken: '未知资产',
        chain: '链',
        tokenEvidenceEmpty: '搜索 OKX 后，市场资产结果会显示在这里。',
        targetToken: '目标资产',
        loadProof: '载入最新 Proof',
        okbAmount: 'OKB 数量',
        slippage: '滑点 %',
        checking: '检查中...',
        checkBalance: '检查余额',
        building: '生成中...',
        buildQuote: '生成报价',
        localTarget: '当前目标',
        proofLedger: 'X Layer Proof Ledger',
        chainProof: 'OKLink Tx',
        receiptHash: 'Receipt Hash',
        settlementRule: '结算规则',
        settlementSource: '结算源',
        settlementCutoff: '锁盘',
        statusOpen: 'Open',
        openOklink: '打开 OKLink',
        notConnected: '未连接',
        reviewOnly: '钱包确认',
        balanceEvidence: '余额',
        noTotal: '无总额',
        balanceEmpty: '连接钱包并检查余额后，资产列表会显示在这里。',
        quoteEvidence: '报价',
        okbToTarget: 'OKB 到目标资产',
        output: '输出',
        gas: 'Gas',
        impact: '影响',
        quoteEmpty: '报价 payload 会显示在这里。执行 swap 时仍需要钱包确认。',
      }
      : {
        pending: 'Pending',
        tokenSearch: 'Asset Search',
        balances: 'Balances',
        quote: 'Quote',
        swapReview: 'Swap Execution',
        ok: 'OK',
        needsEnv: 'Needs Env',
        ready: 'Ready',
        wallet: 'Wallet',
        target: 'Target Asset',
        locked: 'Wallet Confirm',
        noTarget: 'No target',
        invalidTarget: 'Add a valid X Layer asset address before building a quote.',
        amountError: 'Quote amount must be greater than zero.',
        connectWallet: 'Connect a wallet to read X Layer balances.',
        searchFailed: 'OKX asset search failed',
        balanceFailed: 'OKX balances failed',
        quoteFailed: 'OKX quote failed',
        sectionLabel: 'OKX/X Layer Trading',
        title: 'Quote, Balance, And Swap Route',
        intro: 'Search market assets for prediction arenas, read X Layer balances, build OKX quotes, and route swap execution through wallet confirmation.',
        tokenQuery: 'Asset Query',
        searching: 'Searching...',
        searchOkx: 'Search OKX',
        unknownToken: 'Unknown asset',
        chain: 'chain',
        tokenEvidenceEmpty: 'Market asset results will appear here after an OKX search.',
        targetToken: 'Target Asset',
        loadProof: 'Load Latest Proof',
        okbAmount: 'OKB Amount',
        slippage: 'Slippage %',
        checking: 'Checking...',
        checkBalance: 'Check Balance',
        building: 'Building...',
        buildQuote: 'Build Quote',
        localTarget: 'Current target',
        proofLedger: 'X Layer Proof Ledger',
        chainProof: 'OKLink Tx',
        receiptHash: 'Receipt Hash',
        settlementRule: 'Settlement Rule',
        settlementSource: 'Settlement Source',
        settlementCutoff: 'Lock Time',
        statusOpen: 'Open',
        openOklink: 'Open OKLink',
        notConnected: 'Not connected',
        reviewOnly: 'Wallet confirm',
        balanceEvidence: 'Balances',
        noTotal: 'No total',
        balanceEmpty: 'Balances will appear here after a connected wallet check succeeds.',
        quoteEvidence: 'Quote',
        okbToTarget: 'OKB to target',
        output: 'Output',
        gas: 'Gas',
        impact: 'Impact',
        quoteEmpty: 'Quote payload will appear here. Swap execution still requires wallet confirmation.',
      }
  ), [isZh]);

  const proofStatus = useMemo(
    () => [
      {
        label: copy.tokenSearch,
        value: searchResults.length > 0 ? copy.ok : searchError ? copy.needsEnv : copy.ready,
        tone: searchResults.length > 0 ? 'ok' : searchError ? 'needs' : 'ready',
      },
      {
        label: copy.balances,
        value: balances.length > 0 ? copy.ok : walletAddress ? copy.ready : copy.wallet,
        tone: balances.length > 0 ? 'ok' : walletAddress ? 'ready' : 'needs',
      },
      {
        label: copy.quote,
        value: quoteData.length > 0 ? copy.ok : targetTokenAddress ? copy.ready : copy.target,
        tone: quoteData.length > 0 ? 'ok' : targetTokenAddress ? 'ready' : 'needs',
      },
      {
        label: copy.swapReview,
        value: copy.locked,
        tone: 'locked',
      },
    ] as const,
    [balances.length, copy, quoteData.length, searchError, searchResults.length, targetTokenAddress, walletAddress],
  );

  const loadLatestMarketProof = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setActiveRequest((current) => current ?? 'proof');

    try {
      const storedFanId = window.localStorage.getItem(FANFI_FAN_ID_KEY);
      const fanId = storedFanId && storedFanId !== 'local-reviewer' ? storedFanId : DEFAULT_FAN_ID;
      const res = await fetch(`/api/fanfi/market-proofs?fanId=${encodeURIComponent(fanId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;

      const data = await res.json();
      const launches = Array.isArray(data.launches) ? data.launches : [];
      const latest = launches[0] as FanFiMarketProofRecord | undefined;
      if (!latest?.tokenAddress) return;

      setMarketProof(latest);
      setTargetTokenAddress((current) => current || latest.tokenAddress);
      setSearch((current) => current || latest.symbol || 'VARDAO');
    } finally {
      setActiveRequest((current) => (current === 'proof' ? null : current));
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void loadLatestMarketProof();

    const handleMarketProofCreated = () => {
      void loadLatestMarketProof();
    };

    window.addEventListener('fanfi-market-proof-created', handleMarketProofCreated);
    return () => {
      window.removeEventListener('fanfi-market-proof-created', handleMarketProofCreated);
    };
  }, [loadLatestMarketProof]);

  const runTokenSearch = async () => {
    setActiveRequest('search');
    setSearchError('');
    setQuoteData([]);

    try {
      const res = await fetch(`/api/okx/token-search?search=${encodeURIComponent(search.trim())}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || copy.searchFailed);
      }

      const results = Array.isArray(data.data) ? data.data : [];
      setSearchResults(results);

      const firstAddress = results[0]?.tokenContractAddress;
      if (firstAddress && ADDRESS_RE.test(firstAddress)) {
        setTargetTokenAddress(firstAddress);
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : copy.searchFailed);
    } finally {
      setActiveRequest(null);
    }
  };

  const runBalances = async () => {
    setBalanceError('');

    if (!walletAddress) {
      setBalanceError(copy.connectWallet);
      return;
    }

    setActiveRequest('balances');

    try {
      const res = await fetch(`/api/okx/balances?address=${encodeURIComponent(walletAddress)}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || copy.balanceFailed);
      }

      setBalances(Array.isArray(data.data) ? data.data : []);
      setTotalValueUsd(typeof data.totalValueUsd === 'string' ? data.totalValueUsd : null);
    } catch (error) {
      setBalanceError(error instanceof Error ? error.message : copy.balanceFailed);
    } finally {
      setActiveRequest(null);
    }
  };

  const runQuote = async () => {
    setQuoteError('');
    setQuoteData([]);

    if (!ADDRESS_RE.test(targetTokenAddress.trim())) {
      setQuoteError(copy.invalidTarget);
      return;
    }

    const amount = decimalToBaseUnits(quoteAmount);
    if (amount === '0') {
      setQuoteError(copy.amountError);
      return;
    }

    setActiveRequest('quote');

    try {
      const params = new URLSearchParams({
        fromTokenAddress: OKX_NATIVE_TOKEN_ADDRESS,
        toTokenAddress: targetTokenAddress.trim(),
        amount,
        slippage: slippage.trim() || '0.5',
      });
      if (walletAddress) params.set('userWalletAddress', walletAddress);

      const res = await fetch(`/api/okx/quote?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || copy.quoteFailed);
      }

      setQuoteData(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : copy.quoteFailed);
    } finally {
      setActiveRequest(null);
    }
  };

  const outputAmount =
    getStringValue(quoteSummary, ['toTokenAmount', 'amountOut', 'minAmountOut']) || copy.pending;
  const gasEstimate = getStringValue(quoteSummary, ['estimateGasFee', 'gasFee', 'gas']) || copy.pending;
  const priceImpact = getStringValue(quoteSummary, ['priceImpactPercentage', 'priceImpact']) || copy.pending;

  return (
    <section id="fanfi-trading-proof" className="border-b border-synth-border">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-cyan">
              {copy.sectionLabel}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {copy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-synth-muted">
              {copy.intro}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {proofStatus.map((item) => (
              <span
                key={item.label}
                className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${statusClass(item.tone)}`}
              >
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <div className="card">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                    {copy.tokenQuery}
                  </span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="input-field mt-2 w-full"
                    placeholder="VARDAO"
                  />
                </label>
                <button
                  type="button"
                  onClick={runTokenSearch}
                  disabled={activeRequest === 'search' || !search.trim()}
                  className="btn-secondary h-10 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activeRequest === 'search' ? copy.searching : copy.searchOkx}
                </button>
              </div>

              {searchError && (
                <div className="mt-4 rounded border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs leading-5 text-yellow-300">
                  {searchError}
                </div>
              )}

              <div className="mt-4 space-y-2">
                {searchResults.slice(0, 4).map((token) => (
                  <button
                    key={`${token.chainIndex}-${token.tokenContractAddress}`}
                    type="button"
                    onClick={() => setTargetTokenAddress(token.tokenContractAddress || '')}
                    className="w-full rounded border border-synth-border bg-synth-bg px-3 py-3 text-left hover:border-synth-green/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-synth-text">
                          {token.tokenName || token.tokenSymbol || copy.unknownToken}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                          ${token.tokenSymbol || 'TOKEN'} · {copy.chain} {token.chainIndex || '196'}
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-synth-cyan">
                        {formatUsd(token.price)}
                      </div>
                    </div>
                    <div className="mt-3 break-all text-[10px] text-synth-muted">
                      {token.tokenContractAddress}
                    </div>
                  </button>
                ))}

                {searchResults.length === 0 && !searchError && (
                  <div className="rounded border border-synth-border bg-synth-bg px-3 py-3 text-sm text-synth-muted">
                    {copy.tokenEvidenceEmpty}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                    {copy.targetToken}
                  </span>
                  <input
                    value={targetTokenAddress}
                    onChange={(event) => setTargetTokenAddress(event.target.value)}
                    className="input-field mt-2 w-full"
                    placeholder="0x..."
                  />
                </label>
                <button
                  type="button"
                  onClick={loadLatestMarketProof}
                  disabled={activeRequest === 'proof'}
                  className="btn-secondary h-10 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copy.loadProof}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                    {copy.okbAmount}
                  </span>
                  <input
                    value={quoteAmount}
                    onChange={(event) => setQuoteAmount(event.target.value)}
                    className="input-field mt-2 w-full"
                    inputMode="decimal"
                  />
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                    {copy.slippage}
                  </span>
                  <input
                    value={slippage}
                    onChange={(event) => setSlippage(event.target.value)}
                    className="input-field mt-2 w-full"
                    inputMode="decimal"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={runBalances}
                  disabled={activeRequest === 'balances'}
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activeRequest === 'balances' ? copy.checking : copy.checkBalance}
                </button>
                <button
                  type="button"
                  onClick={runQuote}
                  disabled={activeRequest === 'quote'}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activeRequest === 'quote' ? copy.building : copy.buildQuote}
                </button>
              </div>

              {marketProof && (
                <div className="mt-4 rounded border border-synth-green/20 bg-synth-green/5 px-3 py-2 text-xs leading-5 text-synth-muted">
                  {copy.localTarget}: ${marketProof.symbol} · {shortAddress(marketProof.tokenAddress)}
                </div>
              )}
              {balanceError && (
                <div className="mt-4 rounded border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs leading-5 text-yellow-300">
                  {balanceError}
                </div>
              )}
              {quoteError && (
                <div className="mt-4 rounded border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs leading-5 text-yellow-300">
                  {quoteError}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded border border-synth-border bg-synth-surface px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                  {copy.wallet}
                </div>
                <div className="mt-2 text-sm font-bold text-synth-text">
                  {walletAddress ? shortAddress(walletAddress) : copy.notConnected}
                </div>
              </div>
              <div className="rounded border border-synth-border bg-synth-surface px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                  {copy.target}
                </div>
                <div className="mt-2 text-sm font-bold text-synth-text">
                  {targetTokenAddress ? shortAddress(targetTokenAddress) : copy.noTarget}
                </div>
              </div>
              <div className="rounded border border-synth-border bg-synth-surface px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                  Swap
                </div>
                <div className="mt-2 text-sm font-bold text-synth-muted">
                  {copy.reviewOnly}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-synth-cyan/30 bg-synth-cyan/5 p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-synth-text">{copy.proofLedger}</h3>
                  <p className="mt-1 text-xs leading-5 text-synth-muted">
                    {marketProof
                      ? `${marketProof.name} · $${marketProof.symbol}`
                      : isZh
                        ? '载入最新 proof 后显示 receipt、结算规则和 OKLink 路径。'
                        : 'Load the latest proof to reveal receipt, settlement rule, and OKLink route.'}
                  </p>
                </div>
                <span className="rounded border border-synth-green/30 bg-synth-green/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-synth-green">
                  {marketProof?.settlementStatus || copy.statusOpen}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {copy.chainProof}
                  </div>
                  {isRealTxHash(marketProof?.txHash) ? (
                    <a
                      href={getExplorerTxUrl(marketProof.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block break-all text-xs text-synth-cyan hover:text-synth-green"
                    >
                      {marketProof.txHash}
                    </a>
                  ) : (
                    <div className="mt-2 text-xs leading-5 text-synth-muted">
                      {isZh ? '等待真实 X Layer tx hash' : 'Waiting for real X Layer tx hash'}
                    </div>
                  )}
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {copy.receiptHash}
                  </div>
                  <div className="mt-2 break-all text-xs text-synth-text">
                    {marketProof?.receiptHash || marketProof?.tokenAddress || '0x...'}
                  </div>
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {copy.settlementSource}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-synth-text">
                    {marketProof?.settlementSource || (isZh ? '官方最终比分和赛后报告' : 'Official final score and post-match report')}
                  </div>
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {copy.settlementCutoff}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-synth-text">
                    {marketProof?.settlementCutoff || (isZh ? 'Kickoff 前 30 分钟' : '30 minutes before kickoff')}
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded border border-synth-border bg-synth-bg px-3 py-3 text-xs leading-5 text-synth-muted">
                <span className="text-synth-cyan">{copy.settlementRule}: </span>
                {marketProof?.settlementRule ||
                  (isZh
                    ? '按官方结果结算方向，按概率接近度、早期提交和理由质量更新 reputation。'
                    : 'Resolve direction against the official result, then update reputation by probability distance, early receipt, and reason quality.')}
              </div>
            </div>

            <div className="rounded-lg border border-synth-border bg-synth-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-synth-text">{copy.balanceEvidence}</h3>
                <span className="text-[10px] text-synth-muted">
                  {totalValueUsd ? formatUsd(totalValueUsd) : copy.noTotal}
                </span>
              </div>
              <div className="space-y-2">
                {balances.slice(0, 4).map((item) => (
                  <div
                    key={`${item.tokenContractAddress}-${item.symbol}`}
                    className="grid grid-cols-[1fr_auto] gap-3 border-b border-synth-border pb-2 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-bold text-synth-text">
                        {item.symbol || 'TOKEN'}
                      </div>
                      <div className="mt-1 text-[10px] text-synth-muted">
                        {item.tokenName || shortAddress(item.tokenContractAddress)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-synth-text">{formatTokenAmount(item.balance)}</div>
                      <div className="text-[10px] text-synth-muted">{formatUsd(item.valueUsd)}</div>
                    </div>
                  </div>
                ))}
                {balances.length === 0 && (
                  <div className="rounded border border-synth-border bg-synth-bg px-3 py-3 text-sm text-synth-muted">
                    {copy.balanceEmpty}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-synth-border bg-synth-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-synth-text">{copy.quoteEvidence}</h3>
                <span className="text-[10px] text-synth-muted">
                  {copy.okbToTarget}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {copy.output}
                  </div>
                  <div className="mt-2 break-all text-sm font-bold text-synth-text">
                    {outputAmount}
                  </div>
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {copy.gas}
                  </div>
                  <div className="mt-2 break-all text-sm font-bold text-synth-text">
                    {gasEstimate}
                  </div>
                </div>
                <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {copy.impact}
                  </div>
                  <div className="mt-2 break-all text-sm font-bold text-synth-text">
                    {priceImpact}
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded border border-synth-border bg-synth-bg px-3 py-3 text-[10px] leading-5 text-synth-muted">
                {quoteData.length > 0
                  ? compactJson(quoteData[0])
                  : copy.quoteEmpty}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
