'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { STAKING_ABI, STAKING_CHAIN_ID, STAKING_CONTRACT_ADDRESS } from '@/lib/staking';

const CACHE_KEY = 'synth_stakers_v2';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const TOP_N = 100;

export interface LeaderboardEntry {
  rank: number;
  address: Address;
  stakedAmount: bigint;
  multiplier: number;
  daysStaked: number;
  score: number;
}

interface CachedAddresses {
  addresses: string[];
  timestamp: number;
}

async function fetchStakerAddresses(): Promise<Address[]> {
  // Check cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: CachedAddresses = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.addresses as Address[];
      }
    }
  } catch {
    // ignore
  }

  // Fetch via our own API route (Moralis key stays server-side)
  const res = await fetch('/api/staking/addresses');
  if (!res.ok) throw new Error(`Failed to fetch staker addresses: ${res.status}`);
  const data = await res.json();
  const addresses = (data.addresses ?? []) as Address[];

  // Cache
  try {
    const toCache: CachedAddresses = { addresses, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
  } catch {
    // ignore
  }

  return addresses;
}

export function useLeaderboard() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingAddresses(true);
    setError(null);
    fetchStakerAddresses()
      .then((addrs) => {
        if (!cancelled) {
          setAddresses(addrs);
          setLastUpdated(new Date());
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAddresses(false);
      });
    return () => { cancelled = true; };
  }, [refreshTick]);

  // Multicall getStakeInfo for all addresses
  const contracts = useMemo(
    () =>
      STAKING_CONTRACT_ADDRESS
        ? addresses.map((addr) => ({
            address: STAKING_CONTRACT_ADDRESS!,
            abi: STAKING_ABI,
            functionName: 'getStakeInfo' as const,
            args: [addr] as [Address],
            chainId: STAKING_CHAIN_ID,
          }))
        : [],
    [addresses],
  );

  const { data: stakeInfoResults, isLoading: isLoadingContracts } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0 },
  });

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    if (!stakeInfoResults || stakeInfoResults.length === 0) return [];

    const now = Math.floor(Date.now() / 1000);
    const entries: Omit<LeaderboardEntry, 'rank'>[] = [];

    for (let i = 0; i < stakeInfoResults.length; i++) {
      const result = stakeInfoResults[i];
      if (result?.status !== 'success') continue;

      const [stakedAmount, multiplier, stakeTimestamp] = result.result as [bigint, bigint, bigint, bigint];
      if (stakedAmount === 0n) continue;

      // 权重从链上 stakeTimestamp 实时算，不存数据库
      const daysStaked = Math.max(0, (now - Number(stakeTimestamp)) / 86400);
      const synthFloat = Number(stakedAmount) / 1e18;
      const score = synthFloat * daysStaked * Number(multiplier);

      entries.push({
        address: addresses[i],
        stakedAmount,
        multiplier: Number(multiplier),
        daysStaked,
        score,
      });
    }

    return entries
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [stakeInfoResults, addresses]);

  return {
    leaderboard,
    isLoading: isLoadingAddresses || isLoadingContracts,
    error,
    lastUpdated,
    refresh,
  };
}
