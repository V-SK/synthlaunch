'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useSignMessage } from 'wagmi';
import { formatUnits, type Address } from 'viem';
import { ERC20_ABI } from '@/lib/erc20';
import { NFALITE_ABI, getNfaLiteAddress, ZERO_ADDRESS } from '@/lib/nfaLite';

interface AgentConfig {
  name?: string;
  avatar_url?: string | null;
  persona_prompt?: string | null;
  tone?: string | null;
  language?: string | null;
  chat_threshold?: number | null;
}

interface AgentPublic {
  name?: string | null;
  avatar_url?: string | null;
  token_address?: string | null;
}

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AgentChatPage() {
  const params = useParams();
  const idParam = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const agentId = Number(idParam);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const nfaLiteAddress = getNfaLiteAddress();
  const isConfigured = nfaLiteAddress !== ZERO_ADDRESS && Number.isFinite(agentId) && agentId > 0;

  const { data: agentData, isLoading: agentLoading } = useReadContract({
    address: nfaLiteAddress,
    abi: NFALITE_ABI,
    functionName: 'agents',
    args: [BigInt(agentId || 0)],
    query: { enabled: isConfigured },
  });

  const tokenAddress = useMemo(() => {
    if (!agentData) return ZERO_ADDRESS;
    const data = agentData as [string, string, Address, Address, Address, bigint, Address];
    return data[6] || ZERO_ADDRESS;
  }, [agentData]);

  const agentNameOnChain = useMemo(() => {
    if (!agentData) return '';
    const data = agentData as [string, string, Address, Address, Address, bigint, Address];
    return data[0] || '';
  }, [agentData]);

  const agentAvatarOnChain = useMemo(() => {
    if (!agentData) return '';
    const data = agentData as [string, string, Address, Address, Address, bigint, Address];
    return data[1] || '';
  }, [agentData]);

  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: tokenAddress !== ZERO_ADDRESS },
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: tokenAddress !== ZERO_ADDRESS },
  });

  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as Address],
    query: { enabled: isConnected && tokenAddress !== ZERO_ADDRESS && !!address },
  });

  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [agentPublic, setAgentPublic] = useState<AgentPublic | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!Number.isFinite(agentId) || agentId <= 0) return;
    let active = true;
    setConfigLoading(true);
    fetch(`/api/agent/${agentId}/config`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setAgentConfig(data?.config || null);
        setAgentPublic(data?.agent || null);
      })
      .catch(() => {
        if (!active) return;
        setAgentConfig(null);
        setAgentPublic(null);
      })
      .finally(() => {
        if (!active) return;
        setConfigLoading(false);
      });
    return () => {
      active = false;
    };
  }, [agentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const threshold = agentConfig?.chat_threshold ?? 1000;
  const decimalsNum = typeof decimals === 'bigint' ? Number(decimals) : (decimals ? Number(decimals) : 18);
  const requiredRaw = useMemo(() => {
    try {
      return BigInt(threshold) * 10n ** BigInt(decimalsNum);
    } catch {
      return 0n;
    }
  }, [threshold, decimalsNum]);
  const balanceRaw = balance ?? 0n;
  const hasAccess = threshold <= 0 ? true : balanceRaw >= requiredRaw;
  const tokenSymbol = symbol || 'TOKEN';
  const requiredFormatted = requiredRaw > 0n ? formatUnits(requiredRaw, decimalsNum) : threshold.toString();
  const balanceFormatted = formatUnits(balanceRaw, decimalsNum);

  const displayName = agentConfig?.name || agentPublic?.name || agentNameOnChain || `Agent #${agentId}`;
  const displayAvatar = agentConfig?.avatar_url || agentPublic?.avatar_url || agentAvatarOnChain || '/logo.jpg';

  const canChat = isConnected && hasAccess && !sending;

  async function handleSend() {
    if (!input.trim() || !canChat) return;
    setError('');
    const content = input.trim();
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content }]);
    try {
      const timestamp = Date.now();
      const signPayload = `SynthLaunch Agent Chat\\n\\nAgent ID: ${agentId}\\nMessage: ${content}\\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message: signPayload });
      const res = await fetch(`/api/agent/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          wallet: address,
          signature,
          timestamp,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Chat failed');
      }
      const reply = data?.reply || '...';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <aside className="card h-fit">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg overflow-hidden border border-synth-border bg-synth-bg">
            <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-synth-text">{displayName}</h2>
            <p className="text-xs text-synth-muted">Agent ID #{agentId}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-xs text-synth-muted">
          <div>
            <span className="text-synth-text">Token</span>
            <div className="font-mono text-[11px] break-all">{tokenAddress !== ZERO_ADDRESS ? tokenAddress : 'Not configured'}</div>
          </div>
          <div>
            <span className="text-synth-text">Threshold</span>
            <div className="font-mono text-[11px]">
              {requiredFormatted} {tokenSymbol}
            </div>
          </div>
          <div>
            <span className="text-synth-text">Your Balance</span>
            <div className="font-mono text-[11px]">
              {balanceFormatted} {tokenSymbol}
            </div>
          </div>
        </div>

        {!isConfigured && (
          <div className="mt-4 text-xs text-red-400">
            NFALite contract is not configured.
          </div>
        )}

        {configLoading || agentLoading ? (
          <div className="mt-4 text-xs text-synth-muted">Loading agent data...</div>
        ) : null}
      </aside>

      <section className="card flex flex-col min-h-[480px]">
        <div className="flex-1 overflow-y-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-synth-muted">
              {isConnected
                ? (hasAccess
                    ? 'Start chatting with your agent.'
                    : `持有 ${requiredFormatted} ${tokenSymbol} 代币即可与 Agent 对话`)
                : 'Connect your wallet to start chatting.'}
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={`${msg.role}-${idx}`} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                  msg.role === 'user'
                    ? 'bg-synth-green/10 border border-synth-green/30 text-synth-green'
                    : 'bg-synth-surface border border-synth-border text-synth-text'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="mt-3 text-xs text-red-400">{error}</div>
        )}

        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasAccess ? 'Type your message...' : 'Hold tokens to unlock chat'}
            className="input-field flex-1"
            disabled={!hasAccess || sending || !isConnected}
          />
          <button
            onClick={handleSend}
            className="btn-primary"
            disabled={!canChat || !input.trim()}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </section>
    </div>
  );
}
