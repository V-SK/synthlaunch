'use client';

import type { AiProviderStatus } from '@/lib/ai/types';

function statusDot(status: AiProviderStatus): string {
  switch (status) {
    case 'live':
      return 'bg-synth-green shadow-[0_0_8px_rgba(0,255,136,0.6)]';
    case 'fallback':
      return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]';
    case 'degraded':
      return 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]';
    default:
      return 'bg-synth-muted/60';
  }
}

function StatusPill({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: AiProviderStatus;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-[12px] border px-3 py-1.5"
      style={{ borderColor: 'var(--ai-border)' }}
    >
      <span className={`h-2 w-2 rounded-full ai-pulse ${statusDot(status)}`} />
      <span className="text-[11px] uppercase tracking-wide text-synth-muted">{label}</span>
      <span className="text-[12px] text-synth-text">{value}</span>
    </div>
  );
}

export interface AiStatusBarProps {
  llm: { status: AiProviderStatus; label: string };
  okx: { status: AiProviderStatus; label: string };
  memory: { status: AiProviderStatus; label: string };
  onRefresh: () => void;
  onToggleSidebar?: () => void;
  refreshing?: boolean;
}

export function AiStatusBar({
  llm,
  okx,
  memory,
  onRefresh,
  onToggleSidebar,
  refreshing,
}: AiStatusBarProps) {
  return (
    <div
      className="flex h-12 items-center justify-between gap-3 rounded-[12px] border px-3"
      style={{ borderColor: 'var(--ai-border)', background: 'rgba(10,10,10,0.6)' }}
    >
      <div className="flex items-center gap-2 overflow-x-auto">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="ai-press flex h-8 w-8 items-center justify-center rounded-[12px] border text-synth-text lg:hidden"
            style={{ borderColor: 'var(--ai-border)' }}
            aria-label="Toggle sidebar"
          >
            <span className="text-lg leading-none">≡</span>
          </button>
        ) : null}
        <StatusPill label="LLM" value={llm.label} status={llm.status} />
        <StatusPill label="OKX" value={okx.label} status={okx.status} />
        <StatusPill label="Memory" value={memory.label} status={memory.status} />
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="ai-press flex h-8 w-8 items-center justify-center rounded-[12px] border text-synth-green"
        style={{ borderColor: 'var(--ai-border)' }}
        aria-label="Refresh status"
        disabled={refreshing}
      >
        <span className={refreshing ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
      </button>
    </div>
  );
}
