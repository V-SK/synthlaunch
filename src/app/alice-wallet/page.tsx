'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ALICE_SYMBOL, fetchAliceBalance, formatAlice } from '@/lib/alice';
import { WalletConnect } from '@/components/WalletConnect';
import { useStaking } from '@/hooks/useStaking';
import { useI18n } from '@/lib/i18n';

// Server-side wallet generation (no polkadot WASM needed in browser)
async function generateAliceWallet(): Promise<{ mnemonic: string; address: string }> {
  const res = await fetch('/api/alice-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate' }),
  });
  if (!res.ok) throw new Error('wallet generation failed');
  return res.json();
}

async function aliceAddressFromMnemonic(mnemonic: string): Promise<string> {
  const res = await fetch('/api/alice-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'import', mnemonic }),
  });
  if (!res.ok) throw new Error('invalid mnemonic');
  const data = await res.json();
  return data.address;
}

export default function AliceWalletPage() {
  const { t } = useI18n();
  const { address: bscAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { stakedAmount } = useStaking('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Wallet state
  const [mnemonic, setMnemonic] = useState('');
  const [aliceAddress, setAliceAddress] = useState('');
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false); // default hidden
  const [generating, setGenerating] = useState(false);

  // Generate a 16-byte hex nonce for replay protection
  const generateNonce = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  // Import mode
  const [importMode, setImportMode] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState('');

  // Binding state
  const [binding, setBinding] = useState<string | null>(null);
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindingStatus, setBindingStatus] = useState('');

  // Generate new wallet
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const { mnemonic: m, address: a } = await generateAliceWallet();
      setMnemonic(m);
      setAliceAddress(a);
      setBalance(null);
      setBalanceError(false);
      setShowMnemonic(false); // user must explicitly reveal
      setImportMode(false);
      setImportInput('');
      setImportPreview('');
    } catch (e) {
      console.error('generateAliceWallet error:', e);
      alert(t('aliceWallet.walletGenFailed') + String(e));
    } finally {
      setGenerating(false);
    }
  }, []);

  // Import from mnemonic
  const handleImport = useCallback(async () => {
    setImportError('');
    try {
      const addr = await aliceAddressFromMnemonic(importInput);
      setAliceAddress(addr);
      setMnemonic(importInput.trim());
      setImportMode(false);
      setShowMnemonic(false);
    } catch {
      setImportError(t('aliceWallet.invalidMnemonic'));
    }
  }, [importInput]);

  // Fetch balance when address changes
  const fetchBalance = useCallback(() => {
    if (!aliceAddress) return;
    setBalanceLoading(true);
    setBalanceError(false);
    fetchAliceBalance(aliceAddress)
      .then(setBalance)
      .catch(() => { setBalance(null); setBalanceError(true); })
      .finally(() => setBalanceLoading(false));
  }, [aliceAddress]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Import mnemonic real-time preview (debounced)
  useEffect(() => {
    if (!importMode) return;
    const words = importInput.trim().split(/\s+/);
    if (words.length !== 12) { setImportPreview(''); return; }
    const timer = setTimeout(() => {
      aliceAddressFromMnemonic(importInput)
        .then(setImportPreview)
        .catch(() => setImportPreview(''));
    }, 500);
    return () => clearTimeout(timer);
  }, [importInput, importMode]);

  // Check existing binding
  useEffect(() => {
    if (!bscAddress) return;
    fetch(`/api/alice-binding?bsc=${bscAddress}`)
      .then((r) => r.json())
      .then((d) => setBinding(d.binding?.alice_address ?? null))
      .catch((e) => console.error('binding lookup failed:', e));
  }, [bscAddress]);

  // Sign & bind
  const handleBind = useCallback(async () => {
    if (!bscAddress || !aliceAddress) return;
    setBindingLoading(true);
    setBindingStatus('');
    try {
      // Add nonce to prevent replay attacks
      const nonce = generateNonce();
      const message = `Bind Alice address ${aliceAddress} to BSC address ${bscAddress.toLowerCase()}\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });
      const res = await fetch('/api/alice-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bscAddress, aliceAddress, signature, message, nonce }),
      });
      const data = await res.json();
      if (data.ok) {
        setBinding(aliceAddress);
        setBindingStatus('✅ ' + t('aliceWallet.bindSuccess'));
      } else {
        setBindingStatus('❌ ' + t('aliceWallet.bindFailed') + (data.error ?? 'unknown'));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('User rejected') || msg.includes('user denied') || msg.includes('User denied')) {
        setBindingStatus('❌ ' + t('aliceWallet.userRejected'));
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
        setBindingStatus('❌ ' + t('aliceWallet.networkError'));
      } else {
        setBindingStatus('❌ ' + msg);
      }
    } finally {
      setBindingLoading(false);
    }
  }, [bscAddress, aliceAddress, signMessageAsync]);

  return (
    <main className="min-h-screen bg-synth-dark text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-synth-green">⚡ {t('aliceWallet.title')}</h1>
          <p className="text-synth-muted text-sm">
            {t('aliceWallet.subtitle')}
          </p>
        </div>

        {/* Wallet Card */}
        <div className="card border border-synth-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">{t('aliceWallet.aliceAddress')}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (aliceAddress && !window.confirm(t('aliceWallet.confirmClear'))) return;
                  setImportMode(true); setMnemonic(''); setAliceAddress(''); setBalance(null); setBalanceError(false); setImportPreview('');
                }}
                className="text-xs text-synth-muted hover:text-white border border-synth-border rounded px-3 py-1 transition-colors"
              >
                {t('aliceWallet.importMnemonic')}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs bg-synth-green text-black font-semibold rounded px-3 py-1 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {generating ? t('aliceWallet.generating') : t('aliceWallet.generateWallet')}
              </button>
            </div>
          </div>

          {/* Import mode */}
          {importMode && (
            <div className="space-y-2">
              <textarea
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder={t('aliceWallet.importPlaceholder')}
                className="w-full bg-black/30 border border-synth-border rounded-lg p-3 text-sm font-mono resize-none h-20 focus:outline-none focus:border-synth-green"
              />
              {importPreview && (
                <div className="bg-black/30 border border-synth-border rounded-lg p-2">
                  <p className="text-synth-muted text-xs">{t('aliceWallet.previewAddress')}</p>
                  <p className="font-mono text-xs text-synth-green break-all">{importPreview}</p>
                </div>
              )}
              {importError && <p className="text-red-400 text-xs">{importError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="flex-1 bg-synth-green text-black font-semibold rounded-lg py-2 text-sm hover:opacity-90 transition-opacity"
                >
                  {t('aliceWallet.import')}
                </button>
                <button
                  onClick={() => { setImportMode(false); setImportError(''); }}
                  className="text-synth-muted text-sm px-4 hover:text-white transition-colors"
                >
                  {t('aliceWallet.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Address display */}
          {aliceAddress ? (
            <div className="space-y-3">
              <div className="bg-black/30 border border-synth-border rounded-lg p-3 space-y-1">
                <p className="text-synth-muted text-xs">{t('aliceWallet.addressSS58')}</p>
                <p className="font-mono text-sm break-all text-synth-green">{aliceAddress}</p>
              </div>

              {/* Balance */}
              <div className="bg-black/30 border border-synth-border rounded-lg p-3 flex items-center justify-between">
                <p className="text-synth-muted text-xs">{t('aliceWallet.balance')}</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">
                    {balanceLoading
                      ? t('aliceWallet.loadingBalance')
                      : balanceError
                      ? t('aliceWallet.balanceFailed')
                      : balance !== null
                      ? `${formatAlice(balance)} ${ALICE_SYMBOL}`
                      : '—'}
                  </p>
                  {balanceError && !balanceLoading && (
                    <button
                      onClick={fetchBalance}
                      className="text-xs text-synth-green hover:underline"
                    >
                      {t('aliceWallet.retry')}
                    </button>
                  )}
                </div>
              </div>

              {/* Mnemonic */}
              {mnemonic && (
                <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-yellow-400 text-xs font-semibold">⚠️ {t('aliceWallet.mnemonicWarning')}</p>
                    <button
                      onClick={() => setShowMnemonic((v) => !v)}
                      className="text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors"
                    >
                      {showMnemonic ? t('aliceWallet.hide') : t('aliceWallet.show')}
                    </button>
                  </div>
                  {showMnemonic && (
                    <>
                      <p className="font-mono text-sm text-yellow-200 break-all">{mnemonic}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(mnemonic)}
                        className="text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors"
                      >
                        {t('aliceWallet.copyMnemonic')}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Copy address */}
              <button
                onClick={() => navigator.clipboard.writeText(aliceAddress)}
                className="w-full text-xs text-synth-muted hover:text-white border border-synth-border rounded-lg py-2 transition-colors"
              >
                {t('aliceWallet.copyAddress')}
              </button>
            </div>
          ) : !importMode ? (
            <div className="text-center py-8 text-synth-muted text-sm">
              {t('aliceWallet.hintText')}
            </div>
          ) : null}
        </div>

        {/* Binding Card */}
        <div className="card border border-synth-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">{t('aliceWallet.bindTitle')}</h2>
          <p className="text-synth-muted text-sm">
            {t('aliceWallet.bindDescription')}
          </p>

          {!isConnected ? (
            <WalletConnect />
          ) : (
            <div className="space-y-3">
              {/* BSC address */}
              <div className="bg-black/30 border border-synth-border rounded-lg p-3 space-y-1">
                <p className="text-synth-muted text-xs">{t('aliceWallet.bscWallet')}</p>
                <p className="font-mono text-sm text-white truncate">{bscAddress}</p>
              </div>

              {/* Current binding */}
              {binding && (
                <div className="bg-green-900/20 border border-green-600/40 rounded-lg p-3 space-y-1">
                  <p className="text-green-400 text-xs font-semibold">✅ {t('aliceWallet.currentBinding')}</p>
                  <p className="font-mono text-xs text-green-300 break-all">{binding}</p>
                </div>
              )}

              {/* Bind button */}
              {aliceAddress ? (
                <div className="space-y-2">
                  <div className="bg-black/30 border border-synth-border rounded-lg p-3 space-y-1">
                    <p className="text-synth-muted text-xs">{t('aliceWallet.willBindTo')}</p>
                    <p className="font-mono text-xs text-synth-green break-all">{aliceAddress}</p>
                  </div>
                  {stakedAmount > 0n ? (
                    <button
                      onClick={handleBind}
                      disabled={bindingLoading}
                      className="w-full bg-synth-green text-black font-bold rounded-lg py-3 hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {bindingLoading ? t('aliceWallet.signing') : binding ? t('aliceWallet.updateBinding') : t('aliceWallet.signBind')}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400 text-center">
                      {t('aliceWallet.mustStakeFirst')}
                    </div>
                  )}
                  {bindingStatus && (
                    <p className="text-sm text-center">{bindingStatus}</p>
                  )}
                </div>
              ) : (
                <p className="text-synth-muted text-sm text-center py-2">
                  {t('aliceWallet.generateFirst')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="text-center text-synth-muted text-xs space-y-1">
          <p>{t('aliceWallet.infoText')}</p>
          <a
            href="https://aliceprotocol.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-synth-green hover:underline"
          >
            {t('aliceWallet.learnMore')}
          </a>
        </div>
      </div>
    </main>
  );
}
