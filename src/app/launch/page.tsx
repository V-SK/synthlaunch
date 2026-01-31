'use client';

import { useState, useRef } from 'react';
import { TaxRateSlider } from '@/components/TaxRateSlider';
import { AgentSelector } from '@/components/AgentSelector';
import { WalletConnect } from '@/components/WalletConnect';
import { useAccount } from 'wagmi';
import { useLaunchToken } from '@/hooks/useFlap';
import { uploadToFlap } from '@/lib/ipfs';

type LaunchStep = 'idle' | 'uploading' | 'sending-tx' | 'confirming' | 'success' | 'error';

export default function LaunchPage() {
  const { isConnected, address } = useAccount();
  const { launch, hash, isPending, isConfirming, isSuccess, error: txError, reset } = useLaunchToken();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    symbol: '',
    description: '',
    image: null as File | null,
    imagePreview: '',
    website: '',
    twitter: '',
    telegram: '',
    taxRate: 2,
    agentId: '',
    devBuyAmount: '',
  });

  const [step, setStep] = useState<LaunchStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');

  const handleImageChange = (file: File | null) => {
    if (!file) return;
    setForm(prev => ({
      ...prev,
      image: file,
      imagePreview: URL.createObjectURL(file),
    }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageChange(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    // Validate
    if (!form.name.trim()) return setErrorMsg('Token name is required');
    if (!form.symbol.trim()) return setErrorMsg('Token symbol is required');
    if (!form.image) return setErrorMsg('Token image is required');

    setErrorMsg('');
    setTokenAddress('');

    try {
      // Step 1: Upload image + metadata to IPFS (single request)
      setStep('uploading');
      const metaCid = await uploadToFlap(form.image, {
        name: form.name,
        symbol: form.symbol,
        description: form.description,
        website: form.website || undefined,
        twitter: form.twitter || undefined,
        telegram: form.telegram || undefined,
      });

      // Step 2: Send transaction
      setStep('sending-tx');
      launch({
        metaCid,
        name: form.name,
        symbol: form.symbol,
        taxRate: form.taxRate,
        devBuyAmount: form.devBuyAmount,
      });
    } catch (err) {
      setStep('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Track tx status
  const currentStep: LaunchStep =
    isSuccess ? 'success' :
    isConfirming ? 'confirming' :
    isPending ? 'sending-tx' :
    txError ? 'error' :
    step;

  const isLoading = ['uploading', 'sending-tx', 'confirming'].includes(currentStep);

  const stepLabels: Record<LaunchStep, string> = {
    'idle': '',
    'uploading': 'Uploading to IPFS...',
    'sending-tx': 'Confirm transaction in wallet...',
    'confirming': 'Waiting for confirmation...',
    'success': 'Token launched successfully!',
    'error': txError?.message || errorMsg || 'Transaction failed',
  };

  const handleReset = () => {
    setStep('idle');
    setErrorMsg('');
    setTokenAddress('');
    reset();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-synth-text terminal-prompt">
          Launch Token
        </h1>
        <p className="text-sm text-synth-muted">
          Create a new token on BSC with AI agent tax routing via Flap Protocol.
        </p>
      </div>

      {/* Status Banner */}
      {currentStep !== 'idle' && (
        <div className={`card border ${
          currentStep === 'success'
            ? 'border-synth-green/50 bg-synth-green/5'
            : currentStep === 'error'
            ? 'border-red-500/50 bg-red-500/5'
            : 'border-synth-cyan/50 bg-synth-cyan/5'
        }`}>
          <div className="flex items-center gap-3">
            {isLoading && (
              <div className="w-4 h-4 border-2 border-synth-cyan border-t-transparent rounded-full animate-spin" />
            )}
            {currentStep === 'success' && <span className="text-synth-green">✓</span>}
            {currentStep === 'error' && <span className="text-red-400">✕</span>}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-mono ${
                currentStep === 'success' ? 'text-synth-green' :
                currentStep === 'error' ? 'text-red-400' :
                'text-synth-cyan'
              }`}>
                {stepLabels[currentStep]}
              </p>
              {hash && (
                <a
                  href={`https://bscscan.com/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-synth-muted hover:text-synth-green truncate block"
                >
                  TX: {hash.slice(0, 10)}...{hash.slice(-8)}
                </a>
              )}
            </div>
            {(currentStep === 'success' || currentStep === 'error') && (
              <button onClick={handleReset} className="text-xs text-synth-muted hover:text-synth-text">
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Info */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            Token Information
          </h2>

          {/* Image Upload */}
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Token Image *</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border border-dashed border-synth-border rounded-lg p-6 text-center hover:border-synth-green/30 transition-colors cursor-pointer group"
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                className="hidden"
              />
              {form.imagePreview ? (
                <div className="flex items-center justify-center gap-3">
                  <img
                    src={form.imagePreview}
                    alt="preview"
                    className="w-16 h-16 rounded-lg object-cover border border-synth-border"
                  />
                  <div className="text-left">
                    <p className="text-sm text-synth-text">{form.image?.name}</p>
                    <p className="text-xs text-synth-muted">Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-synth-muted text-sm group-hover:text-synth-green transition-colors">
                    Drop image or click to upload
                  </p>
                  <p className="text-[10px] text-synth-muted">PNG, JPG, GIF, SVG</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Token Name *</label>
              <input
                type="text"
                placeholder="Neural Net Token"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field w-full"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Symbol *</label>
              <input
                type="text"
                placeholder="NNT"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                className="input-field w-full"
                maxLength={10}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Description</label>
            <textarea
              placeholder="Describe your token..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field w-full h-24 resize-none"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Social Links */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            Social Links
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Website</label>
              <input
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="input-field w-full"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Twitter</label>
              <input
                type="text"
                placeholder="@handle"
                value={form.twitter}
                onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                className="input-field w-full"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-synth-muted">Telegram</label>
              <input
                type="text"
                placeholder="t.me/group"
                value={form.telegram}
                onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                className="input-field w-full"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* AI Agent Config */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-purple uppercase tracking-wider">
            AI Agent Configuration
          </h2>

          <AgentSelector
            value={form.agentId}
            onChange={(agentId) => setForm({ ...form, agentId })}
          />

          <TaxRateSlider
            value={form.taxRate}
            onChange={(taxRate) => setForm({ ...form, taxRate })}
          />
        </div>

        {/* Dev Buy */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
            Initial Buy (Optional)
          </h2>
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Dev Buy Amount (BNB)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.0"
              value={form.devBuyAmount}
              onChange={(e) => setForm({ ...form, devBuyAmount: e.target.value })}
              className="input-field w-full"
              disabled={isLoading}
            />
            <p className="text-[10px] text-synth-muted">
              Amount of BNB to buy tokens with at launch. This creates initial liquidity.
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && currentStep === 'idle' && (
          <p className="text-sm text-red-400 text-center">{errorMsg}</p>
        )}

        {/* Submit */}
        <div className="flex flex-col items-center gap-4">
          {isConnected ? (
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-synth-green border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                '🚀 Launch Token'
              )}
            </button>
          ) : (
            <div className="w-full text-center space-y-3">
              <p className="text-sm text-synth-muted">Connect wallet to launch</p>
              <WalletConnect />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
