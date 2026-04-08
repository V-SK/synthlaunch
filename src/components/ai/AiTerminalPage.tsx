'use client';

import { useEffect, useMemo, useState } from 'react';
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
  AiUserProfile,
  BalanceTokenItem,
  SwapToolResult,
  TokenSearchItem,
} from '@/lib/ai/types';
import { AiStatusBar } from './AiStatusBar';
import { AiSidebar } from './AiSidebar';
import { AiChatPane } from './AiChatPane';

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

export function AiTerminalPage() {
  const { address, chain, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  useBalance({
    address,
    chainId: xlayer.id,
    query: { enabled: Boolean(address) },
  });
  const { switchChainAsync } = useSwitchChain();

  const [session, setSession] = useState<AiSession | null>(null);
  const [user, setUser] = useState<AiUserProfile | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [, setActions] = useState<AiActionLogEntry[]>([]);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const wrongChain = isConnected && chain?.id !== xlayer.id;

  const { isLoading: isConfirming, isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: pendingExecution?.hash,
    chainId: xlayer.id,
    query: { enabled: Boolean(pendingExecution?.hash) },
  });

  const watchlist = user?.watchlist ?? [];
  const quickSymbols = useMemo(() => {
    const watched = watchlist.map((item) => item.symbol).filter(Boolean);
    return watched.length > 0 ? watched.slice(0, 3) : ['OKB', 'USDT', 'ETH'];
  }, [watchlist]);
  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant') ?? null,
    [messages],
  );

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function loadHealth() {
    const next = await fetchJson<AiHealthResponse>('/api/ai/health');
    setHealth(next);
    setAuth(next.auth);
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

    if (activeAddress && sessionData.walletAddress !== activeAddress.toLowerCase()) {
      await logoutAi(false);
      return false;
    }

    setSession(sessionData.session);
    setUser(sessionData.user);

    const [history, balancesData] = await Promise.all([
      fetchJson<{ session: AiSession; messages: AiMessage[]; actions: AiActionLogEntry[] }>(
        `/api/ai/history?sessionId=${sessionData.session.id}`,
      ),
      fetchJson<BalancesResponse>(
        `/api/okx/balances?address=${sessionData.walletAddress}`,
      ).catch((err: unknown) => ({
        data: [],
        totalValueUsd: null,
        error: err instanceof Error ? err.message : 'Balance fetch failed',
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
        .flatMap((item) => (item.status === 'fulfilled' ? item.value.data.slice(0, 1) : []))
        .slice(0, 3),
    );
  }

  async function logoutAi(clearError = true) {
    await fetch('/api/ai/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
      () => undefined,
    );
    setAuth({ authenticated: false, walletAddress: null, expiresAt: null });
    setAuthFlow('idle');
    setSession(null);
    setUser(null);
    setMessages([]);
    setActions([]);
    setBalances(null);
    if (clearError) setError(null);
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
      body: JSON.stringify({ walletAddress: activeAddress }),
    });

    const signature = await signMessageAsync({ message: challenge.message });

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
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to authenticate AI terminal');
        setAuthFlow('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, signMessageAsync]);

  useEffect(() => {
    if (!pendingExecution?.actionId || !pendingExecution.hash || !auth.authenticated) return;
    void fetchJson('/api/ai/action', {
      method: 'POST',
      body: JSON.stringify({
        actionId: pendingExecution.actionId,
        status: 'submitted',
        txHash: pendingExecution.hash,
        payload: { txLifecycle: 'submitted' },
      }),
    }).catch(() => undefined);
  }, [auth.authenticated, pendingExecution?.actionId, pendingExecution?.hash]);

  useEffect(() => {
    if (!txConfirmed || !pendingExecution?.actionId || !auth.authenticated || !address) return;
    void (async () => {
      await fetchJson('/api/ai/action', {
        method: 'POST',
        body: JSON.stringify({
          actionId: pendingExecution.actionId,
          status: 'confirmed',
          txHash: pendingExecution.hash,
          payload: { txLifecycle: 'confirmed' },
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      setSaveState('idle');
    }
  }

  async function handleSendMessage() {
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
        body: JSON.stringify({ sessionId: session?.id, message: input.trim() }),
      });
      setSession(data.session);
      setUser(data.user);
      setMessages((current) => [...current, data.userMessage, data.assistantMessage]);
      setInput('');
      if (address) await loadSession(address).catch(() => undefined);
      await loadHealth().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed');
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
      const hash = await (walletClient as {
        sendTransaction: (input: {
          account: Address;
          chain: typeof xlayer;
          to: Address;
          data: `0x${string}`;
          value: bigint;
        }) => Promise<`0x${string}`>;
      }).sendTransaction({
        account: address as Address,
        chain: xlayer,
        to: tool.execution.to as Address,
        data: tool.execution.data as `0x${string}`,
        value: BigInt(tool.execution.value || '0'),
      });
      setPendingExecution({ hash, actionId: tool.actionId ?? hash });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Swap submission failed';
      setError(message);
      if (tool.actionId) {
        await fetchJson('/api/ai/action', {
          method: 'POST',
          body: JSON.stringify({
            actionId: tool.actionId,
            status: 'failed',
            payload: { error: message, txLifecycle: 'failed' },
          }),
        }).catch(() => undefined);
      }
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadHealth().catch(() => undefined);
      if (address && auth.authenticated) {
        await loadSession(address).catch(() => undefined);
      }
      await loadMarketCards(quickSymbols);
    } finally {
      setRefreshing(false);
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
  const memoryLabel = auth.authenticated
    ? `Unlocked ${auth.walletAddress ? shortenAddress(auth.walletAddress) : ''}`
    : authFlow === 'signing'
      ? 'Signing'
      : 'Locked';
  const llmLabel =
    latestAssistantMessage?.metadata?.llm?.source === 'heuristic'
      ? 'Heuristic'
      : latestAssistantMessage?.metadata?.llm?.source === 'codex'
        ? 'Codex live'
        : health?.llm.provider === 'openai-codex'
          ? 'Codex standby'
          : 'OpenAI standby';
  const okxLabel = health?.okx.status === 'live' ? 'Live' : health?.okx.detail || 'Probing';

  const banner = (
    <>
      {wrongChain ? (
        <div
          className="m-3 rounded-[12px] border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[12px] text-yellow-200"
        >
          This terminal only executes on X Layer.
          <button
            type="button"
            onClick={() => void handleSwitchChain()}
            className="btn-secondary ai-press ml-3 text-[11px]"
          >
            Switch
          </button>
        </div>
      ) : null}
      {pendingExecution ? (
        <div className="m-3 rounded-[12px] border border-synth-green/20 bg-synth-green/10 px-3 py-2 text-[12px] text-synth-text">
          {isConfirming
            ? `Waiting for confirmation: ${pendingExecution.hash.slice(0, 10)}...`
            : `Submitted: ${pendingExecution.hash.slice(0, 10)}...`}
        </div>
      ) : null}
      {error ? (
        <div className="m-3 rounded-[12px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
          {error}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col gap-4">
      <AiStatusBar
        llm={{ status: llmStatus, label: llmLabel }}
        okx={{ status: okxStatus, label: okxLabel }}
        memory={{ status: memoryStatus, label: memoryLabel }}
        onRefresh={() => void handleRefresh()}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        refreshing={refreshing}
      />

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="hidden lg:block lg:w-[300px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          <AiSidebar
            address={address}
            auth={auth}
            user={user}
            authFlow={authFlow}
            balances={balances}
            marketCards={marketCards}
            saveState={saveState}
            onAuthenticate={() => address && void authenticateWallet(address)}
            onLogout={() => void logoutAi()}
            onChangeRisk={(value) =>
              setUser((c) => (c ? { ...c, riskBias: value } : c))
            }
            onChangeQuote={(value) =>
              setUser((c) => (c ? { ...c, preferredQuoteToken: value } : c))
            }
            onSavePreferences={() => void handleSavePreferences()}
          />
        </div>

        <AiChatPane
          messages={messages}
          loading={loading}
          sending={sending}
          authenticated={auth.authenticated}
          hasWallet={Boolean(address)}
          isConnected={isConnected}
          wrongChain={Boolean(wrongChain)}
          input={input}
          onInputChange={setInput}
          onSubmit={() => void handleSendMessage()}
          onSwitchChain={() => void handleSwitchChain()}
          onExecuteSwap={handleExecuteSwap}
          executingActionId={pendingExecution?.actionId ?? null}
          banner={banner}
        />
      </div>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 flex lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="ai-slide-in relative z-50 h-full w-[300px] overflow-y-auto bg-synth-bg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <AiSidebar
              address={address}
              auth={auth}
              user={user}
              authFlow={authFlow}
              balances={balances}
              marketCards={marketCards}
              saveState={saveState}
              onAuthenticate={() => address && void authenticateWallet(address)}
              onLogout={() => void logoutAi()}
              onChangeRisk={(value) =>
                setUser((c) => (c ? { ...c, riskBias: value } : c))
              }
              onChangeQuote={(value) =>
                setUser((c) => (c ? { ...c, preferredQuoteToken: value } : c))
              }
              onSavePreferences={() => void handleSavePreferences()}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
