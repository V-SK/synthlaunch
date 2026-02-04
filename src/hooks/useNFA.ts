"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAccount, usePublicClient, useWalletClient, useChainId } from "wagmi";
import { parseEther, formatEther, type Address } from "viem";
import { NFA_ABI, type NFAgent, type MintAgentParams } from "@/lib/nfa";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function getNfaAddressFromEnv(): Address {
  const v = (process.env.NEXT_PUBLIC_NFA_ADDRESS || "").trim();
  if (!v) return ZERO_ADDRESS;
  return v as Address;
}

export function useNFA() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const NFA_ADDRESS = useMemo(() => getNfaAddressFromEnv(), []);
  const isConfigured = NFA_ADDRESS !== ZERO_ADDRESS;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<NFAgent[]>([]);
  const [stats, setStats] = useState({
    totalMinted: 0n,
    maxSupply: 0n,
    mintPrice: 0n,
  });

  const fetchStats = useCallback(async () => {
    if (!publicClient || !isConfigured) return;
    try {
      const [totalMinted, maxSupply, mintPrice] = await Promise.all([
        publicClient.readContract({ address: NFA_ADDRESS, abi: NFA_ABI, functionName: "totalMinted" }),
        publicClient.readContract({ address: NFA_ADDRESS, abi: NFA_ABI, functionName: "maxSupply" }),
        publicClient.readContract({ address: NFA_ADDRESS, abi: NFA_ABI, functionName: "mintPrice" }),
      ]);
      setStats({ totalMinted: totalMinted as bigint, maxSupply: maxSupply as bigint, mintPrice: mintPrice as bigint });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [publicClient, isConfigured, NFA_ADDRESS]);

  // Minimal event-based indexing without a subgraph:
  // We read Transfer events where `to == address` to get received tokenIds, then filter to still-owned.
  const fetchUserAgents = useCallback(async () => {
    if (!publicClient || !address || !isConfigured) return;
    setLoading(true);
    setError(null);
    try {
      // Find tokenIds ever received by this address
      const logs = await publicClient.getLogs({
        address: NFA_ADDRESS,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: true, name: "tokenId", type: "uint256" },
          ],
        },
        args: { to: address },
        fromBlock: 0n,
        toBlock: "latest",
      });

      const tokenIdSet = new Set<bigint>();
      for (const l of logs) {
        const tid = (l.args as any)?.tokenId as bigint | undefined;
        if (typeof tid === "bigint") tokenIdSet.add(tid);
      }

      const tokenIds = [...tokenIdSet.values()].sort((a, b) => (a < b ? -1 : 1));

      // Filter to currently owned (ownerOf can revert for non-existent; but tokenIds came from Transfer(to), so should exist)
      const owned: bigint[] = [];
      for (const tokenId of tokenIds) {
        try {
          const owner = await publicClient.readContract({ address: NFA_ADDRESS, abi: NFA_ABI, functionName: "ownerOf", args: [tokenId] }) as Address;
          if (owner.toLowerCase() === address.toLowerCase()) owned.push(tokenId);
        } catch {
          // ignore
        }
      }

      const agentPromises = owned.map(async (tokenId) => {
        const details = await publicClient.readContract({
          address: NFA_ADDRESS,
          abi: NFA_ABI,
          functionName: "getAgentDetails",
          args: [tokenId],
        }) as [string, Address, string, string, string, bigint, bigint, bigint, bigint, boolean];

        return {
          id: Number(tokenId),
          name: details[0],
          logic: details[1],
          persona: details[2],
          voice: details[3],
          animation: details[4],
          balance: details[5],
          experience: details[6],
          level: details[7],
          createdAt: details[8],
          active: details[9],
          owner: address,
        } as NFAgent;
      });

      setAgents(await Promise.all(agentPromises));
    } catch (err: any) {
      setError(err.message || "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, [publicClient, address, isConfigured, NFA_ADDRESS]);

  const checkNameAvailable = useCallback(async (name: string): Promise<boolean> => {
    if (!publicClient || !isConfigured) return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    try {
      // Contract normalizes case, but this view does not.
      // We mirror the contract rule in UI: lowercase.
      const normalized = trimmed.toLowerCase();
      const exists = await publicClient.readContract({ address: NFA_ADDRESS, abi: NFA_ABI, functionName: "nameExists", args: [normalized] });
      return !exists;
    } catch {
      return false;
    }
  }, [publicClient, isConfigured, NFA_ADDRESS]);

  const mintAgent = useCallback(async (params: MintAgentParams): Promise<string | null> => {
    if (!walletClient || !address || !publicClient) { setError("Wallet not connected"); return null; }
    if (!isConfigured) { setError("Contract address not configured"); return null; }
    setLoading(true); setError(null);
    try {
      const mintPrice = await publicClient.readContract({ address: NFA_ADDRESS, abi: NFA_ABI, functionName: "mintPrice" }) as bigint;
      const hash = await walletClient.writeContract({
        address: NFA_ADDRESS,
        abi: NFA_ABI,
        functionName: "mintAgent",
        args: [
          params.name,
          params.persona,
          params.voice || "",
          params.animation || "",
          (params.logic || ZERO_ADDRESS) as Address,
          params.tokenURI,
        ],
        value: mintPrice,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([fetchStats(), fetchUserAgents()]);
      return hash;
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Mint failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [walletClient, address, publicClient, isConfigured, NFA_ADDRESS, fetchStats, fetchUserAgents]);

  const fundAgent = useCallback(async (tokenId: number, amountBNB: string): Promise<boolean> => {
    if (!walletClient || !publicClient) { setError("Wallet not connected"); return false; }
    if (!isConfigured) { setError("Contract address not configured"); return false; }

    const amt = amountBNB.trim();
    if (!amt || Number(amt) <= 0) { setError("Amount must be > 0"); return false; }

    setLoading(true); setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: NFA_ADDRESS,
        abi: NFA_ABI,
        functionName: "fundAgent",
        args: [BigInt(tokenId)],
        value: parseEther(amt),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchUserAgents();
      return true;
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Fund failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, isConfigured, NFA_ADDRESS, fetchUserAgents]);

  const withdrawFromAgent = useCallback(async (tokenId: number, amountBNB: string): Promise<boolean> => {
    if (!walletClient || !publicClient) { setError("Wallet not connected"); return false; }
    if (!isConfigured) { setError("Contract address not configured"); return false; }

    const amt = amountBNB.trim();
    if (!amt || Number(amt) <= 0) { setError("Amount must be > 0"); return false; }

    setLoading(true); setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: NFA_ADDRESS,
        abi: NFA_ABI,
        functionName: "withdrawFromAgent",
        args: [BigInt(tokenId), parseEther(amt)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchUserAgents();
      return true;
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Withdraw failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, isConfigured, NFA_ADDRESS, fetchUserAgents]);

  const evolveAgent = useCallback(async (tokenId: number, xp: number): Promise<boolean> => {
    if (!walletClient || !publicClient) { setError("Wallet not connected"); return false; }
    if (!isConfigured) { setError("Contract address not configured"); return false; }
    if (!Number.isFinite(xp) || xp <= 0) { setError("XP must be > 0"); return false; }

    setLoading(true); setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: NFA_ADDRESS,
        abi: NFA_ABI,
        functionName: "evolve",
        args: [BigInt(tokenId), BigInt(xp)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchUserAgents();
      return true;
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Evolve failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, isConfigured, NFA_ADDRESS, fetchUserAgents]);

  const toggleActive = useCallback(async (tokenId: number, active: boolean): Promise<boolean> => {
    if (!walletClient || !publicClient) { setError("Wallet not connected"); return false; }
    if (!isConfigured) { setError("Contract address not configured"); return false; }

    setLoading(true); setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: NFA_ADDRESS,
        abi: NFA_ABI,
        functionName: "setActive",
        args: [BigInt(tokenId), active],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchUserAgents();
      return true;
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Toggle failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, isConfigured, NFA_ADDRESS, fetchUserAgents]);

  useEffect(() => {
    fetchStats();
    if (isConnected && address) fetchUserAgents();
  }, [isConnected, address, fetchStats, fetchUserAgents]);

  return {
    loading,
    error,
    agents,
    stats,
    isConnected,
    address,
    chainId,
    isConfigured,
    nfaAddress: NFA_ADDRESS,

    fetchStats,
    fetchUserAgents,
    checkNameAvailable,

    mintAgent,
    fundAgent,
    withdrawFromAgent,
    evolveAgent,
    toggleActive,

    clearError: () => setError(null),
    mintPriceFormatted: formatEther(stats.mintPrice),
  };
}
