'use client';

import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { xlayer } from '@/lib/wagmi';
import { useEffect, useState } from 'react';

const SUPPORTED_CHAINS = [bsc.id, xlayer.id] as const;

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [isMounted, setIsMounted] = useState(false);
  const safeAddress = isMounted ? address : undefined;
  const safeIsConnected = isMounted ? isConnected : false;
  const safeChain = isMounted ? chain : undefined;
  const { data: balance } = useBalance({
    address: safeAddress,
    query: { enabled: Boolean(safeAddress) },
  });
  const [showMenu, setShowMenu] = useState(false);
  const [walletError, setWalletError] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getWalletErrorMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '');
    if (/proposal expired/i.test(message)) {
      return 'WalletConnect request expired. Try Connect Wallet again, or choose the browser wallet option.';
    }
    if (/user rejected|user denied|rejected/i.test(message)) {
      return 'Wallet request was rejected.';
    }
    return message || 'Wallet connection failed.';
  };

  const handleSwitchChain = async (chainId: typeof SUPPORTED_CHAINS[number]) => {
    setWalletError('');
    try {
      await switchChainAsync({ chainId });
    } catch (error) {
      setWalletError(getWalletErrorMessage(error));
    }
  };

  const handleConnect = async (connector: (typeof connectors)[number]) => {
    setWalletError('');
    try {
      await connectAsync({ connector });
      setShowMenu(false);
    } catch (error) {
      setWalletError(getWalletErrorMessage(error));
    }
  };

  const wrongChain =
    safeIsConnected && safeChain?.id !== undefined && !SUPPORTED_CHAINS.includes(safeChain.id as typeof SUPPORTED_CHAINS[number]);

  if (!isMounted) {
    return (
      <div className="relative">
        <button
          type="button"
          disabled
          className="btn-primary text-[10px] md:text-xs px-2 md:px-4 py-1.5 md:py-2 whitespace-nowrap opacity-70"
        >
          <span className="hidden sm:inline">Connect Wallet</span>
          <span className="sm:hidden">Connect</span>
        </button>
      </div>
    );
  }

  if (wrongChain) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleSwitchChain(xlayer.id)}
          disabled={isSwitching}
          className="bg-synth-green/10 border border-synth-green text-synth-green px-3 py-2 rounded font-mono text-xs hover:bg-synth-green/20 transition-all duration-200"
        >
          Switch to X Layer
        </button>
        <button
          onClick={() => handleSwitchChain(bsc.id)}
          disabled={isSwitching}
          className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-3 py-2 rounded font-mono text-xs hover:bg-yellow-500/20 transition-all duration-200"
        >
          Switch to BSC
        </button>
      </div>
    );
  }

  const nativeSymbol = safeChain?.id === xlayer.id ? 'OKB' : 'BNB';

  if (safeIsConnected && safeAddress) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="btn-primary text-xs flex items-center gap-2"
        >
          <span>
            {balance ? `${Number(balance.formatted).toFixed(3)} ${nativeSymbol}` : '...'}
          </span>
          <span className="border-l border-synth-green/30 pl-2">
            {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
          </span>
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 z-50 bg-[#111111] border border-synth-border rounded p-1 min-w-[160px] shadow-xl">
              <button
                onClick={() => { disconnect(); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs font-mono text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="btn-primary text-[10px] md:text-xs px-2 md:px-4 py-1.5 md:py-2 whitespace-nowrap"
      >
        <span className="hidden sm:inline">{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
        <span className="sm:hidden">{isConnecting ? '...' : 'Connect'}</span>
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-[#111111] border border-synth-border rounded p-1 min-w-[200px] shadow-xl">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => handleConnect(connector)}
                disabled={isConnecting}
                className="w-full text-left px-3 py-2 text-xs font-mono text-synth-text hover:bg-synth-green/10 hover:text-synth-green rounded transition-colors"
              >
                {connector.name}
              </button>
            ))}
            {walletError && (
              <div className="mt-1 border-t border-synth-border px-3 py-2 text-[10px] leading-relaxed text-yellow-400">
                {walletError}
              </div>
            )}
          </div>
        </>
      )}
      {!showMenu && walletError && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[10px] leading-relaxed text-yellow-300 shadow-xl">
          {walletError}
        </div>
      )}
    </div>
  );
}
