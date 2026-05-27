import type { Metadata } from 'next';
import { XCupAuditPageContent } from '@/components/fanfi/XCupAuditPageContent';

export const metadata: Metadata = {
  title: 'SportFi Arena Final Checklist | X Cup',
  description:
    'Final readiness checklist for Synth SportFi Arena, X Layer proofs, settlement, ranking, and OKX trading handoff.',
};

export default function XCupAuditPage() {
  return <XCupAuditPageContent />;
}
