'use client';

import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { xlayer } from '@/lib/wagmi';
import { useState } from 'react';

const SUPPORTED_CHAINS = [bsc.id, xlayer.id] as const;

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  const [showMenu, setShowMenu] = useState(false);

  const wrongChain =
    isConnected && chain?.id !== undefined && !SUPPORTED_CHAINS.includes(chain.id as typeof SUPPORTED_CHAINS[number]);

  if (wrongChain) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => switchChain({ chainId: xlayer.id })}
          className="bg-synth-green/10 border border-synth-green text-synth-green px-3 py-2 rounded font-mono text-xs hover:bg-synth-green/20 transition-all duration-200"
        >
          Switch to X Layer
        </button>
        <button
          onClick={() => switchChain({ chainId: bsc.id })}
          className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-3 py-2 rounded font-mono text-xs hover:bg-yellow-500/20 transition-all duration-200"
        >
          Switch to BSC
        </button>
      </div>
    );
  }

  const nativeSymbol = chain?.id === xlayer.id ? 'OKB' : 'BNB';

  if (isConnected && address) {
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
            {address.slice(0, 6)}...{address.slice(-4)}
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
        <span className="hidden sm:inline">Connect Wallet</span>
        <span className="sm:hidden">Connect</span>
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-[#111111] border border-synth-border rounded p-1 min-w-[200px] shadow-xl">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => { connect({ connector }); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs font-mono text-synth-text hover:bg-synth-green/10 hover:text-synth-green rounded transition-colors"
              >
                {connector.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
