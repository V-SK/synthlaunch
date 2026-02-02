'use client';

import { useState, useRef } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TaxRateSlider } from '@/components/TaxRateSlider';
import { AgentSelector } from '@/components/AgentSelector';
import { WalletConnect } from '@/components/WalletConnect';
import { useAccount } from 'wagmi';
import { useLaunchToken } from '@/hooks/useFlap';
import { uploadToFlap } from '@/lib/ipfs';
import { useI18n } from '@/lib/i18n';

type LaunchStep = 'idle' | 'uploading' | 'mining-salt' | 'sending-tx' | 'confirming' | 'success' | 'error';
type LaunchMode = 'curve' | 'fairMint' | 'agentOnly';

function LaunchModeSelector({ mode, onModeChange }: { mode: LaunchMode; onModeChange: (m: LaunchMode) => void }) {
  const modes: { key: LaunchMode; icon: string; label: string; desc: string }[] = [
    { key: 'curve', icon: '🔄', label: 'Bonding Curve', desc: 'Classic bonding curve with auto-DEX migration' },
    { key: 'fairMint', icon: '⚡', label: 'Fair Mint', desc: 'Fixed price, equal access, LP auto-locked' },
    { key: 'agentOnly', icon: '🦞', label: 'Agent-Only Mint', desc: 'Fair Mint gated by SynthID verification' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {modes.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onModeChange(m.key)}
          className={`card text-left transition-all duration-200 border-2 ${
            mode === m.key
              ? 'border-synth-green bg-synth-green/5'
              : 'border-transparent hover:border-synth-border'
          }`}
        >
          <div className="text-2xl mb-2">{m.icon}</div>
          <h3 className={`text-sm font-bold mb-1 ${mode === m.key ? 'text-synth-green' : 'text-synth-text'}`}>
            {m.label}
          </h3>
          <p className="text-[10px] text-synth-muted leading-relaxed">{m.desc}</p>
          {mode === m.key && (
            <div className="mt-2 text-[10px] text-synth-green font-mono">● Selected</div>
          )}
        </button>
      ))}
    </div>
  );
}

