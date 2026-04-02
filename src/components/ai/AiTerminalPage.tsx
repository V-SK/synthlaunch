'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useAccount,
  useBalance,
  useSignMessage,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWalletClient,
} from 'wagmi';
import type { Address } from 'viem';
import { xlayer } from '@/lib/wagmi';
import type {
  AiActionLogEntry,
  AiAuthState,
  AiHealthResponse,
  AiMessage,
  AiProviderStatus,
  AiSession,
  AiSessionResponse,
  AiToolResult,
  AiUserProfile,
  BalanceTokenItem,
  SwapToolResult,
  TokenSearchItem,
} from '@/lib/ai/types';

type BalancesResponse = {
  data: BalanceTokenItem[];
  totalValueUsd?: string | null;
  error?: string;
};

type PendingExecution = {
  hash: `0x${string}`;
  actionId: string;
};

type AuthFlowState = 'idle' | 'checking' | 'signing' | 'authenticated' | 'error';

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsd(value?: string | null): string {
  if (!value) return '$0.00';
  const number = Number(value);
  if (!Number.isFinite(number)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: number >= 100 ? 0 : 2,
  }).format(number);
}

function formatCompact(value?: string | null): string {
  if (!value) return '0';
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(number);
}

function formatTokenBalance(item: BalanceTokenItem): string {
  const balance = Number(item.balance ?? '0');
  if (!Number.isFinite(balance)) return '0';
  return balance >= 1000
    ? new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      }).format(balance)
    : balance.toLocaleString('en-US', {
        maximumFractionDigits: 4,
      });
}

function normalizeToolResult(
  value: unknown,
): AiToolResult | null {
  if (!value || typeof value !== 'object') return null;
  return value as AiToolResult;
}

function statusClasses(status: AiProviderStatus) {
  switch (status) {
    case 'live':
      return 'border-synth-green/30 bg-synth-green/10 text-synth-green';
    case 'fallback':
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200';
    case 'degraded':
      return 'border-red-500/30 bg-red-500/10 text-red-200';
    default:
      return 'border-synth-border/80 bg-synth-bg/70 text-synth-muted';
  }
}

