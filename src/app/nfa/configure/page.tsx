'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';

interface AgentConfig {
  nfa_id: number;
  token_address: string;
  vault_address: string;
  agent_wallet: string;
  ai_provider: string;
  ai_model: string;
  strategy: string;
  auto_notify: boolean;
  notify_threshold: number;
  telegram_chat_id: string;
  has_ai_key: boolean;
  has_telegram: boolean;
}

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
];

const AI_MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Cheap)' },
    { value: 'gpt-4o', label: 'GPT-4o (Smart)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Cheap)' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Smart)' },
  ],
};

const STRATEGIES = [
  { value: 'hodl', label: '💎 HODL', desc: 'Hold tax revenue in vault' },
  { value: 'buyback', label: '🔥 Buyback', desc: 'Notify when ready to buyback' },
  { value: 'distribute', label: '🎁 Distribute', desc: 'Notify when ready to distribute' },
];

export default function ConfigureAgentPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // URL params
  const [nfaId, setNfaId] = useState<number | null>(null);
  
  // Form state
  const [config, setConfig] = useState<Partial<AgentConfig>>({
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    strategy: 'hodl',
    auto_notify: true,
    notify_threshold: 0.1,
  });
  const [aiApiKey, setAiApiKey] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get nfaId from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('nfaId');
    if (id) setNfaId(parseInt(id));
  }, []);

  // Load existing config
  useEffect(() => {
    if (!nfaId || !isConnected) return;

    const loadConfig = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/agent/config?nfaId=${nfaId}`);
        const data = await response.json();
        
        if (data.config) {
          setConfig(data.config);
        }
      } catch (err) {
        console.error('Failed to load config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [nfaId, isConnected]);

  const handleSave = async () => {
    if (!nfaId || !address) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Create signature
      const timestamp = Date.now();
      const message = `SynthLaunch Agent Config\n\nAction: write\nNFA ID: ${nfaId}\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      // Prepare config
      const configToSave = {
        ...config,
        nfa_id: nfaId,
        ai_api_key: aiApiKey || undefined,
        telegram_bot_token: telegramBotToken || undefined,
      };

      // Send to API
      const response = await fetch('/api/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configToSave, signature, timestamp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess('Configuration saved successfully!');
      setAiApiKey(''); // Clear sensitive fields
      setTelegramBotToken('');

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!nfaId) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Configure Agent</h1>
          <p className="text-gray-400 mb-4">No NFA ID specified.</p>
          <Link href="/nfa" className="text-blue-400 hover:underline">
            ← Back to NFA List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🦞 Configure Agent #{nfaId}</h1>
          <WalletConnect />
        </div>

        {!isConnected ? (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">Connect your wallet to configure this agent.</p>
            <p className="text-sm text-gray-500">You must be the NFALite owner.</p>
          </div>
        ) : loading ? (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <p className="text-gray-400">Loading configuration...</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg p-6 space-y-6">
            {/* AI Configuration */}
            <div>
              <h2 className="text-xl font-semibold mb-4">🤖 AI Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">AI Provider</label>
                  <select
                    value={config.ai_provider || 'openai'}
                    onChange={(e) => setConfig({ ...config, ai_provider: e.target.value, ai_model: AI_MODELS[e.target.value as keyof typeof AI_MODELS][0].value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  >
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <select
                    value={config.ai_model || 'gpt-4o-mini'}
                    onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  >
                    {AI_MODELS[config.ai_provider as keyof typeof AI_MODELS || 'openai'].map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    API Key {config.has_ai_key && <span className="text-green-500">(saved)</span>}
                  </label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={config.has_ai_key ? '••••••••' : 'sk-...'}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your key is encrypted before storage.</p>
                </div>
              </div>
            </div>

            {/* Strategy */}
            <div>
              <h2 className="text-xl font-semibold mb-4">📊 Strategy</h2>
              
              <div className="space-y-2">
                {STRATEGIES.map((s) => (
                  <label
                    key={s.value}
                    className={`flex items-center p-3 rounded border cursor-pointer ${
                      config.strategy === s.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      value={s.value}
                      checked={config.strategy === s.value}
                      onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">{s.label}</div>
                      <div className="text-sm text-gray-400">{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h2 className="text-xl font-semibold mb-4">🔔 Notifications</h2>
              
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.auto_notify ?? true}
                    onChange={(e) => setConfig({ ...config, auto_notify: e.target.checked })}
                    className="mr-3"
                  />
                  <span>Auto-notify when vault has funds</span>
                </label>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Notify Threshold (BNB)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.notify_threshold || 0.1}
                    onChange={(e) => setConfig({ ...config, notify_threshold: parseFloat(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Telegram Bot Token {config.has_telegram && <span className="text-green-500">(saved)</span>}
                  </label>
                  <input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder={config.has_telegram ? '••••••••' : 'Optional'}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={config.telegram_chat_id || ''}
                    onChange={(e) => setConfig({ ...config, telegram_chat_id: e.target.value })}
                    placeholder="Optional (e.g., -1001234567890)"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Error/Success */}
            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded p-3 text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-500/20 border border-green-500 rounded p-3 text-green-400">
                {success}
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded py-3 font-semibold transition"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>

            <p className="text-xs text-gray-500 text-center">
              ⚠️ Standard tier: AI runs on your API key. No private keys stored.
              <br />
              Chain operations require manual execution.
            </p>
          </div>
        )}

        <div className="mt-6">
          <Link href="/nfa" className="text-gray-400 hover:text-white">
            ← Back to NFA List
          </Link>
        </div>
      </div>
    </div>
  );
}
