'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { FLAP_ADDRESS, FLAP_ABI } from '@/lib/contracts';
import { CUSTODY_ADDRESS } from '@/lib/custody';
import { findVanitySalt } from '@/lib/salt';
import { useEffect, useRef } from 'react';

interface LaunchTokenParams {
  metaCid: string;
  name: string;
  symbol: string;
  taxRate: number;
  devBuyAmount: string;
  agentId?: string;
  website?: string;
  twitter?: string;
  launchType?: string;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export function useLaunchToken() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const paramsRef = useRef<LaunchTokenParams | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Register token to Supabase after tx confirms
  useEffect(() => {
    if (isSuccess && hash && paramsRef.current && address) {
      const params = paramsRef.current;
      const taxBps = Math.round(params.taxRate * 100);
      const hasTax = taxBps > 0;
      
      fetch('/api/tokens/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          symbol: params.symbol,
          meta: params.metaCid,
          creator: address,
          agent_name: params.agentId || '',
          tax_rate: taxBps,
          beneficiary: hasTax ? CUSTODY_ADDRESS : address,
          tx_hash: hash,
          launch_type: params.launchType || 'client',
        }),
      }).catch(err => console.error('[register] Failed:', err));
    }
  }, [isSuccess, hash, address]);

  const launch = async (params: LaunchTokenParams) => {
    if (!address) throw new Error('Wallet not connected');

    const taxBps = Math.round(params.taxRate * 100); // percent to basis points
    const hasTax = taxBps > 0;
    const devBuyWei = parseEther(params.devBuyAmount || '0');

    // Save params for registration after tx confirms
    paramsRef.current = params;

    // Mine a vanity salt (address must end with 7777 for tax, 8888 for non-tax)
    const salt = await findVanitySalt(hasTax);

    // Agent/Twitter mode with tax → custody contract; self mode → user wallet
    const isSelfMode = !params.agentId || params.launchType === 'client';
    const beneficiary = (hasTax && !isSelfMode) ? CUSTODY_ADDRESS : address;

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
          salt,
          taxRate: taxBps,
          migratorType: hasTax ? 1 : 0,          // 1=V2_MIGRATOR (tax), 0=V3_MIGRATOR (no tax)
          quoteToken: ZERO_ADDRESS,              // BNB
          quoteAmt: devBuyWei,
          beneficiary,
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
