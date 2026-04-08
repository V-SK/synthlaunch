'use client';

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TaxRateSlider } from '@/components/TaxRateSlider';
import { AgentSelector } from '@/components/AgentSelector';
import { WalletConnect } from '@/components/WalletConnect';
import { useAccount, useSwitchChain } from 'wagmi';
import { useLaunchToken } from '@/hooks/useFlap';
import { useCreateFairMint } from '@/hooks/useFairMint';
import { useHasSynthID } from '@/hooks/useSynthID';
import { uploadToFlap } from '@/lib/ipfs';
import { useI18n } from '@/lib/i18n';
import { CHAIN_CONFIG } from '@/lib/contracts';

type LaunchStep = 'idle' | 'uploading' | 'mining-salt' | 'sending-tx' | 'confirming' | 'success' | 'error';
type LaunchMode = 'curve' | 'fairMint' | 'agentOnly';

function LaunchModeSelector({ mode, onModeChange, hasSynthID }: { mode: LaunchMode; onModeChange: (m: LaunchMode) => void; hasSynthID: boolean }) {
  const modes: { key: LaunchMode; icon: string; label: string; desc: string; requiresSynthID?: boolean }[] = [
    { key: 'curve', icon: '🔄', label: 'Bonding Curve', desc: 'Classic bonding curve with auto-DEX migration' },
    { key: 'fairMint', icon: '⚡', label: 'Fair Mint', desc: 'Fixed price, equal access, LP auto-locked' },
    { key: 'agentOnly', icon: '🦞', label: 'Agent-Only Mint', desc: 'Fair Mint gated by SynthID verification', requiresSynthID: true },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {modes.map((m) => {
        const isDisabled = m.requiresSynthID && !hasSynthID;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => !isDisabled && onModeChange(m.key)}
            disabled={isDisabled}
            className={`card text-left transition-all duration-200 border-2 ${
              isDisabled
                ? 'border-transparent opacity-50 cursor-not-allowed'
                : mode === m.key
                  ? 'border-synth-green bg-synth-green/5'
                  : 'border-transparent hover:border-synth-border'
            }`}
          >
            <div className="text-2xl mb-2">{m.icon}</div>
            <h3 className={`text-sm font-bold mb-1 ${mode === m.key && !isDisabled ? 'text-synth-green' : 'text-synth-text'}`}>
              {m.label}
            </h3>
            <p className="text-[10px] text-synth-muted leading-relaxed">{m.desc}</p>
            {isDisabled && (
              <div className="mt-2 text-[10px] text-red-400 font-mono">🔒 Requires SynthID</div>
            )}
            {mode === m.key && !isDisabled && (
              <div className="mt-2 text-[10px] text-synth-green font-mono">● Selected</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function FairMintForm({ mode }: { mode: 'fairMint' | 'agentOnly' }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { create, isPending, hash, tokenAddress, error: createError, reset } = useCreateFairMint();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bnbPrice, setBnbPrice] = useState<number | null>(null); // null until client loads
  const [isClient, setIsClient] = useState(false);

  // Mark as client-side after hydration
  useEffect(() => {
    setIsClient(true);
    // Fetch real-time BNB price
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd')
      .then(res => res.json())
      .then(data => {
        if (data?.binancecoin?.usd) {
          setBnbPrice(data.binancecoin.usd);
        } else {
          setBnbPrice(650); // fallback
        }
      })
      .catch(() => setBnbPrice(650)); // fallback
  }, []);

  const [form, setForm] = useState({
    name: '',
    symbol: '',
    image: null as File | null,
    imagePreview: '',
    totalSupply: '1000000',
    targetMcap: 50000, // target market cap in USD (contract limit: ~$15k-$85k)
    perWalletLimit: '1000',
    mintDuration: '72h',
    lpRatio: 20,
    twitterVerify: false,
  });

  // Auto-calculate mint price from target mcap and total supply (memoized to avoid re-render loops)
  const calculatedMintPrice = useMemo(() => {
    if (!bnbPrice || !form.totalSupply || !form.targetMcap) {
      return '---'; // placeholder until price loaded
    }
    const supply = parseFloat(form.totalSupply);
    if (supply > 0 && bnbPrice > 0) {
      const price = form.targetMcap / supply / bnbPrice;
      // Always use fixed decimal notation (viem parseEther doesn't accept scientific notation)
      // Use toFixed(18) for max precision, then trim trailing zeros
      return price.toFixed(18).replace(/\.?0+$/, '');
    }
    return '---';
  }, [form.totalSupply, form.targetMcap, bnbPrice]);

  // Convert duration string to seconds
  const getDurationSeconds = (duration: string): number => {
    const map: Record<string, number> = {
      '24h': 24 * 3600,
      '48h': 48 * 3600,
      '72h': 72 * 3600,
      '7d': 7 * 24 * 3600,
    };
    return map[duration] || 72 * 3600;
  };

  const handleSubmit = async () => {
    if (!address || !form.name || !form.symbol) return;
    
    const newTokenAddr = await create({
      name: form.name,
      symbol: form.symbol.toUpperCase(),
      totalSupply: parseInt(form.totalSupply),
      mintPrice: calculatedMintPrice,
      perWalletLimit: parseInt(form.perWalletLimit),
      lpRatioBps: form.lpRatio * 100, // convert 20 to 2000
      duration: getDurationSeconds(form.mintDuration),
      beneficiary: address,
      agentOnly: mode === 'agentOnly',
    });

    if (newTokenAddr) {
      // Redirect to the new token page after a short delay
      setTimeout(() => {
        router.push(`/token/fair/${newTokenAddr}`);
      }, 2000);
    }
  };

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
      {/* Agent-Only Note - only show for agentOnly mode */}
      {isAgentOnly && (
        <div className="card border border-synth-cyan/30 bg-synth-cyan/5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🦞</span>
            <div>
              <span className="text-sm text-synth-cyan font-bold">Agent-Only Mint</span>
              <p className="text-xs text-synth-muted mt-0.5">🔑 Requires SynthID — Only verified AI agents can mint this token</p>
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
              disabled={isPending}
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
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {/* Fair Mint Config */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-green uppercase tracking-wider">
          ⚡ Fair Mint Settings
        </h2>

        {/* Target Market Cap Selector */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-synth-muted">Target Market Cap</label>
            <span className="text-sm font-mono text-synth-green">${form.targetMcap.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[20000, 40000, 60000, 80000].map((mcap) => (
              <button
                key={mcap}
                type="button"
                onClick={() => setForm({ ...form, targetMcap: mcap })}
                className={`py-2 px-3 rounded text-xs font-mono transition-all ${
                  form.targetMcap === mcap
                    ? 'bg-synth-green/20 border border-synth-green text-synth-green'
                    : 'bg-synth-surface border border-synth-border text-synth-muted hover:border-synth-green/50'
                }`}
                disabled={isPending}
              >
                ${(mcap / 1000)}k
              </button>
            ))}
          </div>
          <input
            type="range"
            min={15000}
            max={85000}
            step={5000}
            value={form.targetMcap}
            onChange={(e) => setForm({ ...form, targetMcap: Number(e.target.value) })}
            className="w-full accent-[#00FF88] h-1.5 bg-synth-surface rounded-full appearance-none cursor-pointer"
            disabled={isPending}
          />
          <div className="flex justify-between text-[10px] text-synth-muted">
            <span>$15k</span>
            <span>$85k</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Total Supply</label>
            <input
              type="number"
              value={form.totalSupply}
              onChange={(e) => setForm({ ...form, totalSupply: e.target.value })}
              className="input-field w-full"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Mint Price (BNB) <span className="text-synth-cyan text-[10px]">auto</span></label>
            <input
              type="text"
              value={calculatedMintPrice}
              className="input-field w-full bg-synth-bg/50 text-synth-cyan"
              readOnly
            />
          </div>
        </div>

        {/* Estimated FDV Confirmation */}
        <div className="flex items-center justify-between px-3 py-2 bg-synth-green/5 border border-synth-green/20 rounded">
          <span className="text-sm text-synth-muted">Estimated FDV</span>
          <span className="text-sm font-mono text-synth-green">
            {calculatedMintPrice === '---' ? '...' : `${(parseFloat(form.totalSupply) * parseFloat(calculatedMintPrice)).toFixed(2)} BNB`}
            <span className="text-synth-muted ml-1">
              (~${form.targetMcap.toLocaleString()})
            </span>
          </span>
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
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-synth-muted">Mint Duration</label>
            <select
              value={form.mintDuration}
              onChange={(e) => setForm({ ...form, mintDuration: e.target.value })}
              className="input-field w-full"
              disabled={isPending}
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
            disabled={isPending}
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
          LP permanently locked • Finalize fees: 10% Agent / 10% Platform / 80% back to LP
        </p>
        <p className="text-[10px] text-synth-cyan">
          💡 2.5% platform fee collected during mint (total platform: ~12.25%)
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
            disabled={isPending}
          />
          <div>
            <span className="text-sm text-synth-text">Verify via Twitter</span>
            <p className="text-[10px] text-synth-muted">Optional — link your Twitter for credibility</p>
          </div>
        </label>
      </div>

      {/* Submit */}
      {!isConnected ? (
        <div className="text-center">
          <p className="text-sm text-synth-muted mb-3">Connect wallet to launch</p>
          <WalletConnect />
        </div>
      ) : tokenAddress ? (
        <div className="card border border-synth-green/30 bg-synth-green/5 text-center space-y-3">
          <span className="text-3xl">🎉</span>
          <p className="text-synth-green font-bold">Fair Mint Created!</p>
          <p className="text-xs text-synth-muted font-mono break-all">{tokenAddress}</p>
          <a 
            href={`/token/fair/${tokenAddress}`}
            className="btn-primary inline-block"
          >
            View Token →
          </a>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={isPending || !form.name || !form.symbol}
            className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
          >
            {isPending ? (
              <>
                <span className="animate-spin">⏳</span>
                Creating...
              </>
            ) : (
              <>
                {isAgentOnly ? '🦞' : '⚡'} Launch {isAgentOnly ? 'Agent-Only' : 'Fair'} Mint (0.02 BNB)
              </>
            )}
          </button>
          {createError && (
            <p className="text-red-400 text-xs text-center mt-2">{createError}</p>
          )}
          {hash && !tokenAddress && (
            <p className="text-synth-cyan text-xs text-center mt-2">
              Tx submitted: <a href={`${CHAIN_CONFIG[chainId].explorer}/tx/${hash}`} target="_blank" className="underline">{hash.slice(0, 10)}...</a>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function LaunchPageInner() {
  const { t } = useI18n();
  const { isConnected, address, chain: walletChain } = useAccount();
  const { switchChain } = useSwitchChain();
  const searchParams = useSearchParams();
  // Default to the wallet's currently connected chain if it's one we support;
  // otherwise default to X Layer (the primary submission chain for the
  // hackathon), not BSC. This prevents a wallet-on-X-Layer user from
  // accidentally submitting a transaction to BSC because the page picker
  // silently reset to 56.
  const [chainId, setChainId] = useState<56 | 196>(() => {
    if (walletChain?.id === 196) return 196;
    if (walletChain?.id === 56) return 56;
    return 196;
  });
  const { launch, hash, isPending, isConfirming, isSuccess, error: txError, reset } = useLaunchToken(chainId);
  const { hasSynthID } = useHasSynthID(address);
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

  useEffect(() => {
    const raw = searchParams.get('chainId');
    const parsed = Number(raw);
    if (parsed === 56 || parsed === 196) {
      setChainId(parsed);
    }
  }, [searchParams]);

  // Keep the form chain in sync with the wallet chain when the user switches
  // networks in their wallet. Without this, it's way too easy to have the
  // wallet on X Layer while the form picker silently says BSC.
  useEffect(() => {
    if (walletChain?.id === 196 || walletChain?.id === 56) {
      setChainId(walletChain.id as 56 | 196);
    }
  }, [walletChain?.id]);

  const walletChainMismatch =
    isConnected &&
    walletChain?.id !== undefined &&
    walletChain.id !== chainId;

  const chainOptions = useMemo(
    () => ({
      56: { id: 56 as const, label: 'BSC', badge: t('home.liveOnBsc'), nativeSymbol: CHAIN_CONFIG[56].nativeSymbol },
      196: { id: 196 as const, label: 'X Layer', badge: t('home.liveOnXLayer'), nativeSymbol: CHAIN_CONFIG[196].nativeSymbol },
    }),
    [t]
  );

  const activeChain = chainOptions[chainId] ?? chainOptions[56];

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
        chainId,
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
        {/* Chain Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-synth-muted uppercase tracking-wider">Target chain:</span>
            {([196, 56] as const).map((cid) => (
              <button
                key={cid}
                onClick={() => {
                  setChainId(cid);
                  if (isConnected && walletChain?.id !== cid) {
                    try {
                      switchChain({ chainId: cid });
                    } catch {
                      /* user can switch manually in wallet */
                    }
                  }
                }}
                className={`text-sm px-4 py-2 border-2 rounded font-mono transition-colors ${
                  chainId === cid
                    ? 'bg-synth-green/20 text-synth-green border-synth-green'
                    : 'bg-transparent text-synth-muted border-synth-border/60 hover:border-synth-green/50 hover:text-synth-text'
                }`}
              >
                ● {chainOptions[cid].label}
              </button>
            ))}
          </div>
          {walletChainMismatch && (
            <div className="border border-red-500/60 bg-red-500/10 text-red-400 text-xs font-mono px-3 py-2 rounded">
              ⚠ Wallet is on chain {walletChain?.id} but you selected {activeChain.label} ({chainId}).{' '}
              <button
                className="underline hover:text-red-300"
                onClick={() => switchChain({ chainId })}
              >
                Switch wallet to {activeChain.label}
              </button>{' '}
              before submitting, or the transaction will be sent to the wrong network.
            </div>
          )}
        </div>
        <p className="text-sm text-synth-muted">
          {chainId === 196 ? t('launch.subtitleXLayer') : t('launch.subtitle')}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-synth-cyan uppercase tracking-wider font-mono">
          Choose Launch Mode
        </h2>
        <LaunchModeSelector mode={launchMode} onModeChange={setLaunchMode} hasSynthID={hasSynthID} />
      </div>

      {/* Fair Mint or Agent-Only form */}
      {(launchMode === 'fairMint' || launchMode === 'agentOnly') && (
        <FairMintForm key={launchMode} mode={launchMode} />
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
                      href={`${CHAIN_CONFIG[chainId].explorer}/tx/${hash}`}
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
                  disabled={isLoading || walletChainMismatch}
                  className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {walletChainMismatch ? (
                    `⚠ Switch wallet to ${activeChain.label} first`
                  ) : isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-synth-green border-t-transparent rounded-full animate-spin" />
                      {t('launch.processing')}
                    </>
                  ) : (
                    `🚀 ${t('launch.launchToken')} on ${activeChain.label}`
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
      <Suspense fallback={<div className="text-center py-12 text-synth-muted font-mono">Loading...</div>}>
        <LaunchPageInner />
      </Suspense>
    </ErrorBoundary>
  );
}
