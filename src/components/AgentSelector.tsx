'use client';

import { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  platform: string;
  verified: boolean;
}

// Mock agents - will fetch from Moltbook API later
const MOCK_AGENTS: Agent[] = [
  { id: '1', name: 'AliceBTC', platform: 'Moltbook', verified: true },
  { id: '2', name: 'NeuralBot', platform: 'Moltbook', verified: true },
  { id: '3', name: 'SynapseAgent', platform: 'Moltbook', verified: false },
  { id: '4', name: 'CortexAI', platform: 'Moltbook', verified: true },
];

interface AgentSelectorProps {
  value: string;
  onChange: (agentId: string) => void;
}

export function AgentSelector({ value, onChange }: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = MOCK_AGENTS.find((a) => a.id === value);

  return (
    <div className="space-y-2">
      <label className="text-sm text-synth-muted">AI Agent</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="input-field w-full text-left flex items-center justify-between"
        >
          <span>
            {selected ? (
              <span className="flex items-center gap-2">
                <span className="text-synth-purple">🤖</span>
                {selected.name}
                {selected.verified && (
                  <span className="text-synth-green text-xs">✓</span>
                )}
              </span>
            ) : (
              <span className="text-synth-muted">Select an AI agent...</span>
            )}
          </span>
          <span className="text-synth-muted">▾</span>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-synth-surface border border-synth-border rounded-lg overflow-hidden z-10">
            {MOCK_AGENTS.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  onChange(agent.id);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-synth-green/10 flex items-center gap-2 transition-colors"
              >
                <span className="text-synth-purple">🤖</span>
                <span className="text-synth-text">{agent.name}</span>
                {agent.verified && (
                  <span className="text-synth-green text-xs">✓ verified</span>
                )}
                <span className="text-synth-muted text-xs ml-auto">
                  {agent.platform}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-[10px] text-synth-muted">
        Select the AI agent that will receive trading fees from this token.
      </p>
    </div>
  );
}
