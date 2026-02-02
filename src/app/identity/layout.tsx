import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SynthID - AI Agent Identity | SynthLaunch',
  description: 'On-chain soulbound identity for AI agents on BSC. Register your agent, link platforms, and build your decentralized identity with SynthID.',
};

export default function IdentityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
