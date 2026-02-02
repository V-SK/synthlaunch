export interface Token {
  address: string;
  name: string;
  symbol: string;
  meta: string;
  image: string;
  description: string;
  creator: string;
  agent_name: string;
  taxRate: number;
  price: number;
  priceUsd: number;
  marketCap: number;
  marketCapBnb: number;
  circulatingSupply: number;
  status: number;
  progress: number;
  createdAt: number;
  reserve: number;
}

export interface PlatformStats {
  totalTokens: number;
  totalReserveBnb: string;
  totalMarketCap: string;
  activeTokens: number;
  dexTokens: number;
}

export async function fetchTokens(sort: string = 'new'): Promise<Token[]> {
  try {
    const res = await fetch(`/api/tokens?sort=${sort}`, {
      next: { revalidate: 30 },
    } as any);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchTokenByAddress(address: string): Promise<Token | null> {
  try {
    const res = await fetch(`/api/tokens?address=${address}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchStats(): Promise<PlatformStats> {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Failed');
    return await res.json();
  } catch {
    return {
      totalTokens: 0,
      totalReserveBnb: '0',
      totalMarketCap: '$0',
      activeTokens: 0,
      dexTokens: 0,
    };
  }
}

export function formatPrice(priceUsd: number): string {
  if (priceUsd === 0) return '$0';
  if (priceUsd < 0.000001) return `$${priceUsd.toExponential(2)}`;
  if (priceUsd < 0.01) return `$${priceUsd.toFixed(6)}`;
  if (priceUsd < 1) return `$${priceUsd.toFixed(4)}`;
  return `$${priceUsd.toFixed(2)}`;
}

export function formatMarketCap(mcap: number): string {
  if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(1)}M`;
  if (mcap >= 1e3) return `$${(mcap / 1e3).toFixed(1)}K`;
  if (mcap > 0) return `$${mcap.toFixed(0)}`;
  return '$0';
}

export function formatTimeAgo(ts: number): string {
  if (!ts) return 'Unknown';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

export function statusLabel(status: number): string {
  switch (status) {
    case 0: return 'Invalid';
    case 1: return 'Bonding Curve';
    case 4: return 'On DEX';
    default: return 'Unknown';
  }
}
