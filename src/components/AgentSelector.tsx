'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';

type AgentMode = 'moltbook' | 'twitter' | 'self';

interface MoltBoardAgent {
  name: string;
  karma: number;
  verified: boolean;
  [key: string]: unknown;
}

interface AgentSelectorProps {
  value: string;
  onChange: (agentName: string) => void;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
}

export function AgentSelector({ value, onChange, mode, onModeChange }: AgentSelectorProps) {
  const { t } = useI18n();

  const MODE_TABS: { key: AgentMode; icon: string; label: string }[] = [
    { key: 'moltbook', icon: '🦞', label: t('agent.aiAgent') },
    { key: 'twitter', icon: '🐦', label: t('agent.twitterTab') },
    { key: 'self', icon: '👤', label: t('agent.selfTab') },
  ];

  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <div className="flex items-center gap-1 p-1 bg-synth-bg rounded-lg border border-synth-border">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onModeChange(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono rounded-md transition-all duration-200 ${
              mode === tab.key
                ? 'bg-synth-green/20 text-synth-green border border-synth-green/30'
                : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Mode Content */}
      {mode === 'moltbook' && (
        <MoltbookSelector value={value} onChange={onChange} />
      )}
      {mode === 'twitter' && (
        <TwitterSelector value={value} onChange={onChange} />
      )}
      {mode === 'self' && (
        <SelfSelector />
      )}
    </div>
  );
}

