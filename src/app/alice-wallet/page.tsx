'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ALICE_SYMBOL, fetchAliceBalance, formatAlice } from '@/lib/alice';
import { WalletConnect } from '@/components/WalletConnect';

// Dynamically import polkadot to avoid SSR issues
async function generateAliceWallet() {
  const { Keyring } = await import('@polkadot/keyring');
  const { mnemonicGenerate, cryptoWaitReady } = await import('@polkadot/util-crypto');
  await cryptoWaitReady();
  const mnemonic = mnemonicGenerate(12);
  const keyring = new Keyring({ type: 'sr25519', ss58Format: 300 });
  const pair = keyring.addFromMnemonic(mnemonic);
  return { mnemonic, address: pair.address };
}

async function aliceAddressFromMnemonic(mnemonic: string): Promise<string> {
  const { Keyring } = await import('@polkadot/keyring');
  const { cryptoWaitReady } = await import('@polkadot/util-crypto');
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519', ss58Format: 300 });
  const pair = keyring.addFromMnemonic(mnemonic.trim());
  return pair.address;
}

export default function AliceWalletPage() {
  const { address: bscAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Wallet state
  const [mnemonic, setMnemonic] = useState('');
  const [aliceAddress, setAliceAddress] = useState('');
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  // Import mode
  const [importMode, setImportMode] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState('');

  // Binding state
  const [binding, setBinding] = useState<string | null>(null);
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindingStatus, setBindingStatus] = useState('');

  // Generate new wallet
  const handleGenerate = useCallback(async () => {
    const { mnemonic: m, address: a } = await generateAliceWallet();
    setMnemonic(m);
    setAliceAddress(a);
    setBalance(null);
    setShowMnemonic(true);
    setImportMode(false);
    setImportInput('');
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
      setImportError('助记词无效，请检查后重试');
    }
  }, [importInput]);

  // Fetch balance when address changes
  useEffect(() => {
    if (!aliceAddress) return;
    setBalanceLoading(true);
    fetchAliceBalance(aliceAddress)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [aliceAddress]);

  // Check existing binding
  useEffect(() => {
    if (!bscAddress) return;
    fetch(`/api/alice-binding?bsc=${bscAddress}`)
      .then((r) => r.json())
      .then((d) => setBinding(d.binding?.aliceAddress ?? null))
      .catch(() => {});
  }, [bscAddress]);

  // Sign & bind
  const handleBind = useCallback(async () => {
    if (!bscAddress || !aliceAddress) return;
    setBindingLoading(true);
    setBindingStatus('');
    try {
      const message = `Bind Alice address ${aliceAddress} to BSC address ${bscAddress}`;
      const signature = await signMessageAsync({ message });
      const res = await fetch('/api/alice-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bscAddress, aliceAddress, signature, message }),
      });
      const data = await res.json();
      if (data.ok) {
        setBinding(aliceAddress);
        setBindingStatus('✅ 绑定成功！ALICE 奖励将发送到此地址。');
      } else {
        setBindingStatus('❌ 绑定失败：' + (data.error ?? '未知错误'));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setBindingStatus('❌ ' + msg);
    } finally {
      setBindingLoading(false);
    }
  }, [bscAddress, aliceAddress, signMessageAsync]);

  return (
    <main className="min-h-screen bg-synth-dark text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-synth-green">⚡ Alice Wallet</h1>
          <p className="text-synth-muted text-sm">
            生成 Alice 公链地址，接收 SYNTH 质押奖励
          </p>
        </div>

        {/* Wallet Card */}
        <div className="card border border-synth-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Alice 地址</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setImportMode(true); setMnemonic(''); setAliceAddress(''); setBalance(null); }}
                className="text-xs text-synth-muted hover:text-white border border-synth-border rounded px-3 py-1 transition-colors"
              >
                导入助记词
              </button>
              <button
                onClick={handleGenerate}
                className="text-xs bg-synth-green text-black font-semibold rounded px-3 py-1 hover:opacity-90 transition-opacity"
              >
                生成新钱包
              </button>
            </div>
          </div>

          {/* Import mode */}
          {importMode && (
            <div className="space-y-2">
              <textarea
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder="输入 12 个助记词，空格分隔..."
                className="w-full bg-black/30 border border-synth-border rounded-lg p-3 text-sm font-mono resize-none h-20 focus:outline-none focus:border-synth-green"
              />
              {importError && <p className="text-red-400 text-xs">{importError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="flex-1 bg-synth-green text-black font-semibold rounded-lg py-2 text-sm hover:opacity-90 transition-opacity"
                >
                  导入
                </button>
                <button
                  onClick={() => { setImportMode(false); setImportError(''); }}
                  className="text-synth-muted text-sm px-4 hover:text-white transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Address display */}
          {aliceAddress ? (
            <div className="space-y-3">
              <div className="bg-black/30 border border-synth-border rounded-lg p-3 space-y-1">
                <p className="text-synth-muted text-xs">Alice 地址（SS58）</p>
                <p className="font-mono text-sm break-all text-synth-green">{aliceAddress}</p>
              </div>

              {/* Balance */}
              <div className="bg-black/30 border border-synth-border rounded-lg p-3 flex items-center justify-between">
                <p className="text-synth-muted text-xs">余额</p>
                <p className="font-semibold text-white">
                  {balanceLoading
                    ? '查询中...'
                    : balance !== null
                    ? `${formatAlice(balance)} ${ALICE_SYMBOL}`
                    : '—'}
                </p>
              </div>

              {/* Mnemonic */}
              {mnemonic && (
                <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-yellow-400 text-xs font-semibold">⚠️ 助记词（保存后请勿泄露）</p>
                    <button
                      onClick={() => setShowMnemonic((v) => !v)}
                      className="text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors"
                    >
                      {showMnemonic ? '隐藏' : '显示'}
                    </button>
                  </div>
                  {showMnemonic && (
                    <>
                      <p className="font-mono text-sm text-yellow-200 break-all">{mnemonic}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(mnemonic)}
                        className="text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors"
                      >
                        复制助记词
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
                复制地址
              </button>
            </div>
          ) : !importMode ? (
            <div className="text-center py-8 text-synth-muted text-sm">
              点击「生成新钱包」创建 Alice 地址，或导入已有助记词
            </div>
          ) : null}
        </div>

        {/* Binding Card */}
        <div className="card border border-synth-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">绑定 SYNTH 质押钱包</h2>
          <p className="text-synth-muted text-sm">
            将你的 BSC 质押钱包与 Alice 地址绑定，SYNTH 质押奖励将发送到绑定的 Alice 地址。
          </p>

          {!isConnected ? (
            <WalletConnect />
          ) : (
            <div className="space-y-3">
              {/* BSC address */}
              <div className="bg-black/30 border border-synth-border rounded-lg p-3 space-y-1">
                <p className="text-synth-muted text-xs">BSC 钱包</p>
                <p className="font-mono text-sm text-white truncate">{bscAddress}</p>
              </div>

              {/* Current binding */}
              {binding && (
                <div className="bg-green-900/20 border border-green-600/40 rounded-lg p-3 space-y-1">
                  <p className="text-green-400 text-xs font-semibold">✅ 当前绑定</p>
                  <p className="font-mono text-xs text-green-300 break-all">{binding}</p>
                </div>
              )}

              {/* Bind button */}
              {aliceAddress ? (
                <div className="space-y-2">
                  <div className="bg-black/30 border border-synth-border rounded-lg p-3 space-y-1">
                    <p className="text-synth-muted text-xs">将绑定到</p>
                    <p className="font-mono text-xs text-synth-green break-all">{aliceAddress}</p>
                  </div>
                  <button
                    onClick={handleBind}
                    disabled={bindingLoading}
                    className="w-full bg-synth-green text-black font-bold rounded-lg py-3 hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {bindingLoading ? '签名中...' : binding ? '更新绑定' : '签名绑定'}
                  </button>
                  {bindingStatus && (
                    <p className="text-sm text-center">{bindingStatus}</p>
                  )}
                </div>
              ) : (
                <p className="text-synth-muted text-sm text-center py-2">
                  请先生成或导入 Alice 地址
                </p>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="text-center text-synth-muted text-xs space-y-1">
          <p>Alice 是去中心化 AI 训练公链，代币 ALICE 通过挖矿 100% 公平分配</p>
          <a
            href="https://aliceprotocol.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-synth-green hover:underline"
          >
            了解更多 →
          </a>
        </div>
      </div>
    </main>
  );
}
