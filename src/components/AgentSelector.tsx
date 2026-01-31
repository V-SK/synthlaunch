'use client';

import { useState, useEffect, useRef } from 'react';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('https://moltboard-production.up.railway.app/api/agents/leaderboard')
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data: MoltBoardAgent[] | { agents: MoltBoardAgent[] }) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : Array.isArray((data as { agents: MoltBoardAgent[] })?.agents) ? (data as { agents: MoltBoardAgent[] }).agents : [];
          setAgents(list);
          if (list.length === 0) setError(true); // fallback to manual input
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

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  // Fallback: manual text input if API failed
  if (error) {
    return (
      <div className="space-y-2">
        <label className="text-sm text-synth-muted">AI Agent</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter agent name manually..."
          className="input-field w-full"
        />
        <p className="text-[10px] text-synth-muted">
          MoltBoard is unavailable — type the agent name manually.
        </p>
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
              </span>
            ) : (
              <span className="text-synth-muted">Select an AI agent...</span>
            )}
          </span>
          <span className="text-synth-muted">▾</span>
        </button>

        {isOpen && !loading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-synth-surface border border-synth-border rounded-lg overflow-hidden z-10">
            {/* Search input */}
            <div className="p-2 border-b border-synth-border">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents..."
                className="w-full px-2 py-1.5 text-sm bg-synth-bg text-synth-text border border-synth-border rounded focus:border-synth-green/50 focus:outline-none placeholder:text-synth-muted"
                autoFocus
              />
            </div>

            {/* Agent list */}
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm text-synth-muted text-center">
                  No agents found
                </div>
              ) : (
                filtered.map((agent) => (
                  <button
                    key={agent.name}
                    type="button"
                    onClick={() => {
                      onChange(agent.name);
                      setIsOpen(false);
                      setSearch('');
                    }}
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
          </div>
        )}
      </div>
      <p className="text-[10px] text-synth-muted">
        Select the AI agent that will receive trading fees from this token.
      </p>
    </div>
  );
}