function StatusBadge({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: AiProviderStatus;
}) {
  return (
    <div className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${statusClasses(status)}`}>
      <span className="opacity-70">{label}</span>
      <span className="ml-2">{value}</span>
    </div>
  );
}

function MessageCard({
  message,
  isConnected,
  wrongChain,
  onSwitchChain,
  onExecuteSwap,
  executingActionId,
}: {
  message: AiMessage;
  isConnected: boolean;
  wrongChain: boolean;
  onSwitchChain: () => void;
  onExecuteSwap: (tool: SwapToolResult) => void;
  executingActionId?: string | null;
}) {
  const tool = normalizeToolResult(message.metadata?.toolResult);
  const isUser = message.role === 'user';
  const llmStatus =
    message.metadata?.llm?.source === 'heuristic'
      ? { label: 'Heuristic fallback', status: 'fallback' as const }
      : message.metadata?.llm?.source === 'codex'
        ? { label: 'Codex live', status: 'live' as const }
        : message.metadata?.llm?.source === 'openai'
          ? { label: 'OpenAI live', status: 'live' as const }
          : null;
  const okxStatus = message.metadata?.okx
    ? {
        label:
          message.metadata.okx.status === 'ok'
            ? `OKX ${message.metadata.okx.operation}`
            : `OKX ${message.metadata.okx.operation} degraded`,
        status: (message.metadata.okx.status === 'ok' ? 'live' : 'degraded') as AiProviderStatus,
      }
    : null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-xl border px-4 py-3 ${
          isUser
            ? 'border-synth-green/30 bg-synth-green/10 text-synth-text'
            : 'border-synth-border/80 bg-synth-surface/85 text-synth-text'
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">
            {isUser ? 'You' : 'Synth AI'}
          </div>
          {!isUser && (llmStatus || okxStatus) ? (
            <div className="flex flex-wrap gap-2">
              {llmStatus ? (
                <StatusBadge label="LLM" value={llmStatus.label} status={llmStatus.status} />
              ) : null}
              {okxStatus ? (
                <StatusBadge label="Market" value={okxStatus.label} status={okxStatus.status} />
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
        {message.metadata?.llm?.fallbackReason ? (
          <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
            Fallback reason: {message.metadata.llm.fallbackReason}
          </div>
        ) : null}
        {tool && (
          <div className="mt-3">
            <ToolResultCard
              tool={tool}
              isConnected={isConnected}
              wrongChain={wrongChain}
              onSwitchChain={onSwitchChain}
              onExecuteSwap={onExecuteSwap}
              executingActionId={executingActionId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolResultCard({
  tool,
  isConnected,
  wrongChain,
  onSwitchChain,
  onExecuteSwap,
  executingActionId,
}: {
  tool: AiToolResult;
  isConnected: boolean;
  wrongChain: boolean;
  onSwitchChain: () => void;
  onExecuteSwap: (tool: SwapToolResult) => void;
  executingActionId?: string | null;
}) {
  if (tool.type === 'error') {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
        <div className="font-bold">{tool.title}</div>
        <div className="mt-1 text-red-200">{tool.detail}</div>
      </div>
    );
  }

  if (tool.type === 'balances') {
    return (
      <div className="rounded-md border border-synth-border bg-synth-bg/70 p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-synth-cyan">
            X Layer Balances
          </h4>
          <span className="text-xs text-synth-green">
            {formatUsd(tool.totalValueUsd)}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {tool.balances.slice(0, 6).map((item) => (
            <div
              key={`${item.tokenContractAddress}-${item.symbol}`}
              className="flex items-center justify-between rounded border border-synth-border/60 px-3 py-2 text-xs"
            >
              <div>
                <div className="font-semibold text-synth-text">{item.symbol}</div>
                <div className="text-synth-muted">{item.tokenName || 'Token'}</div>
              </div>
              <div className="text-right">
                <div className="text-synth-text">{formatTokenBalance(item)}</div>
                <div className="text-synth-muted">{formatUsd(item.valueUsd)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tool.type === 'price') {
    return (
      <div className="rounded-md border border-synth-border bg-synth-bg/70 p-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-synth-text">
              {tool.token.tokenName}
            </div>
            <div className="text-xs text-synth-muted">
              ${tool.token.tokenSymbol} · X Layer
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-synth-green">
              {formatUsd(tool.token.price)}
            </div>
            <div className="text-xs text-synth-muted">
              24h {tool.token.change || '0'}%
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-synth-border/60 px-2 py-2">
            <div className="text-synth-muted">Liquidity</div>
            <div className="mt-1 text-synth-text">{formatCompact(tool.token.liquidity)}</div>
          </div>
          <div className="rounded border border-synth-border/60 px-2 py-2">
            <div className="text-synth-muted">MCap</div>
            <div className="mt-1 text-synth-text">{formatCompact(tool.token.marketCap)}</div>
          </div>
          <div className="rounded border border-synth-border/60 px-2 py-2">
            <div className="text-synth-muted">Holders</div>
            <div className="mt-1 text-synth-text">{formatCompact(tool.token.holders)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (tool.type === 'search') {
    return (
      <div className="rounded-md border border-synth-border bg-synth-bg/70 p-3">
        <div className="mb-3 text-xs uppercase tracking-[0.2em] text-synth-cyan">
          Search: {tool.query}
        </div>
        <div className="space-y-2">
          {tool.results.slice(0, 5).map((item) => (
            <div
              key={item.tokenContractAddress}
              className="flex items-center justify-between rounded border border-synth-border/60 px-3 py-2 text-xs"
            >
              <div>
                <div className="font-semibold text-synth-text">
                  {item.tokenSymbol}
                </div>
                <div className="text-synth-muted">{item.tokenName}</div>
              </div>
              <div className="text-right">
                <div className="text-synth-text">{formatUsd(item.price)}</div>
                <div className="text-synth-muted">{item.change || '0'}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tool.type === 'suggestion') {
    const verdictColor =
      tool.verdict === 'bullish'
        ? 'text-synth-green'
        : tool.verdict === 'cautious'
          ? 'text-red-300'
          : 'text-synth-cyan';

    return (
      <div className="rounded-md border border-synth-border bg-synth-bg/70 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-synth-text">
              {tool.token.tokenSymbol}
            </div>
            <div className="text-xs text-synth-muted">{tool.token.tokenName}</div>
          </div>
          <div className={`text-sm font-bold uppercase ${verdictColor}`}>
            {tool.verdict}
          </div>
        </div>
        <p className="mt-3 text-sm text-synth-text">{tool.reason}</p>
      </div>
    );
  }

  if (tool.type === 'swapQuote') {
    const isExecuting = executingActionId === tool.actionId;
    return (
      <div className="rounded-md border border-synth-border bg-synth-bg/70 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-synth-text">
              Swap Quote
            </div>
            <div className="text-xs text-synth-muted">
              {tool.tokenIn.tokenSymbol} → {tool.tokenOut.tokenSymbol}
            </div>
          </div>
          <div className="text-right text-xs text-synth-muted">
            X Layer · OKX
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-synth-border/60 px-2 py-2">
            <div className="text-synth-muted">Input</div>
            <div className="mt-1 text-synth-text">
              {tool.amountIn} {tool.tokenIn.tokenSymbol}
            </div>
          </div>
          <div className="rounded border border-synth-border/60 px-2 py-2">
            <div className="text-synth-muted">Output</div>
            <div className="mt-1 text-synth-text">
              {tool.amountOut || tool.minAmountOut || 'Pending'} {tool.tokenOut.tokenSymbol}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isConnected ? (
            <span className="rounded border border-synth-border/60 px-3 py-2 text-xs text-synth-muted">
              Connect wallet to execute
            </span>
          ) : wrongChain ? (
            <button type="button" onClick={onSwitchChain} className="btn-secondary text-xs">
              Switch to X Layer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onExecuteSwap(tool)}
              className="btn-primary text-xs"
              disabled={isExecuting}
            >
              {isExecuting ? 'Submitting...' : 'Confirm Swap'}
            </button>
          )}
          <span className="rounded border border-synth-border/60 px-3 py-2 text-xs text-synth-muted">
            Slippage {tool.slippage || '0.5'}%
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function PreferenceSegment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{
    value: T;
    label: string;
    hint?: string;
  }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] uppercase tracking-[0.18em] text-synth-muted">
          {label}
        </label>
        <span className="text-[10px] uppercase tracking-[0.14em] text-synth-green">
          {options.find((option) => option.value === value)?.label}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
                active
                  ? 'border-synth-green/50 bg-synth-green/12 shadow-[0_0_0_1px_rgba(0,255,136,0.12)]'
                  : 'border-synth-border/70 bg-synth-bg/70 hover:border-synth-green/25 hover:bg-synth-surface'
              }`}
            >
              <div
                className={`text-sm font-semibold ${
                  active ? 'text-synth-green' : 'text-synth-text'
                }`}
              >
                {option.label}
              </div>
              {option.hint ? (
                <div className="mt-1 text-xs leading-5 text-synth-muted">
                  {option.hint}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AiTerminalPage() {
  const { address, chain, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  const { data: nativeBalance } = useBalance({
    address,
    chainId: xlayer.id,
    query: {
      enabled: Boolean(address),
    },
  });
  const { switchChainAsync } = useSwitchChain();
  const [session, setSession] = useState<AiSession | null>(null);
  const [user, setUser] = useState<AiUserProfile | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [actions, setActions] = useState<AiActionLogEntry[]>([]);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [marketCards, setMarketCards] = useState<TokenSearchItem[]>([]);
  const [health, setHealth] = useState<AiHealthResponse | null>(null);
  const [auth, setAuth] = useState<AiAuthState>({
    authenticated: false,
    walletAddress: null,
    expiresAt: null,
  });
  const [authFlow, setAuthFlow] = useState<AuthFlowState>('idle');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [pendingExecution, setPendingExecution] = useState<PendingExecution | null>(null);
  const wrongChain = isConnected && chain?.id !== xlayer.id;

  const { isLoading: isConfirming, isSuccess: txConfirmed } =
    useWaitForTransactionReceipt({
      hash: pendingExecution?.hash,
      chainId: xlayer.id,
      query: {
        enabled: Boolean(pendingExecution?.hash),
      },
    });

  const watchlist = user?.watchlist ?? [];
  const riskOptions: Array<{
    value: AiUserProfile['riskBias'];
    label: string;
    hint: string;
  }> = [
    {
      value: 'conservative',
      label: 'Conservative',
      hint: 'Lower churn, smaller size, safer entries.',
    },
    {
      value: 'balanced',
      label: 'Balanced',
      hint: 'Default operating mode for most sessions.',
    },
    {
      value: 'aggressive',
      label: 'Aggressive',
      hint: 'Faster reactions, higher risk tolerance.',
    },
  ];
  const quoteOptions: Array<{
    value: AiUserProfile['preferredQuoteToken'];
    label: string;
    hint: string;
  }> = [
    {
      value: 'USDT',
      label: 'USDT',
      hint: 'Stable quote for most swaps and balances.',
    },
    {
      value: 'USDC',
      label: 'USDC',
      hint: 'Alternative stable quote for route checks.',
    },
    {
      value: 'OKB',
      label: 'OKB',
      hint: 'Native X Layer quote for direct pairs.',
    },
  ];
  const quickSymbols = useMemo(() => {
    const watched = watchlist.map((item) => item.symbol).filter(Boolean);
    return watched.length > 0 ? watched.slice(0, 3) : ['OKB', 'USDT', 'ETH'];
  }, [watchlist]);
  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant') ?? null,
    [messages],
  );

  async function fetchJson<T>(inputUrl: string, init?: RequestInit): Promise<T> {
    const response = await fetch(inputUrl, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  async function loadHealth() {
    const nextHealth = await fetchJson<AiHealthResponse>('/api/ai/health');
    setHealth(nextHealth);
    setAuth(nextHealth.auth);
  }

  async function loadSession(activeAddress?: string): Promise<boolean> {
    const sessionData = await fetchJson<AiSessionResponse>('/api/ai/session');
    setAuth({
      authenticated: sessionData.authenticated,
      walletAddress: sessionData.walletAddress ?? null,
      expiresAt: sessionData.expiresAt ?? null,
    });

    if (
      !sessionData.authenticated ||
      !sessionData.session ||
      !sessionData.user ||
      !sessionData.walletAddress
    ) {
      setSession(null);
      setUser(null);
      setMessages([]);
      setActions([]);
      setBalances(null);
      return false;
    }

    if (
      activeAddress &&
      sessionData.walletAddress !== activeAddress.toLowerCase()
    ) {
      await logoutAi(false);
      return false;
    }

    setSession(sessionData.session);
    setUser(sessionData.user);

    const [history, balancesData] = await Promise.all([
      fetchJson<{
        session: AiSession;
        messages: AiMessage[];
        actions: AiActionLogEntry[];
      }>(`/api/ai/history?sessionId=${sessionData.session.id}`),
      fetchJson<BalancesResponse>(
        `/api/okx/balances?address=${sessionData.walletAddress}`,
      ).catch((caughtError: unknown) => ({
        data: [],
        totalValueUsd: null,
        error: caughtError instanceof Error ? caughtError.message : 'Balance fetch failed',
      })),
    ]);

    setMessages(history.messages);
    setActions(history.actions);
    setBalances(balancesData);
    return true;
  }

  async function loadMarketCards(symbols: string[]) {
    const settled = await Promise.allSettled(
      symbols.map((symbol) =>
        fetchJson<{ data: TokenSearchItem[] }>(`/api/okx/token-search?search=${symbol}`),
      ),
    );
    setMarketCards(
      settled
        .flatMap((item) =>
          item.status === 'fulfilled' ? item.value.data.slice(0, 1) : [],
        )
        .slice(0, 3),
    );
  }

  async function logoutAi(clearError = true) {
    await fetch('/api/ai/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => undefined);
    setAuth({
      authenticated: false,
      walletAddress: null,
      expiresAt: null,
    });
    setAuthFlow('idle');
    setSession(null);
    setUser(null);
    setMessages([]);
    setActions([]);
    setBalances(null);
    if (clearError) {
      setError(null);
    }
  }

  async function authenticateWallet(activeAddress: string) {
    setAuthFlow('signing');
    setError(null);
    const challenge = await fetchJson<{
      nonce: string;
      message: string;
      expiresAt: string;
      challengeToken: string;
    }>('/api/ai/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: activeAddress,
      }),
    });

    const signature = await signMessageAsync({
      message: challenge.message,
    });

    const verified = await fetchJson<AiAuthState>('/api/ai/auth/verify', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: activeAddress,
        nonce: challenge.nonce,
        signature,
        challengeToken: challenge.challengeToken,
      }),
    });

    setAuth({
      authenticated: verified.authenticated,
      walletAddress: verified.walletAddress ?? null,
      expiresAt: verified.expiresAt ?? null,
    });
    setAuthFlow('authenticated');
  }

  useEffect(() => {
    void loadMarketCards(quickSymbols);
  }, [quickSymbols.join('|')]);

  useEffect(() => {
    if (!address) {
      void logoutAi();
      setLoading(false);
      void loadHealth().catch(() => undefined);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setAuthFlow('checking');
    setError(null);

    void (async () => {
      try {
        await loadHealth().catch(() => undefined);
        const hasSession = await loadSession(address);
        if (cancelled) return;

        if (hasSession) {
          setAuthFlow('authenticated');
          return;
        }

        await authenticateWallet(address);
        if (cancelled) return;
        await loadSession(address);
        await loadHealth().catch(() => undefined);
      } catch (caughtError) {
        if (cancelled) return;
        const message =
          caughtError instanceof Error ? caughtError.message : 'Failed to authenticate AI terminal';
        setError(message);
        setAuthFlow('error');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, signMessageAsync]);

  useEffect(() => {
    if (!pendingExecution?.actionId || !pendingExecution.hash || !auth.authenticated) {
      return;
    }

    void fetchJson('/api/ai/action', {
      method: 'POST',
      body: JSON.stringify({
        actionId: pendingExecution.actionId,
        status: 'submitted',
        txHash: pendingExecution.hash,
        payload: {
          txLifecycle: 'submitted',
        },
      }),
    }).catch(() => undefined);
  }, [auth.authenticated, pendingExecution?.actionId, pendingExecution?.hash]);

  useEffect(() => {
    if (!txConfirmed || !pendingExecution?.actionId || !auth.authenticated || !address) {
      return;
    }

    void (async () => {
      await fetchJson('/api/ai/action', {
        method: 'POST',
        body: JSON.stringify({
          actionId: pendingExecution.actionId,
          status: 'confirmed',
          txHash: pendingExecution.hash,
          payload: {
            txLifecycle: 'confirmed',
          },
        }),
      }).catch(() => undefined);

      await loadSession(address).catch(() => undefined);
      await loadHealth().catch(() => undefined);
      setPendingExecution(null);
    })();
  }, [address, auth.authenticated, pendingExecution, txConfirmed]);

  async function handleSwitchChain() {
    await switchChainAsync({ chainId: xlayer.id });
  }

  async function handleSavePreferences() {
    if (!auth.authenticated || !user) return;
    setSaveState('saving');
    try {
      const data = await fetchJson<{ user: AiUserProfile }>('/api/ai/session', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session?.id,
          riskBias: user.riskBias,
          preferredQuoteToken: user.preferredQuoteToken,
        }),
      });
      setUser(data.user);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Failed to save preferences',
      );
      setSaveState('idle');
    }
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.authenticated || !input.trim()) return;

    setSending(true);
    setError(null);
    try {
      const data = await fetchJson<{
        session: AiSession;
        user: AiUserProfile;
        userMessage: AiMessage;
        assistantMessage: AiMessage;
      }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session?.id,
          message: input.trim(),
        }),
      });

      setSession(data.session);
      setUser(data.user);
      setMessages((current) => [...current, data.userMessage, data.assistantMessage]);
      setInput('');
      if (address) {
        await loadSession(address).catch(() => undefined);
      }
      await loadHealth().catch(() => undefined);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Chat request failed');
    } finally {
      setSending(false);
    }
  }

  async function handleExecuteSwap(tool: SwapToolResult) {
    if (!walletClient || !address || !auth.authenticated) {
      setError('Unlock AI memory before submitting a swap.');
      return;
    }

    try {
      if (wrongChain) {
        await handleSwitchChain();
        return;
      }

      const hash = await (walletClient as { sendTransaction: (input: {
        account: Address;
        chain: typeof xlayer;
        to: Address;
        data: `0x${string}`;
        value: bigint;
      }) => Promise<`0x${string}`> }).sendTransaction({
        account: address as Address,
        chain: xlayer,
        to: tool.execution.to as Address,
        data: tool.execution.data as `0x${string}`,
        value: BigInt(tool.execution.value || '0'),
      });

      setPendingExecution({
        hash,
        actionId: tool.actionId ?? hash,
      });
      setError(null);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Swap submission failed';
      setError(message);
      if (tool.actionId) {
        await fetchJson('/api/ai/action', {
          method: 'POST',
          body: JSON.stringify({
            actionId: tool.actionId,
            status: 'failed',
            payload: {
              error: message,
              txLifecycle: 'failed',
            },
          }),
        }).catch(() => undefined);
      }
    }
  }

  const memoryStatus: AiProviderStatus = auth.authenticated
    ? 'live'
    : authFlow === 'error'
      ? 'degraded'
      : authFlow === 'signing' || authFlow === 'checking'
        ? 'fallback'
        : 'unconfigured';
  const llmStatus: AiProviderStatus =
    latestAssistantMessage?.metadata?.llm?.source === 'heuristic'
      ? 'fallback'
      : health?.llm.status ?? 'unconfigured';
  const okxStatus: AiProviderStatus = health?.okx.status ?? 'unconfigured';
  const authLabel = auth.authenticated
    ? `Unlocked ${auth.walletAddress ? shortenAddress(auth.walletAddress) : ''}`
    : authFlow === 'signing'
      ? 'Signature pending'
      : 'Read only';
  const llmLabel =
    latestAssistantMessage?.metadata?.llm?.source === 'heuristic'
      ? 'Heuristic fallback'
      : latestAssistantMessage?.metadata?.llm?.source === 'codex'
        ? 'Codex live'
        : health?.llm.provider === 'openai-codex'
          ? 'Codex standby'
          : 'OpenAI standby';
  const okxLabel = health?.okx.status === 'live' ? 'OKX live' : health?.okx.detail || 'Awaiting probe';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-synth-green/20 bg-gradient-to-br from-synth-surface to-synth-bg px-6 py-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,255,136,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(0,212,255,0.08),transparent_35%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-synth-green/20 bg-synth-green/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-synth-green">
              X Layer · Powered by OKX Onchain OS
            </div>
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold text-synth-text md:text-4xl">
                AI trading, wallet-first memory, zero hidden fallbacks
              </h1>
              <p className="mt-2 text-sm leading-6 text-synth-muted">
                Sign once to unlock persistent memory, Codex-backed intent parsing, and X Layer swap execution through OKX.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatusBadge label="Memory" value={authLabel} status={memoryStatus} />
            <StatusBadge label="LLM" value={llmLabel} status={llmStatus} />
            <StatusBadge label="Market" value={okxLabel} status={okxStatus} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.02fr_1.08fr_1.4fr]">
        <section className="rounded-2xl border border-synth-border bg-synth-surface/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-synth-cyan">
                Home
              </h2>
              <p className="mt-1 text-xs text-synth-muted">
                Wallet identity, AI memory, and current provider state.
              </p>
            </div>
            {address ? (
              <span className="rounded-full border border-synth-green/20 bg-synth-green/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-synth-green">
                Connected
              </span>
            ) : (
              <span className="rounded-full border border-synth-border px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                Read Only
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-synth-border/70 bg-synth-bg/60 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-synth-muted">
                  Total Value
                </div>
                <div className="mt-2 text-2xl font-bold text-synth-text">
                  {formatUsd(balances?.totalValueUsd)}
                </div>
              </div>
              <div className="rounded-xl border border-synth-border/70 bg-synth-bg/60 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-synth-muted">
                  Native
                </div>
                <div className="mt-2 text-2xl font-bold text-synth-text">
                  {nativeBalance ? Number(nativeBalance.formatted).toFixed(3) : '0.000'}
                </div>
                <div className="text-xs text-synth-muted">OKB</div>
              </div>
            </div>

            <div className="rounded-2xl border border-synth-green/15 bg-[linear-gradient(180deg,rgba(0,255,136,0.04),rgba(6,12,10,0.88))] p-4 shadow-[inset_0_1px_0_rgba(0,255,136,0.04)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-synth-muted">
                    Persistent Memory
                  </div>
                  <div className="mt-2 text-sm leading-6 text-synth-text">
                    Wallet-linked preferences, watchlist state, and message history stay server-side behind a signed session.
                  </div>
                </div>
                <StatusBadge
                  label="State"
                  value={auth.authenticated ? 'Unlocked' : 'Locked'}
                  status={memoryStatus}
                />
              </div>

              {!auth.authenticated ? (
                <div className="space-y-3 rounded-xl border border-synth-border/70 bg-black/20 p-4">
                  <div className="text-sm text-synth-text">
                    {address
                      ? 'Sign once with your connected wallet to unlock AI memory, history, and trading actions.'
                      : 'Connect a wallet first. The terminal stays readable, but memory and actions stay locked.'}
                  </div>
                  {address ? (
                    <button
                      type="button"
                      onClick={() => void authenticateWallet(address)}
                      className="btn-primary"
                      disabled={authFlow === 'signing' || authFlow === 'checking'}
                    >
                      {authFlow === 'signing' ? 'Awaiting Signature...' : 'Unlock Memory'}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-synth-border/60 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                        Authenticated Wallet
                      </div>
                      <div className="mt-2 text-sm font-semibold text-synth-text">
                        {auth.walletAddress ? shortenAddress(auth.walletAddress) : 'Unknown'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-synth-border/60 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                        Session Expiry
                      </div>
                      <div className="mt-2 text-sm font-semibold text-synth-text">
                        {auth.expiresAt ? new Date(auth.expiresAt).toLocaleString() : 'Not set'}
                      </div>
                    </div>
                  </div>
                  <PreferenceSegment
                    label="Risk Bias"
                    value={user?.riskBias ?? 'balanced'}
                    options={riskOptions}
                    onChange={(nextValue) =>
                      setUser((current) =>
                        current ? { ...current, riskBias: nextValue } : current,
                      )
                    }
                  />
                  <PreferenceSegment
                    label="Preferred Quote Token"
                    value={user?.preferredQuoteToken ?? 'USDT'}
                    options={quoteOptions}
                    onChange={(nextValue) =>
                      setUser((current) =>
                        current
                          ? {
                              ...current,
                              preferredQuoteToken: nextValue,
                            }
                          : current,
                      )
                    }
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSavePreferences()}
                      className="btn-primary"
                      disabled={saveState === 'saving'}
                    >
                      {saveState === 'saving'
                        ? 'Saving...'
                        : saveState === 'saved'
                          ? 'Preferences Saved'
                          : 'Save Preferences'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void logoutAi()}
                      className="btn-secondary"
                    >
                      Lock Memory
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-synth-border/70 bg-synth-bg/60 p-4">
              <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-synth-muted">
                Watchlist
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {watchlist.length > 0 ? (
                  watchlist.map((item) => (
                    <span
                      key={item.address}
                      className="rounded-full border border-synth-border px-3 py-1 text-xs text-synth-text"
                    >
                      {item.symbol}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-synth-muted">
                    Ask about a token and it will be remembered here.
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-synth-border/70 bg-synth-bg/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.18em] text-synth-muted">
                  Market Snapshot
                </div>
                <button
                  type="button"
                  onClick={() => void loadHealth().catch(() => undefined)}
                  className="text-xs text-synth-green"
                >
                  Refresh Status
                </button>
              </div>
              <div className="space-y-2">
                {marketCards.map((item) => (
                  <div
                    key={item.tokenContractAddress}
                    className="flex items-center justify-between rounded-lg border border-synth-border/60 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-synth-text">
                        {item.tokenSymbol}
                      </div>
                      <div className="text-xs text-synth-muted">{item.tokenName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-synth-text">{formatUsd(item.price)}</div>
                      <div className="text-xs text-synth-muted">{item.change || '0'}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-synth-border bg-synth-surface/70 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-synth-cyan">
              Assets
            </h2>
            <p className="mt-1 text-xs text-synth-muted">
              X Layer balances and AI execution state.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-synth-border/70 bg-synth-bg/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.18em] text-synth-muted">
                  Wallet Balances
                </div>
                {auth.authenticated && address ? (
                  <button
                    type="button"
                    onClick={() => address && void loadSession(address)}
                    className="text-xs text-synth-green"
                  >
                    Refresh
                  </button>
                ) : null}
              </div>
              <div className="space-y-2">
                {balances?.data?.length ? (
                  balances.data.slice(0, 8).map((item) => (
                    <div
                      key={`${item.tokenContractAddress}-${item.symbol}`}
                      className="flex items-center justify-between rounded-lg border border-synth-border/60 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold text-synth-text">
                          {item.symbol}
                        </div>
                        <div className="text-xs text-synth-muted">
                          {item.tokenName || 'Token'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-synth-text">
                          {formatTokenBalance(item)}
                        </div>
                        <div className="text-xs text-synth-muted">
                          {formatUsd(item.valueUsd)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-synth-muted">
                    {auth.authenticated
                      ? balances?.error || 'No balances returned from OKX yet.'
                      : 'Unlock memory to load authenticated X Layer balances.'}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-synth-border/70 bg-synth-bg/60 p-4">
              <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-synth-muted">
                Recent Actions
              </div>
              <div className="space-y-2">
                {actions.length > 0 ? (
                  actions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-lg border border-synth-border/60 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-synth-text">
                            {action.actionType.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-synth-muted">
                            {new Date(action.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs uppercase tracking-[0.18em] text-synth-green">
                            {action.status}
                          </div>
                          {action.txHash ? (
                            <a
                              href={`https://www.oklink.com/xlayer/tx/${action.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-synth-cyan hover:text-synth-green"
                            >
                              View Tx
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-synth-muted">
                    Your OKX swap quotes and AI actions will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-synth-border bg-synth-surface/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-synth-cyan">
                AI
              </h2>
              <p className="mt-1 text-xs text-synth-muted">
                Ask for prices, balances, buy reads, or swap routes.
              </p>
            </div>
            <div className="text-right text-[11px] uppercase tracking-[0.18em] text-synth-muted">
              {session ? `Session ${session.id.slice(0, 8)}` : auth.authenticated ? 'Session booting' : 'Read only'}
            </div>
          </div>

          {wrongChain && (
            <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              This terminal only executes on X Layer.
              <button type="button" onClick={() => void handleSwitchChain()} className="ml-3 btn-secondary text-xs">
                Switch Chain
              </button>
            </div>
          )}

          {pendingExecution && (
            <div className="mb-4 rounded-lg border border-synth-green/20 bg-synth-green/10 px-4 py-3 text-sm text-synth-text">
              {isConfirming
                ? `Waiting for confirmation: ${pendingExecution.hash.slice(0, 10)}...`
                : `Transaction submitted: ${pendingExecution.hash.slice(0, 10)}...`}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex min-h-[560px] flex-col rounded-2xl border border-synth-border/70 bg-synth-bg/70">
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="text-sm text-synth-muted">Loading AI terminal...</div>
              ) : messages.length > 0 ? (
                messages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    isConnected={isConnected}
                    wrongChain={wrongChain}
                    onSwitchChain={() => void handleSwitchChain()}
                    onExecuteSwap={handleExecuteSwap}
                    executingActionId={pendingExecution?.actionId ?? null}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-synth-border px-4 py-5 text-sm text-synth-muted">
                  {auth.authenticated
                    ? 'Start with: “check my balance”, “price of OKB”, or “swap 0.1 OKB to USDT”.'
                    : 'Unlock memory to start authenticated chat, balances, and swap actions.'}
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="border-t border-synth-border/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="input-field flex-1"
                  placeholder={
                    auth.authenticated
                      ? 'Ask Synth AI about X Layer...'
                      : address
                        ? 'Sign once to unlock AI chat'
                        : 'Connect a wallet to unlock memory'
                  }
                  disabled={!auth.authenticated || sending}
                />
                <button
                  type="submit"
                  className="btn-primary md:min-w-[140px]"
                  disabled={!auth.authenticated || sending || !input.trim()}
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-synth-border bg-synth-surface/70 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-synth-text">
              Launch your agent, then trade from the same workspace
            </h3>
            <p className="mt-1 text-sm text-synth-muted">
              `/ai` stays X Layer-only and uses OKX Onchain OS for market, search, balances, and swap routing.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/launch?chainId=196" className="btn-primary">
              Launch on X Layer
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
