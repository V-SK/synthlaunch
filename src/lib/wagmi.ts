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
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
} as const;

export const config = createConfig({
  ssr: true,
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
