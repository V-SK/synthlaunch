'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatLanding() {
  const router = useRouter();
  const [agentId, setAgentId] = useState('');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h1 className="text-2xl md:text-3xl font-bold text-synth-green">Agent Chat</h1>
        <p className="text-sm text-synth-muted mt-2">
          Enter an NFA Lite agent ID to start chatting. Hold the required token to unlock the chat.
        </p>

        <div className="mt-6 flex flex-col md:flex-row gap-3">
          <input
            value={agentId}
            onChange={(e) => setAgentId(e.target.value.replace(/\\D/g, ''))}
            placeholder="Agent ID (e.g. 1)"
            className="input-field flex-1"
          />
          <button
            onClick={() => {
              if (!agentId) return;
              router.push(`/agent/${agentId}/chat`);
            }}
            className="btn-primary"
          >
            Open Chat
          </button>
        </div>
      </div>
    </div>
  );
}
