'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useSignMessage } from 'wagmi';
import { type Address } from 'viem';
import { NFALITE_ABI, getNfaLiteAddress, ZERO_ADDRESS } from '@/lib/nfaLite';

interface AgentConfigForm {
  name: string;
  avatar_url: string;
  persona_prompt: string;
  tone: string;
  language: string;
  chat_threshold: number;
}

const toneOptions = [
  { value: 'lively', label: '活泼' },
  { value: 'professional', label: '专业' },
  { value: 'humorous', label: '搞笑' },
  { value: 'cold', label: '高冷' },
];

const languageOptions = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'bilingual', label: '双语' },
];

export default function AgentSettingsPage() {
  const params = useParams();
  const idParam = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const agentId = Number(idParam);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const nfaLiteAddress = getNfaLiteAddress();
  const isConfigured = nfaLiteAddress !== ZERO_ADDRESS && Number.isFinite(agentId) && agentId > 0;

  const { data: ownerData, isLoading: ownerLoading } = useReadContract({
    address: nfaLiteAddress,
    abi: NFALITE_ABI,
    functionName: 'ownerOf',
    args: [BigInt(agentId || 0)],
    query: { enabled: isConfigured },
  });

  const isOwner = useMemo(() => {
    if (!ownerData || !address) return false;
    return (ownerData as Address).toLowerCase() === address.toLowerCase();
  }, [ownerData, address]);

  const [form, setForm] = useState<AgentConfigForm>({
    name: '',
    avatar_url: '',
    persona_prompt: '',
    tone: 'lively',
    language: 'zh',
    chat_threshold: 1000,
  });

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isFinite(agentId) || agentId <= 0) return;
    fetch(`/api/agent/${agentId}/config`)
      .then((res) => res.json())
      .then((data) => {
        const config = data?.config || {};
        const toneValue = config.tone === 'friendly' ? 'lively' : (config.tone || 'lively');
        setForm({
          name: config.name || data?.agent?.name || '',
          avatar_url: config.avatar_url || data?.agent?.avatar_url || '',
          persona_prompt: config.persona_prompt || '',
          tone: toneValue,
          language: config.language || 'zh',
          chat_threshold: Number(config.chat_threshold ?? 1000),
        });
      })
      .catch(() => null);
  }, [agentId]);

  async function handleAvatarUpload(file: File) {
    if (!isOwner) {
      setError('Only NFALite owners can upload avatars.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const timestamp = Date.now();
      const signPayload = `SynthLaunch Agent Avatar\\n\\nAgent ID: ${agentId}\\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message: signPayload });
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/agent/${agentId}/avatar`, {
        method: 'POST',
        headers: {
          'x-signature': signature,
          'x-timestamp': String(timestamp),
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Upload failed');
      }
      setForm((prev) => ({ ...prev, avatar_url: data?.url || data?.gateway || '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!isOwner) return;
    setLoading(true);
    setSaveStatus('');
    setError('');
    try {
      const timestamp = Date.now();
      const signPayload = `SynthLaunch Agent Settings\\n\\nAgent ID: ${agentId}\\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message: signPayload });
      const res = await fetch(`/api/agent/${agentId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            name: form.name,
            avatar_url: form.avatar_url,
            persona_prompt: form.persona_prompt,
            tone: form.tone,
            language: form.language,
            chat_threshold: Number(form.chat_threshold || 0),
          },
          signature,
          timestamp,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Save failed');
      }
      setSaveStatus('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  if (!isConfigured) {
    return (
      <div className="card">
        <p className="text-sm text-red-400">NFALite contract is not configured.</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="card">
        <p className="text-sm text-synth-muted">Connect your wallet to configure this agent.</p>
      </div>
    );
  }

  if (!ownerLoading && !isOwner) {
    return (
      <div className="card">
        <p className="text-sm text-red-400">Only NFALite NFT holders can access settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-synth-green">Agent Settings</h1>
        <p className="text-xs text-synth-muted mt-2">Agent ID #{agentId}</p>

        <div className="mt-6 grid grid-cols-1 gap-4">
          <label className="text-xs text-synth-muted">
            Agent Name
            <input
              className="input-field mt-1 w-full"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className="text-xs text-synth-muted">
            Avatar
            <div className="mt-2 flex flex-col md:flex-row gap-3 items-start">
              <div className="w-20 h-20 border border-synth-border rounded-lg overflow-hidden bg-synth-bg">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-synth-muted">No Avatar</div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAvatarUpload(file);
                  }}
                  className="text-xs text-synth-muted"
                />
                <input
                  className="input-field w-full"
                  value={form.avatar_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, avatar_url: e.target.value }))}
                  placeholder="Or paste an image URL"
                />
                {uploading && <div className="text-[11px] text-synth-muted">Uploading...</div>}
              </div>
            </div>
          </label>

          <label className="text-xs text-synth-muted">
            Persona Prompt
            <textarea
              className="input-field mt-1 w-full min-h-[120px]"
              value={form.persona_prompt}
              onChange={(e) => setForm((prev) => ({ ...prev, persona_prompt: e.target.value }))}
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-xs text-synth-muted">
              Tone
              <select
                className="input-field mt-1 w-full"
                value={form.tone}
                onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
              >
                {toneOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-synth-muted">
              Language
              <select
                className="input-field mt-1 w-full"
                value={form.language}
                onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
              >
                {languageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-xs text-synth-muted">
            Chat Threshold
            <input
              type="number"
              min={0}
              className="input-field mt-1 w-full"
              value={form.chat_threshold}
              onChange={(e) => setForm((prev) => ({ ...prev, chat_threshold: Number(e.target.value) }))}
            />
          </label>
        </div>

        {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
        {saveStatus && <div className="mt-3 text-xs text-synth-green">{saveStatus}</div>}

        <div className="mt-6">
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
