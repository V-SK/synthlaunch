'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseUnits } from 'viem';
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { ERC20_ABI } from '@/lib/erc20';
import {
  STAKING_ABI,
  STAKING_CHAIN_ID,
  STAKING_CONTRACT_ADDRESS,
  SYNTH_TOKEN_ADDRESS,
} from '@/lib/staking';

export type StakingAction = 'approve' | 'stake' | 'requestUnstake' | 'finalizeUnstake' | null;

export function useStaking(amountInput: string) {
  const { address, isConnected } = useAccount();
  const [activeAction, setActiveAction] = useState<StakingAction>(null);

  const hasStakingContract = Boolean(STAKING_CONTRACT_ADDRESS);

  const {
    writeContract,
    data: hash,
    error,
    isPending,
  } = useWriteContract();

  const {
    data: totalActiveStaked,
    refetch: refetchTotalActiveStaked,
  } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'totalActiveStaked',
    chainId: STAKING_CHAIN_ID,
    query: {
      enabled: hasStakingContract,
    },
  });

  const {
    data: decimalsData,
    refetch: refetchDecimals,
  } = useReadContract({
    address: SYNTH_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId: STAKING_CHAIN_ID,
  });

  const decimals = decimalsData ? Number(decimalsData) : 18;

  const {
    data: userReads,
    refetch: refetchUserReads,
  } = useReadContracts({
    contracts: hasStakingContract && isConnected && address
      ? [
          {
            address: STAKING_CONTRACT_ADDRESS!,
            abi: STAKING_ABI,
            functionName: 'getStakeInfo',
            args: [address],
            chainId: STAKING_CHAIN_ID,
          },
          {
            address: SYNTH_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
            chainId: STAKING_CHAIN_ID,
          },
          {
            address: SYNTH_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, STAKING_CONTRACT_ADDRESS!],
            chainId: STAKING_CHAIN_ID,
          },
        ]
      : [],
    query: {
      enabled: hasStakingContract && isConnected && !!address,
    },
  });

  const parsedAmount = useMemo(() => {
    const normalized = amountInput.trim();
    if (!normalized) return null;

    try {
      const amount = parseUnits(normalized, decimals);
      return amount > 0n ? amount : null;
    } catch {
      return null;
    }
  }, [amountInput, decimals]);

  const [stakeInfoResult, balanceResult, allowanceResult] = userReads ?? [];

  const stakeInfo =
    stakeInfoResult?.status === 'success'
      ? (stakeInfoResult.result as readonly [bigint, bigint, bigint, bigint])
      : ([0n, 0n, 0n, 0n] as const);

  const balance = balanceResult?.status === 'success' ? (balanceResult.result as bigint) : 0n;
  const allowance = allowanceResult?.status === 'success' ? (allowanceResult.result as bigint) : 0n;

  const [stakedAmount, multiplier, stakeTimestamp, unstakeRequestTime] = stakeInfo;
  const hasPendingUnstake = unstakeRequestTime > 0n;

  const needsApproval = parsedAmount !== null && allowance < parsedAmount;

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    chainId: STAKING_CHAIN_ID,
    query: {
      enabled: Boolean(hash),
    },
  });

  useEffect(() => {
    if (!isConfirmed) return;

    void refetchTotalActiveStaked();
    void refetchUserReads();
    void refetchDecimals();
    setActiveAction(null);
  }, [isConfirmed, refetchDecimals, refetchTotalActiveStaked, refetchUserReads]);

  useEffect(() => {
    if (!error) return;
    setActiveAction(null);
  }, [error]);

  const approve = () => {
    if (!hasStakingContract || !parsedAmount) return;

    setActiveAction('approve');
    writeContract({
      chainId: STAKING_CHAIN_ID,
      address: SYNTH_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [STAKING_CONTRACT_ADDRESS!, parsedAmount],
    });
  };

  const stake = () => {
    if (!hasStakingContract || !parsedAmount) return;

    setActiveAction('stake');
    writeContract({
      chainId: STAKING_CHAIN_ID,
      address: STAKING_CONTRACT_ADDRESS!,
      abi: STAKING_ABI,
      functionName: 'stake',
      args: [parsedAmount],
    });
  };

  const requestUnstake = () => {
    if (!hasStakingContract) return;

    setActiveAction('requestUnstake');
    writeContract({
      chainId: STAKING_CHAIN_ID,
      address: STAKING_CONTRACT_ADDRESS!,
      abi: STAKING_ABI,
      functionName: 'requestUnstake',
    });
  };

  const finalizeUnstake = () => {
    if (!hasStakingContract) return;

    setActiveAction('finalizeUnstake');
    writeContract({
      chainId: STAKING_CHAIN_ID,
      address: STAKING_CONTRACT_ADDRESS!,
      abi: STAKING_ABI,
      functionName: 'finalizeUnstake',
    });
  };

  return {
    hasStakingContract,
    isConnected,
    stakedAmount,
    multiplier: Number(multiplier),
    stakeTimestamp: Number(stakeTimestamp),
    unstakeRequestTime: Number(unstakeRequestTime),
    totalActiveStaked: totalActiveStaked ?? 0n,
    balance,
    allowance,
    decimals,
    parsedAmount,
    needsApproval,
    hasPendingUnstake,
    isPending,
    isConfirming,
    isConfirmed,
    hash,
    error,
    activeAction,
    approve,
    stake,
    requestUnstake,
    finalizeUnstake,
  };
}
