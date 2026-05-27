import type { Metadata } from 'next';
import { XCupFanFiPageContent } from '@/components/fanfi/XCupFanFiPageContent';

export const metadata: Metadata = {
  title: 'Synth SportFi Arena | X Cup Prediction Edition',
  description:
    'World Cup Season One product flow for AI-created prediction arenas, X Layer receipts, settlement, leaderboards, and OKX trading handoff.',
};

export default function XCupFanFiPage() {
  return <XCupFanFiPageContent />;
}
