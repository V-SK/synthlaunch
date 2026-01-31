'use client';

import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { useState } from 'react';

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  const [showMenu, setShowMenu] = useState(false);

  const wrongChain = isConnected && chain?.id !== bsc.id;

  if (wrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: bsc.id })}
        className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-2 rounded font-mono text-xs hover:bg-red-500/20 transition-all duration-200"
      >
        Switch to BSC
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="btn-primary text-xs flex items-center gap-2"
        >
          <span>
            {balance ? `${Number(balance.formatted).toFixed(3)} BNB` : '...'}
          </span>
          <span className="border-l border-synth-green/30 pl-2">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 z-50 bg-synth-surface border border-synth-border rounded p-1 min-w-[160px]">
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
        className="btn-primary text-xs"
      >
        Connect Wallet
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-synth-surface border border-synth-border rounded p-1 min-w-[200px]">
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
