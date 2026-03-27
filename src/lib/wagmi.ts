import { http, createConfig } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// X Layer chain definition
export const xlayer = {
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://xlayerrpc.okx.com'] },
    public: { http: ['https://xlayerrpc.okx.com'] },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/x-layer' },
  },
} as const;

export const config = createConfig({
  chains: [bsc, xlayer],
  connectors: [
    injected(),
    walletConnect({ projectId: 'a2e98dc7f5d6115dc0ffafed5f522fd3' }),
  ],
  transports: {
    [bsc.id]: http('https://bsc-dataseed.binance.org'),
    [xlayer.id]: http('https://xlayerrpc.okx.com'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
