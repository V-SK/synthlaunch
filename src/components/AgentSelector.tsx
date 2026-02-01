'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface MoltBoardAgent {
  name: string;
  karma: number;
  verified: boolean;
  [key: string]: unknown;
}

interface AgentSelectorProps {
  value: string;
  onChange: (agentName: string) => void;
}

export function AgentSelector({ value, onChange }: AgentSelectorProps) {
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

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Soft validate custom agent name against Moltbook
  const validateAgent = useCallback(async (name: string) => {
    if (!name.trim()) {
      setValidationState('idle');
      return;
    }
    // If it's in the leaderboard list, already verified
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
      setValidationState('error'); // API down — don't block
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

  // Fallback: manual text input if API failed
  if (error) {
    return (
      <div className="space-y-2">
        <label className="text-sm text-synth-muted">AI Agent</label>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setValidationState('idle');
          }}
          onBlur={() => validateAgent(value)}
          placeholder="Enter agent name..."
          className="input-field w-full"
        />
        {validationState === 'checking' && (
          <p className="text-[10px] text-synth-cyan">⏳ Verifying on Moltbook...</p>
        )}
        {validationState === 'found' && (
          <p className="text-[10px] text-synth-green">✓ Agent verified on Moltbook</p>
        )}
        {validationState === 'not-found' && (
          <p className="text-[10px] text-yellow-400">⚠ Agent not found on Moltbook — make sure the name is correct</p>
        )}
        {validationState === 'error' && (
          <p className="text-[10px] text-yellow-400">⚠ Could not verify — Moltbook API unavailable</p>
        )}
        {validationState === 'idle' && (
          <p className="text-[10px] text-synth-muted">
            MoltBoard is unavailable — type the exact agent name.
          </p>
        )}
      </div>
    );
  }

  const selectedAgent = agents.find((a) => a.name === value);

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <label className="text-sm text-synth-muted">AI Agent</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="input-field w-full text-left flex items-center justify-between"
        >
          <span>
            {loading ? (
              <span className="text-synth-muted">Loading agents...</span>
            ) : selectedAgent ? (
              <span className="flex items-center gap-2">
                <span className="text-synth-purple">🤖</span>
                {selectedAgent.name}
                {selectedAgent.verified && (
                  <span className="text-synth-green text-xs">✓</span>
                )}
                <span className="text-synth-muted text-xs">⚡ {selectedAgent.karma}</span>
              </span>
            ) : value ? (
              <span className="flex items-center gap-2">
                <span className="text-synth-purple">🤖</span>
                {value}
                {validationState === 'found' && <span className="text-synth-green text-xs">✓</span>}
                {validationState === 'not-found' && <span className="text-yellow-400 text-xs">⚠</span>}
                {validationState === 'error' && <span className="text-yellow-400 text-xs">⚠</span>}
              </span>
            ) : (
              <span className="text-synth-muted">Select an AI agent...</span>
            )}
          </span>
          <span className="text-synth-muted">▾</span>
        </button>

        {isOpen && !loading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-synth-surface border border-synth-border rounded-lg overflow-hidden z-10">
            {/* Search / custom input */}
            <div className="p-2 border-b border-synth-border">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or type agent name..."
                className="w-full px-2 py-1.5 text-sm bg-synth-bg text-synth-text border border-synth-border rounded focus:border-synth-green/50 focus:outline-none placeholder:text-synth-muted"
                autoFocus
              />
            </div>

            {/* Custom option */}
            {showCustomOption && (
              <button
                type="button"
                onClick={() => handleSelectCustom(search.trim())}
                className="w-full px-3 py-2 text-left text-sm hover:bg-synth-cyan/10 flex items-center justify-between border-b border-synth-border/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-synth-cyan">+</span>
                  <span className="text-synth-text">Use &quot;{search.trim()}&quot;</span>
                </span>
                <span className="text-synth-muted text-xs">custom</span>
              </button>
            )}

            {/* Agent list */}
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 && !showCustomOption ? (
                <div className="px-3 py-3 text-sm text-synth-muted text-center">
                  No agents found
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
                    <span className="text-synth-purple">🤖</span>
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

            {/* Hint */}
            <div className="px-3 py-2 border-t border-synth-border/50">
              <p className="text-[10px] text-synth-muted text-center">
                Not in top list? Type the exact agent name above.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Validation feedback below selector */}
      {value && !selectedAgent && validationState === 'checking' && (
        <p className="text-[10px] text-synth-cyan">⏳ Verifying on Moltbook...</p>
      )}
      {value && !selectedAgent && validationState === 'found' && (
        <p className="text-[10px] text-synth-green">✓ Agent verified on Moltbook</p>
      )}
      {value && !selectedAgent && validationState === 'not-found' && (
        <p className="text-[10px] text-yellow-400">⚠ Agent not verified on Moltbook — make sure the name is correct</p>
      )}
      {value && !selectedAgent && validationState === 'error' && (
        <p className="text-[10px] text-yellow-400">⚠ Could not verify — Moltbook API unavailable</p>
      )}
      {(!value || selectedAgent || validationState === 'idle') && (
        <p className="text-[10px] text-synth-muted">
          Select the AI agent that will receive trading fees from this token.
        </p>
      )}
    </div>
  );
}