/* ── Moltbook Selector (original logic preserved) ── */
function MoltbookSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState<MoltBoardAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [validationState, setValidationState] = useState<'idle' | 'checking' | 'found' | 'not-found' | 'error'>('idle');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agents')
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data: MoltBoardAgent[] | { agents: MoltBoardAgent[] }) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : Array.isArray((data as { agents: MoltBoardAgent[] })?.agents) ? (data as { agents: MoltBoardAgent[] }).agents : [];
          setAgents(list);
          if (list.length === 0) setError(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const validateAgent = useCallback(async (name: string) => {
    if (!name.trim()) {
      setValidationState('idle');
      return;
    }
    if (agents.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      setValidationState('found');
      return;
    }
    setValidationState('checking');
    try {
      const res = await fetch(`https://www.moltbook.com/api/v1/agents/profile?name=${encodeURIComponent(name)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success !== false && !data.error) {
          setValidationState('found');
        } else {
          setValidationState('not-found');
        }
      } else {
        setValidationState('not-found');
      }
    } catch {
      setValidationState('error');
    }
  }, [agents]);

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = agents.find((a) => a.name.toLowerCase() === search.toLowerCase());
  const showCustomOption = search.trim() && !exactMatch;

  const handleSelectCustom = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setSearch('');
    validateAgent(name);
  };

  const handleSelectFromList = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setSearch('');
    setValidationState('found');
  };

  if (error) {
    return (
      <div className="space-y-2">
        <label className="text-sm text-synth-muted">{t('agent.aiAgent')}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setValidationState('idle');
          }}
          onBlur={() => validateAgent(value)}
          placeholder={t('agent.enterAgentName')}
          className="input-field w-full"
        />
        {validationState === 'checking' && (
          <p className="text-[10px] text-synth-cyan">{t('agent.verifying')}</p>
        )}
        {validationState === 'found' && (
          <p className="text-[10px] text-synth-green">{t('agent.verified')}</p>
        )}
        {validationState === 'not-found' && (
          <p className="text-[10px] text-yellow-400">{t('agent.agentNotFound')}</p>
        )}
        {validationState === 'error' && (
          <p className="text-[10px] text-yellow-400">{t('agent.apiUnavailable')}</p>
        )}
        {validationState === 'idle' && (
          <p className="text-[10px] text-synth-muted">
            {t('agent.boardUnavailable')}
          </p>
        )}
      </div>
    );
  }

  const selectedAgent = agents.find((a) => a.name === value);

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <label className="text-sm text-synth-muted">{t('agent.aiAgent')}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="input-field w-full text-left flex items-center justify-between"
        >
          <span>
            {loading ? (
              <span className="text-synth-muted">{t('agent.loadingAgents')}</span>
            ) : selectedAgent ? (
              <span className="flex items-center gap-2">
                <span className="text-synth-purple">🦞</span>
                {selectedAgent.name}
                {selectedAgent.verified && (
                  <span className="text-synth-green text-xs">✓</span>
                )}
                <span className="text-synth-muted text-xs">⚡ {selectedAgent.karma}</span>
              </span>
            ) : value ? (
              <span className="flex items-center gap-2">
                <span className="text-synth-purple">🦞</span>
                {value}
                {validationState === 'found' && <span className="text-synth-green text-xs">✓</span>}
                {validationState === 'not-found' && <span className="text-yellow-400 text-xs">⚠</span>}
                {validationState === 'error' && <span className="text-yellow-400 text-xs">⚠</span>}
              </span>
            ) : (
              <span className="text-synth-muted">{t('agent.selectAgent')}</span>
            )}
          </span>
          <span className="text-synth-muted">▾</span>
        </button>

        {isOpen && !loading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-synth-surface border border-synth-border rounded-lg overflow-hidden z-10">
            <div className="p-2 border-b border-synth-border">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('agent.searchPlaceholder')}
                className="w-full px-2 py-1.5 text-sm bg-synth-bg text-synth-text border border-synth-border rounded focus:border-synth-green/50 focus:outline-none placeholder:text-synth-muted"
                autoFocus
              />
            </div>

            {showCustomOption && (
              <button
                type="button"
                onClick={() => handleSelectCustom(search.trim())}
                className="w-full px-3 py-2 text-left text-sm hover:bg-synth-cyan/10 flex items-center justify-between border-b border-synth-border/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-synth-cyan">+</span>
                  <span className="text-synth-text">{t('agent.useCustom', { name: search.trim() })}</span>
                </span>
                <span className="text-synth-muted text-xs">{t('agent.custom')}</span>
              </button>
            )}

            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 && !showCustomOption ? (
                <div className="px-3 py-3 text-sm text-synth-muted text-center">
                  {t('agent.noAgentsFound')}
                </div>
              ) : (
                filtered.map((agent) => (
                  <button
                    key={agent.name}
                    type="button"
                    onClick={() => handleSelectFromList(agent.name)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-synth-green/10 flex items-center gap-2 transition-colors ${
                      value === agent.name ? 'bg-synth-green/5' : ''
                    }`}
                  >
                    <span className="text-synth-purple">🦞</span>
                    <span className="text-synth-text">{agent.name}</span>
                    {agent.verified && (
                      <span className="text-synth-green text-xs">✓ verified</span>
                    )}
                    <span className="text-synth-muted text-xs ml-auto">
                      ⚡ {agent.karma}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="px-3 py-2 border-t border-synth-border/50">
              <p className="text-[10px] text-synth-muted text-center">
                {t('agent.notInList')}
              </p>
            </div>
          </div>
        )}
      </div>

      {value && !selectedAgent && validationState === 'checking' && (
        <p className="text-[10px] text-synth-cyan">{t('agent.verifying')}</p>
      )}
      {value && !selectedAgent && validationState === 'found' && (
        <p className="text-[10px] text-synth-green">{t('agent.verified')}</p>
      )}
      {value && !selectedAgent && validationState === 'not-found' && (
        <p className="text-[10px] text-yellow-400">{t('agent.notVerified')}</p>
      )}
      {value && !selectedAgent && validationState === 'error' && (
        <p className="text-[10px] text-yellow-400">{t('agent.apiUnavailable')}</p>
      )}
      {(!value || selectedAgent || validationState === 'idle') && (
        <p className="text-[10px] text-synth-muted">
          {t('agent.selectHint')}
        </p>
      )}
    </div>
  );
}

/* ── Twitter Selector ── */
function TwitterSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  // Strip "tw:" prefix for display
  const handle = value.startsWith('tw:') ? value.slice(3) : '';

  const handleChange = (raw: string) => {
    // Remove @ prefix if user types it
    const clean = raw.replace(/^@/, '').trim();
    onChange(clean ? `tw:${clean}` : '');
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-synth-muted">{t('launch.twitterHandle')}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-synth-cyan text-sm font-mono">@</span>
        <input
          type="text"
          value={handle}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Alice_BTC_AI"
          className="input-field w-full pl-8"
        />
      </div>
      <p className="text-[10px] text-synth-muted">
        {t('agent.twitterNote')}
      </p>
      {handle && (
        <div className="bg-synth-cyan/5 border border-synth-cyan/20 rounded-lg px-3 py-2">
          <p className="text-[10px] text-synth-cyan">
            {t('agent.feesHeldNote', { handle })}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Self Selector ── */
function SelfSelector() {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <div className="bg-synth-green/5 border border-synth-green/20 rounded-lg px-3 py-3 space-y-1.5">
        <p className="text-sm text-synth-green font-mono">{t('agent.selfTitle')}</p>
        <p className="text-[10px] text-synth-muted">
          {t('agent.selfDesc')}
        </p>
      </div>
    </div>
  );
}
