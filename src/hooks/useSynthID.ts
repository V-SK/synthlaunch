'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { SYNTHID_ABI, SYNTHID_ADDRESS } from '@/lib/synthid';

export interface OnChainAgent {
  agentId: number;
  name: string;
  platform: string;
  platformId: string;
  agentURI: string;
  avatar: string;
  description: string;
  skills: string[];
  createdAt: number;
  owner: string;
  revoked: boolean;
}

// Hook: get stats
export function useSynthIDStats() {
  const { data: nextId } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'nextId',
  });
  const { data: activeCount } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'activeCount',
  });
  const { data: totalMinted } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'totalMinted',
  });
  return {
    nextId: nextId ? Number(nextId) : 0,
    activeCount: activeCount ? Number(activeCount) : 0,
    totalMinted: totalMinted ? Number(totalMinted) : 0,
  };
}

// Hook: fetch all agents using multicall
export function useAllAgents() {
  const { nextId, totalMinted, activeCount } = useSynthIDStats();
  const count = nextId > 0 ? nextId - 1 : 0; // IDs are 1..nextId-1

  // Build multicall contracts for identity + profile for each ID
  const identityCalls = Array.from({ length: count }, (_, i) => ({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'getAgentIdentity' as const,
    args: [BigInt(i + 1)],
  }));

  const profileCalls = Array.from({ length: count }, (_, i) => ({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'getAgentProfile' as const,
    args: [BigInt(i + 1)],
  }));

  const {
    data: identityResults,
    isLoading: idLoading,
    error: idError,
  } = useReadContracts({
    contracts: identityCalls,
    query: { enabled: count > 0 },
  });

  const {
    data: profileResults,
    isLoading: profLoading,
    error: profError,
  } = useReadContracts({
    contracts: profileCalls,
    query: { enabled: count > 0 },
  });

  const isLoading = idLoading || profLoading || nextId === undefined;
  const error = idError || profError;

  let agents: OnChainAgent[] = [];

  if (identityResults && profileResults && count > 0) {
    for (let i = 0; i < count; i++) {
      const id = identityResults[i];
      const pr = profileResults[i];
      if (id?.status === 'success' && pr?.status === 'success') {
        const [name, platform, platformId, agentURI, createdAt, owner, revoked] =
          id.result as [string, string, string, string, bigint, string, boolean];
        const [avatar, description, skills] = pr.result as [string, string, string[]];
        agents.push({
          agentId: i + 1,
          name,
          platform,
          platformId,
          agentURI,
          avatar,
          description,
          skills: skills || [],
          createdAt: Number(createdAt),
          owner,
          revoked,
        });
      }
    }
  }

  return { agents, isLoading, error, totalMinted, activeCount };
}

// Server-side fetchAllAgents moved to /lib/synthid-server.ts
