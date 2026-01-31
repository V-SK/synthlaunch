'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { FLAP_ADDRESS, FLAP_ABI } from '@/lib/contracts';

interface LaunchTokenParams {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website: string;
  twitter: string;
  telegram: string;
  taxRate: number;
  taxRecipient: string;
  devBuyAmount: string;
}

export function useLaunchToken() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const launch = async (params: LaunchTokenParams) => {
    if (!address) throw new Error('Wallet not connected');

    writeContract({
      address: FLAP_ADDRESS,
      abi: FLAP_ABI,
      functionName: 'newTokenV5',
      args: [
        params.name,
        params.symbol,
        params.description,
        params.image,
        params.website,
        params.twitter,
        params.telegram,
        BigInt(params.taxRate * 100), // basis points
        params.taxRecipient as `0x${string}`,
      ],
      value: parseEther(params.devBuyAmount || '0'),
    });
  };

  return {
    launch,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
