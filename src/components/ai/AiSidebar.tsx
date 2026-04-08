'use client';

import type {
  AiAuthState,
  AiUserProfile,
  BalanceTokenItem,
  TokenSearchItem,
} from '@/lib/ai/types';

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

function formatTokenBalance(item: BalanceTokenItem): string {
  const balance = Number(item.balance ?? '0');
  if (!Number.isFinite(balance)) return '0';
  return balance >= 1000
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(balance)
    : balance.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

const sectionCls = 'rounded-[12px] border p-4';
const sectionStyle = { borderColor: 'var(--ai-border)' } as const;
const headerCls = 'text-[11px] uppercase tracking-wide text-synth-muted';

function PreferenceSegment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className={headerCls}>{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`ai-press rounded-[12px] border px-2 py-2 text-[12px] transition ${
                active
                  ? 'border-synth-green/50 bg-synth-green/10 text-synth-green'
                  : 'text-synth-text hover:border-synth-green/30'
              }`}
              style={active ? undefined : sectionStyle}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface AiSidebarProps {
  address?: `0x${string}` | string;
  auth: AiAuthState;
  user: AiUserProfile | null;
  authFlow: 'idle' | 'checking' | 'signing' | 'authenticated' | 'error';
  balances: { data: BalanceTokenItem[]; totalValueUsd?: string | null; error?: string } | null;
  marketCards: TokenSearchItem[];
  saveState: 'idle' | 'saving' | 'saved';
  onAuthenticate: () => void;
  onLogout: () => void;
  onChangeRisk: (value: AiUserProfile['riskBias']) => void;
  onChangeQuote: (value: AiUserProfile['preferredQuoteToken']) => void;
  onSavePreferences: () => void;
}

export function AiSidebar({
  address,
  auth,
  user,
  authFlow,
  balances,
  marketCards,
  saveState,
  onAuthenticate,
  onLogout,
  onChangeRisk,
  onChangeQuote,
  onSavePreferences,
}: AiSidebarProps) {
  const watchlist = user?.watchlist ?? [];
  return (
    <aside className="flex w-full flex-col gap-4 lg:w-[280px]">
      <div className={sectionCls} style={sectionStyle}>
        <div className={headerCls}>Wallet</div>
        <div className="mt-2 text-[14px] font-semibold text-synth-text">
          {address ? shortenAddress(String(address)) : 'Not connected'}
        </div>
        <div className="mt-1 text-[12px] text-synth-muted">
          {balances?.totalValueUsd ? `Total ${formatUsd(balances.totalValueUsd)}` : 'No balances yet'}
        </div>
        {balances?.data?.length ? (
          <div className="mt-3 space-y-1.5">
            {balances.data.slice(0, 4).map((item) => (
              <div
                key={`${item.tokenContractAddress}-${item.symbol}`}
                className="flex items-center justify-between text-[12px]"
              >
                <span className="text-synth-text">{item.symbol}</span>
                <span className="text-synth-muted">{formatTokenBalance(item)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={sectionCls} style={sectionStyle}>
        <div className={headerCls}>Memory</div>
        {!auth.authenticated ? (
          <div className="mt-3 space-y-3">
            <p className="text-[12px] text-synth-muted">
              {address ? 'Sign once to unlock persistent AI memory.' : 'Connect a wallet first.'}
            </p>
            {address ? (
              <button
                type="button"
                onClick={onAuthenticate}
                className="btn-primary ai-press w-full"
                disabled={authFlow === 'signing' || authFlow === 'checking'}
              >
                {authFlow === 'signing' ? 'Awaiting Signature...' : 'Unlock Memory'}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="text-[12px] text-synth-muted">
              Unlocked {auth.walletAddress ? shortenAddress(auth.walletAddress) : ''}
            </div>
            <button type="button" onClick={onLogout} className="btn-secondary ai-press w-full text-[12px]">
              Lock Memory
            </button>
          </div>
        )}
      </div>

      {auth.authenticated && user ? (
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls}>Preferences</div>
          <div className="mt-3 space-y-4">
            <PreferenceSegment
              label="Risk Bias"
              value={user.riskBias}
              options={[
                { value: 'conservative', label: 'Safe' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'aggressive', label: 'Aggro' },
              ]}
              onChange={onChangeRisk}
            />
            <PreferenceSegment
              label="Quote Token"
              value={user.preferredQuoteToken}
              options={[
                { value: 'USDT', label: 'USDT' },
                { value: 'USDC', label: 'USDC' },
                { value: 'OKB', label: 'OKB' },
              ]}
              onChange={onChangeQuote}
            />
            <button
              type="button"
              onClick={onSavePreferences}
              className="btn-primary ai-press w-full text-[12px]"
              disabled={saveState === 'saving'}
            >
              {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}

      <div className={sectionCls} style={sectionStyle}>
        <div className={headerCls}>Watchlist</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {watchlist.length > 0 ? (
            watchlist.map((item) => (
              <span
                key={item.address}
                className="rounded-[12px] border px-2 py-1 text-[12px] text-synth-text"
                style={sectionStyle}
              >
                {item.symbol}
              </span>
            ))
          ) : (
            <span className="text-[12px] text-synth-muted">Ask about a token to track it.</span>
          )}
        </div>
      </div>

      <div className={sectionCls} style={sectionStyle}>
        <div className={headerCls}>Market Snapshot</div>
        <div className="mt-3 space-y-2">
          {marketCards.length > 0 ? (
            marketCards.map((item) => (
              <div
                key={item.tokenContractAddress}
                className="flex items-center justify-between rounded-[12px] border px-2 py-1.5 text-[12px]"
                style={sectionStyle}
              >
                <div>
                  <div className="text-synth-text">{item.tokenSymbol}</div>
                  <div className="text-synth-muted">{item.tokenName}</div>
                </div>
                <div className="text-right">
                  <div className="text-synth-text">{formatUsd(item.price)}</div>
                  <div className="text-synth-muted">{item.change || '0'}%</div>
                </div>
              </div>
            ))
          ) : (
            <div className="ai-shimmer h-10 rounded-[12px]" />
          )}
        </div>
      </div>
    </aside>
  );
}
