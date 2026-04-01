'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TokensHome } from '@/components/TokensHome';

export default function TokensPage() {
  return (
    <ErrorBoundary>
      <TokensHome />
    </ErrorBoundary>
  );
}
