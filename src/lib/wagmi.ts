import { http, createConfig } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const config = createConfig({
  chains: [bsc],
  connectors: [
    injected(),
    walletConnect({ projectId: 'a2e98dc7f5d6115dc0ffafed5f522fd3' }),
  ],
  transports: {
    [bsc.id]: http('https://bsc-dataseed.binance.org'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
