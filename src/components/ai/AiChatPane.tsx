'use client';

import { useEffect, useRef } from 'react';
import type { AiMessage, AiToolResult, SwapToolResult } from '@/lib/ai/types';
import { AiToolCard } from './AiToolCard';

function normalizeToolResult(value: unknown): AiToolResult | null {
  if (!value || typeof value !== 'object') return null;
  return value as AiToolResult;
}

export interface AiChatPaneProps {
  messages: AiMessage[];
  loading: boolean;
  sending: boolean;
  authenticated: boolean;
  hasWallet: boolean;
  isConnected: boolean;
  wrongChain: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onSwitchChain: () => void;
  onExecuteSwap: (tool: SwapToolResult) => void;
  executingActionId?: string | null;
  banner?: React.ReactNode;
}

export function AiChatPane({
  messages,
  loading,
  sending,
  authenticated,
  hasWallet,
  isConnected,
  wrongChain,
  input,
  onInputChange,
  onSubmit,
  onSwitchChain,
  onExecuteSwap,
  executingActionId,
  banner,
}: AiChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, sending]);

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border"
      style={{ borderColor: 'var(--ai-border)', background: 'rgba(10,10,10,0.5)' }}
    >
      {banner}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="space-y-2">
            <div className="ai-shimmer h-12 rounded-[12px]" />
            <div className="ai-shimmer h-12 rounded-[12px]" />
            <div className="ai-shimmer h-12 rounded-[12px]" />
          </div>
        ) : messages.length > 0 ? (
          messages.map((message) => {
            const tool = normalizeToolResult(message.metadata?.toolResult);
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={`ai-fade-up flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-[12px] border px-4 py-3 ${
                    isUser
                      ? 'border-synth-green/30 bg-synth-green/10 text-synth-text'
                      : 'text-synth-text'
                  }`}
                  style={
                    isUser
                      ? undefined
                      : { borderColor: 'var(--ai-border)', background: 'rgba(20,20,20,0.7)' }
                  }
                >
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-synth-muted">
                    {isUser ? 'You' : 'Synth AI'}
                  </div>
                  <p className="whitespace-pre-wrap text-[14px] leading-6">{message.content}</p>
                  {message.metadata?.llm?.fallbackReason ? (
                    <div className="mt-2 rounded-[12px] border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 text-[12px] text-yellow-100">
                      Fallback: {message.metadata.llm.fallbackReason}
                    </div>
                  ) : null}
                  {tool ? (
                    <div className="mt-3">
                      <AiToolCard
                        tool={tool}
                        isConnected={isConnected}
                        wrongChain={wrongChain}
                        onSwitchChain={onSwitchChain}
                        onExecuteSwap={onExecuteSwap}
                        executingActionId={executingActionId}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div
            className="rounded-[12px] border border-dashed px-4 py-5 text-[14px] text-synth-muted"
            style={{ borderColor: 'var(--ai-border)' }}
          >
            {authenticated
              ? 'Try: "check my balance", "price of OKB", or "swap 0.1 OKB to USDT".'
              : 'Unlock memory to start chat, balances, and swap actions.'}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="shrink-0 border-t p-3"
        style={{ borderColor: 'var(--ai-border)', background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(6px)' }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            className="input-field flex-1 rounded-[12px]"
            placeholder={
              authenticated
                ? 'Ask Synth AI about X Layer...'
                : hasWallet
                  ? 'Sign once to unlock AI chat'
                  : 'Connect a wallet to unlock memory'
            }
            disabled={!authenticated || sending}
          />
          <button
            type="submit"
            className="btn-primary ai-press min-w-[100px] rounded-[12px]"
            disabled={!authenticated || sending || !input.trim()}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}
