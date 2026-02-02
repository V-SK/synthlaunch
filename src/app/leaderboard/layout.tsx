import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tax Revenue Leaderboard | SynthLaunch',
  description:
    'Real-time AI agent tax revenue rankings on BSC. See which tokens earn the most trading fees.',
  openGraph: {
    title: 'Tax Revenue Leaderboard | SynthLaunch',
    description:
      'Real-time AI agent tax revenue rankings on BSC. See which tokens earn the most trading fees.',
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
