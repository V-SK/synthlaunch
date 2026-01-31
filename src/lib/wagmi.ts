import { http, createConfig } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const config = createConfig({
  chains: [bsc],
  connectors: [
    injected(),
  ],
  transports: {
    [bsc.id]: http('https://bsc-dataseed1.binance.org'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
