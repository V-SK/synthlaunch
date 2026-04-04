'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { STAKING_ABI, STAKING_CHAIN_ID, STAKING_CONTRACT_ADDRESS } from '@/lib/staking';

const BSCSCAN_API_KEY = 'E5WR8GYV4G77M6DS9SYD68QYCH5915NBI7';
const STAKED_TOPIC = '0xb4caaf29adda3eefee3ad552a8e85058589bf834c7466cae4ee58787f70589ed';
// keccak256("UnstakeFinalized(address,uint256)")
const UNSTAKE_FINALIZED_TOPIC = '0x1a2c5e6b7f8d9e0a3c4b5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f';

const CACHE_KEY = 'synth_stakers_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
const TOP_N = 20;

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

async function fetchEventAddresses(topic: string): Promise<Set<string>> {
  const url = `https://api.bscscan.com/api?module=logs&action=getLogs&address=${STAKING_CONTRACT_ADDRESS}&topic0=${topic}&fromBlock=0&toBlock=latest&page=1&offset=1000&apikey=${BSCSCAN_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const result: Set<string> = new Set();
  if (!Array.isArray(data.result)) return result;
  for (const log of data.result) {
    const topic1 = log.topics?.[1];
    if (topic1) {
      // address is padded to 32 bytes, extract last 20
      const addr = '0x' + topic1.slice(-40);
      result.add(addr.toLowerCase());
    }
  }
  return result;
}

async function loadStakerAddresses(): Promise<Address[]> {
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

  const [stakedAddrs, finalizedAddrs] = await Promise.all([
    fetchEventAddresses(STAKED_TOPIC),
    fetchEventAddresses(UNSTAKE_FINALIZED_TOPIC),
  ]);

  // Active stakers = staked but not finalized
  const active: Address[] = [];
  for (const addr of stakedAddrs) {
    if (!finalizedAddrs.has(addr)) {
      active.push(addr as Address);
    }
  }

  // Save cache
  try {
    const toCache: CachedAddresses = { addresses: active, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
  } catch {
    // ignore
  }

  return active;
}

export function useLeaderboard() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    // Clear cache and reload
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingAddresses(true);
    setError(null);
    loadStakerAddresses()
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

      const daysStaked = Math.max(0, (now - Number(stakeTimestamp)) / 86400);
      const synthFloat = Number(stakedAmount) / 1e18;
      const score = synthFloat * daysStaked;

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
