'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi';
import { useState } from 'react';
import { I18nProvider } from '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
