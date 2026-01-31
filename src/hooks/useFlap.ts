'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { FLAP_ADDRESS, FLAP_ABI } from '@/lib/contracts';

interface LaunchTokenParams {
  metaCid: string;
  name: string;
  symbol: string;
  taxRate: number;
  devBuyAmount: string;
}

function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export function useLaunchToken() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const launch = (params: LaunchTokenParams) => {
    if (!address) throw new Error('Wallet not connected');

    const taxBps = Math.round(params.taxRate * 100); // percent to basis points
    const hasTax = taxBps > 0;
    const devBuyWei = parseEther(params.devBuyAmount || '0');

    writeContract({
      address: FLAP_ADDRESS,
      abi: FLAP_ABI,
      functionName: 'newTokenV2',
      args: [
        {
          name: params.name,
          symbol: params.symbol,
          meta: params.metaCid,
          dexThresh: 1,                          // FOUR_FIFTHS (80%)
          salt: randomSalt(),
          taxRate: taxBps,
          migratorType: hasTax ? 1 : 0,          // 1=V2_MIGRATOR (tax), 0=V3_MIGRATOR (no tax)
          quoteToken: ZERO_ADDRESS,              // BNB
          quoteAmt: devBuyWei,
          beneficiary: address,                  // tax goes to user's wallet
          permitData: '0x' as `0x${string}`,
        },
      ],
      value: devBuyWei,
    });
  };

  return {
    launch,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
