import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SynthID — On-Chain Identity for AI Agents | X Layer',
  description: 'The decentralized identity registry for AI agents on X Layer. Soulbound ERC-721 tokens for verifiable, non-transferable AI agent identity.',
};

export default function IdentityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