function FairMintForm({ mode, isLoading }: { mode: 'fairMint' | 'agentOnly'; isLoading: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    symbol: '',
    image: null as File | null,
    imagePreview: '',
    totalSupply: '1000000',
    mintPrice: '0.001',
    perWalletLimit: '1000',
    mintDuration: '72h',
    lpRatio: 20,
    twitterVerify: false,
  });

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

  const isAgentOnly = mode === 'agentOnly';

  return (
    <div className="space-y-6">
      {/* SynthID Badge */}
      <div className="card border border-synth-cyan/30 bg-synth-cyan/5">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔑</span>
          <span className="text-xs text-synth-cyan font-mono">Requires SynthID — All launches verified on-chain</span>
        </div>
      </div>

      {/* Agent-Only Note */}
      {isAgentOnly && (
        <div className="card border border-orange-500/30 bg-orange-500/5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🦞</span>
            <div>
              <span className="text-sm text-orange-400 font-bold">Agent-Only Mint</span>
              <p className="text-xs text-synth-muted mt-0.5">Only SynthID holders can mint this token 🦞</p>
            </div>
          </div>
        </div>
      )}

      {/* Token Info */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Token Info</h2>

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
                  Drop image here or click to upload
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
              placeholder="My Fair Token"
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
              placeholder="MFT"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
              className="input-field w-full"
              maxLength={10}
              required
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Fair Mint Config */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-green uppercase tracking-wider">
          ⚡ Fair Mint Settings
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Total Supply</label>
            <input
              type="number"
              value={form.totalSupply}
              onChange={(e) => setForm({ ...form, totalSupply: e.target.value })}
              className="input-field w-full"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Mint Price (BNB)</label>
            <input
              type="number"
              step="0.0001"
              value={form.mintPrice}
              onChange={(e) => setForm({ ...form, mintPrice: e.target.value })}
              className="input-field w-full"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Per Wallet Limit</label>
            <input
              type="number"
              value={form.perWalletLimit}
              onChange={(e) => setForm({ ...form, perWalletLimit: e.target.value })}
              className="input-field w-full"
              placeholder="1000 tokens"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Mint Duration</label>
            <select
              value={form.mintDuration}
              onChange={(e) => setForm({ ...form, mintDuration: e.target.value })}
              className="input-field w-full"
              disabled={isLoading}
            >
              <option value="24h">24 hours</option>
              <option value="48h">48 hours</option>
              <option value="72h">72 hours</option>
              <option value="7d">7 days</option>
            </select>
          </div>
        </div>

        {/* LP Ratio Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-synth-muted">LP Ratio</label>
            <span className="text-sm text-synth-green font-mono">{form.lpRatio}%</span>
          </div>
          <input
            type="range"
            min={15}
            max={30}
            value={form.lpRatio}
            onChange={(e) => setForm({ ...form, lpRatio: Number(e.target.value) })}
            className="w-full accent-[#00FF88] h-1.5 bg-synth-surface rounded-full appearance-none cursor-pointer"
            disabled={isLoading}
          />
          <div className="flex justify-between text-[10px] text-synth-muted">
            <span>15%</span>
            <span>30%</span>
          </div>
          <p className="text-[10px] text-synth-muted">
            {form.lpRatio}% of raised BNB goes to permanent LP. Remaining {100 - form.lpRatio}% allocated to public mint pool.
          </p>
        </div>
      </div>

      {/* Token Allocation Preview */}
      <div className="card space-y-3">
        <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">Token Allocation</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-synth-green">Public Mint</span>
                <span className="text-synth-muted">{100 - form.lpRatio}%</span>
              </div>
              <div className="w-full h-3 bg-synth-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-synth-green rounded-full"
                  style={{ width: `${100 - form.lpRatio}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-synth-cyan">LP (locked forever)</span>
                <span className="text-synth-muted">{form.lpRatio}%</span>
              </div>
              <div className="w-full h-3 bg-synth-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-synth-cyan rounded-full"
                  style={{ width: `${form.lpRatio}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-synth-muted border-t border-synth-border pt-2">
          LP permanently locked • Fees: 10% Agent / 10% Platform / 80% back to LP
        </p>
      </div>

      {/* Twitter Verification */}
      <div className="card space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.twitterVerify}
            onChange={(e) => setForm({ ...form, twitterVerify: e.target.checked })}
            className="w-4 h-4 accent-[#00FF88] rounded"
            disabled={isLoading}
          />
          <div>
            <span className="text-sm text-synth-text">Verify via Twitter</span>
            <p className="text-[10px] text-synth-muted">Optional — link your Twitter for credibility</p>
          </div>
        </label>
      </div>

      {/* Submit (mock) */}
      <button
        type="button"
        disabled={isLoading || !form.name || !form.symbol}
        className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => alert('Fair Mint launch coming soon! Smart contract integration pending.')}
      >
        {isAgentOnly ? '🦞' : '⚡'} Launch {isAgentOnly ? 'Agent-Only' : 'Fair'} Mint
      </button>
    </div>
  );
}

function LaunchPageInner() {
  const { t } = useI18n();
  const { isConnected, address } = useAccount();
  const { launch, hash, isPending, isConfirming, isSuccess, error: txError, reset } = useLaunchToken();
  const fileRef = useRef<HTMLInputElement>(null);

  const [launchMode, setLaunchMode] = useState<LaunchMode>('curve');
  const [agentMode, setAgentMode] = useState<'moltbook' | 'twitter' | 'self'>('moltbook');
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
    if (!form.name.trim()) return setErrorMsg(t('launch.nameRequired'));
    if (!form.symbol.trim()) return setErrorMsg(t('launch.symbolRequired'));
    if (!form.image) return setErrorMsg(t('launch.imageRequired'));

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

      // Step 2: Mine vanity salt + send transaction
      setStep('mining-salt');
      await launch({
        metaCid,
        name: form.name,
        symbol: form.symbol,
        taxRate: form.taxRate,
        devBuyAmount: form.devBuyAmount,
        agentId: form.agentId,
        website: form.website,
        twitter: form.twitter,
        launchType: agentMode === 'self' ? 'client' : agentMode,
      });
    } catch (err) {
      setStep('error');
      setErrorMsg(err instanceof Error ? err.message : t('launch.unknownError'));
    }
  };

  // Track tx status
  const currentStep: LaunchStep =
    isSuccess ? 'success' :
    isConfirming ? 'confirming' :
    isPending ? 'sending-tx' :
    txError ? 'error' :
    step;

  const isLoading = ['uploading', 'mining-salt', 'sending-tx', 'confirming'].includes(currentStep);

  const stepLabels: Record<LaunchStep, string> = {
    'idle': '',
    'uploading': t('launch.uploading'),
    'mining-salt': t('launch.miningSalt'),
    'sending-tx': t('launch.sendingTx'),
    'confirming': t('launch.confirming'),
    'success': t('launch.successMsg'),
    'error': txError?.message || errorMsg || t('launch.txFailed'),
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
          {t('launch.title')}
        </h1>
        <p className="text-sm text-synth-muted">
          {t('launch.subtitle')}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider font-mono">
          Choose Launch Mode
        </h2>
        <LaunchModeSelector mode={launchMode} onModeChange={setLaunchMode} />
      </div>

      {/* Fair Mint or Agent-Only form */}
      {(launchMode === 'fairMint' || launchMode === 'agentOnly') && (
        <FairMintForm mode={launchMode} isLoading={false} />
      )}

      {/* Bonding Curve form (existing) */}
      {launchMode === 'curve' && (
        <>
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

          {/* SynthID Badge */}
          <div className="card border border-synth-cyan/30 bg-synth-cyan/5">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔑</span>
              <span className="text-xs text-synth-cyan font-mono">Requires SynthID — All launches verified on-chain</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Token Info */}
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
                {t('launch.tokenInfo')}
              </h2>

              {/* Image Upload */}
              <div className="space-y-1">
                <label className="text-sm text-synth-muted">{t('launch.tokenImage')} *</label>
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
                        <p className="text-xs text-synth-muted">{t('launch.clickToChange')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-synth-muted text-sm group-hover:text-synth-green transition-colors">
                        {t('launch.dropImage')}
                      </p>
                      <p className="text-[10px] text-synth-muted">PNG, JPG, GIF, SVG</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-synth-muted">{t('launch.tokenName')} *</label>
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
                  <label className="text-sm text-synth-muted">{t('launch.tokenSymbol')} *</label>
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
                <label className="text-sm text-synth-muted">{t('launch.tokenDescription')}</label>
                <textarea
                  placeholder={t('launch.descPlaceholder')}
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
                {t('launch.socialLinks')}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-synth-muted">{t('launch.website')}</label>
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
                  <label className="text-sm text-synth-muted">{t('launch.twitter')}</label>
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
                  <label className="text-sm text-synth-muted">{t('launch.telegram')}</label>
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
                {t('launch.aiAgentConfig')}
              </h2>

              <AgentSelector
                value={form.agentId}
                onChange={(agentId) => setForm({ ...form, agentId })}
                mode={agentMode}
                onModeChange={(mode) => {
                  setAgentMode(mode);
                  if (mode === 'self') {
                    setForm(prev => ({ ...prev, agentId: '' }));
                  }
                }}
              />

              <TaxRateSlider
                value={form.taxRate}
                onChange={(taxRate) => setForm({ ...form, taxRate })}
              />
            </div>

            {/* Dev Buy */}
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider">
                {t('launch.initialBuy')}
              </h2>
              <div className="space-y-1">
                <label className="text-sm text-synth-muted">{t('launch.devBuyAmount')}</label>
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
                  {t('launch.devBuyHint')}
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
                      {t('launch.processing')}
                    </>
                  ) : (
                    `🚀 ${t('launch.launchToken')}`
                  )}
                </button>
              ) : (
                <div className="w-full text-center space-y-3">
                  <p className="text-sm text-synth-muted">{t('launch.connectToLaunch')}</p>
                  <WalletConnect />
                </div>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
}


export default function LaunchPage() {
  return (
    <ErrorBoundary>
      <LaunchPageInner />
    </ErrorBoundary>
  );
}
