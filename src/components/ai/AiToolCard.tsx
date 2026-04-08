'use client';

import { useState } from 'react';
import type {
  AiToolResult,
  BalanceTokenItem,
  SwapToolResult,
} from '@/lib/ai/types';

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
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(number);
}

function formatTokenBalance(item: BalanceTokenItem): string {
  const balance = Number(item.balance ?? '0');
  if (!Number.isFinite(balance)) return '0';
  return balance >= 1000
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(balance)
    : balance.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

const cardCls = 'rounded-[12px] border bg-synth-bg/70 p-3';
const cardStyle = { borderColor: 'var(--ai-border)' } as const;
const headerCls = 'text-[11px] uppercase tracking-wide text-synth-muted';

function CollapsibleList({
  count,
  threshold,
  children,
}: {
  count: number;
  threshold: number;
  children: (expanded: boolean) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(count <= threshold);
  return (
    <div>
      {children(expanded)}
      {count > threshold ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ai-press mt-2 w-full rounded-[12px] border px-3 py-1.5 text-[11px] uppercase tracking-wide text-synth-cyan"
          style={cardStyle}
        >
          {expanded ? 'Collapse' : `Show all ${count}`}
        </button>
      ) : null}
    </div>
  );
}

export interface AiToolCardProps {
  tool: AiToolResult;
  isConnected: boolean;
  wrongChain: boolean;
  onSwitchChain: () => void;
  onExecuteSwap: (tool: SwapToolResult) => void;
  executingActionId?: string | null;
}

export function AiToolCard({
  tool,
  isConnected,
  wrongChain,
  onSwitchChain,
  onExecuteSwap,
  executingActionId,
}: AiToolCardProps) {
  if (tool.type === 'error') {
    return (
      <div
        className="rounded-[12px] border border-red-500/30 bg-red-500/10 p-3 text-[14px] text-red-300"
      >
        <div className="font-bold">{tool.title}</div>
        <div className="mt-1 text-red-200">{tool.detail}</div>
      </div>
    );
  }

  if (tool.type === 'balances') {
    const items = tool.balances;
    return (
      <div className={cardCls} style={cardStyle}>
        <div className="flex items-center justify-between">
          <h4 className={headerCls}>X Layer Balances</h4>
          <span className="text-[12px] text-synth-green">{formatUsd(tool.totalValueUsd)}</span>
        </div>
        <CollapsibleList count={items.length} threshold={3}>
          {(expanded) => (
            <div className="mt-3 space-y-2">
              {(expanded ? items : items.slice(0, 3)).map((item) => (
                <div
                  key={`${item.tokenContractAddress}-${item.symbol}`}
                  className="flex items-center justify-between rounded-[12px] border px-3 py-2 text-[12px]"
                  style={cardStyle}
                >
                  <div>
                    <div className="text-[14px] font-semibold text-synth-text">{item.symbol}</div>
                    <div className="text-[12px] text-synth-muted">{item.tokenName || 'Token'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] text-synth-text">{formatTokenBalance(item)}</div>
                    <div className="text-[12px] text-synth-muted">{formatUsd(item.valueUsd)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleList>
      </div>
    );
  }

  if (tool.type === 'price') {
    return (
      <div className={cardCls} style={cardStyle}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[14px] font-bold text-synth-text">{tool.token.tokenName}</div>
            <div className="text-[12px] text-synth-muted">${tool.token.tokenSymbol} · X Layer</div>
          </div>
          <div className="text-right">
            <div className="text-[14px] font-bold text-synth-green">{formatUsd(tool.token.price)}</div>
            <div className="text-[12px] text-synth-muted">24h {tool.token.change || '0'}%</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <div className="rounded-[12px] border px-2 py-2" style={cardStyle}>
            <div className="text-synth-muted">Liquidity</div>
            <div className="mt-1 text-synth-text">{formatCompact(tool.token.liquidity)}</div>
          </div>
          <div className="rounded-[12px] border px-2 py-2" style={cardStyle}>
            <div className="text-synth-muted">MCap</div>
            <div className="mt-1 text-synth-text">{formatCompact(tool.token.marketCap)}</div>
          </div>
          <div className="rounded-[12px] border px-2 py-2" style={cardStyle}>
            <div className="text-synth-muted">Holders</div>
            <div className="mt-1 text-synth-text">{formatCompact(tool.token.holders)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (tool.type === 'search') {
    const items = tool.results;
    return (
      <div className={cardCls} style={cardStyle}>
        <div className={`mb-3 ${headerCls}`}>Search: {tool.query}</div>
        <CollapsibleList count={items.length} threshold={3}>
          {(expanded) => (
            <div className="space-y-2">
              {(expanded ? items : items.slice(0, 3)).map((item) => (
                <div
                  key={item.tokenContractAddress}
                  className="flex items-center justify-between rounded-[12px] border px-3 py-2 text-[12px]"
                  style={cardStyle}
                >
                  <div>
                    <div className="text-[14px] font-semibold text-synth-text">{item.tokenSymbol}</div>
                    <div className="text-[12px] text-synth-muted">{item.tokenName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] text-synth-text">{formatUsd(item.price)}</div>
                    <div className="text-[12px] text-synth-muted">{item.change || '0'}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleList>
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
      <div className={cardCls} style={cardStyle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-synth-text">{tool.token.tokenSymbol}</div>
            <div className="text-[12px] text-synth-muted">{tool.token.tokenName}</div>
          </div>
          <div className={`text-[14px] font-bold uppercase ${verdictColor}`}>{tool.verdict}</div>
        </div>
        <p className="mt-3 text-[14px] text-synth-text">{tool.reason}</p>
      </div>
    );
  }

  if (tool.type === 'swapQuote') {
    const isExecuting = executingActionId === tool.actionId;
    return (
      <div className={cardCls} style={cardStyle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-synth-text">Swap Quote</div>
            <div className="text-[12px] text-synth-muted">
              {tool.tokenIn.tokenSymbol} → {tool.tokenOut.tokenSymbol}
            </div>
          </div>
          <div className="text-right text-[12px] text-synth-muted">X Layer · OKX</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-[12px] border px-2 py-2" style={cardStyle}>
            <div className="text-synth-muted">Input</div>
            <div className="mt-1 text-synth-text">
              {tool.amountIn} {tool.tokenIn.tokenSymbol}
            </div>
          </div>
          <div className="rounded-[12px] border px-2 py-2" style={cardStyle}>
            <div className="text-synth-muted">Output</div>
            <div className="mt-1 text-synth-text">
              {tool.amountOut || tool.minAmountOut || 'Pending'} {tool.tokenOut.tokenSymbol}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isConnected ? (
            <span
              className="rounded-[12px] border px-3 py-2 text-[12px] text-synth-muted"
              style={cardStyle}
            >
              Connect wallet to execute
            </span>
          ) : wrongChain ? (
            <button type="button" onClick={onSwitchChain} className="btn-secondary ai-press text-[12px]">
              Switch to X Layer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onExecuteSwap(tool)}
              className="btn-primary ai-press text-[12px]"
              disabled={isExecuting}
            >
              {isExecuting ? 'Submitting...' : 'Confirm Swap'}
            </button>
          )}
          <span
            className="rounded-[12px] border px-3 py-2 text-[12px] text-synth-muted"
            style={cardStyle}
          >
            Slippage {tool.slippage || '0.5'}%
          </span>
        </div>
      </div>
    );
  }

  return null;
}
