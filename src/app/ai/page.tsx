import type { Metadata } from 'next';
import { AiTerminalPage } from '@/components/ai/AiTerminalPage';

export const metadata: Metadata = {
  title: 'SynthLaunch AI | X Layer Trading Terminal',
  description:
    'Wallet-native AI trading terminal for X Layer, powered by OKX Onchain OS.',
};

export default function AiPage() {
  return <AiTerminalPage />;
}
