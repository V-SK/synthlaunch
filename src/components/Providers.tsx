'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi';
import { useEffect, useState } from 'react';
import { I18nProvider } from '@/lib/i18n';

function isRecoverableWalletError(value: unknown): boolean {
  const message = value instanceof Error ? value.message : String(value || '');
  return /proposal expired|user rejected|user denied|modal closed|connection request reset/i.test(message);
}

function WalletRuntimeErrorGuard() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isRecoverableWalletError(event.reason)) return;
      event.preventDefault();
      console.warn('[wallet] recoverable connection error:', event.reason);
    };

    const handleError = (event: ErrorEvent) => {
      if (!isRecoverableWalletError(event.error || event.message)) return;
      event.preventDefault();
      console.warn('[wallet] recoverable runtime error:', event.error || event.message);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <WalletRuntimeErrorGuard />
          {children}
        </I18nProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
