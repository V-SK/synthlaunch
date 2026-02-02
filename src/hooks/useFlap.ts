'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { FLAP_ADDRESS, FLAP_ABI } from '@/lib/contracts';
import { CUSTODY_ADDRESS } from '@/lib/custody';
import { findVanitySalt } from '@/lib/salt';
import { useEffect, useRef, useState, useCallback } from 'react';

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
  const [launchParams, setLaunchParams] = useState<LaunchTokenParams | null>(null);
  const [registered, setRegistered] = useState(false);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Register token to Supabase after tx confirms
  const registerToken = useCallback(async (txHash: string, params: LaunchTokenParams, creator: string) => {
    const taxBps = Math.round(params.taxRate * 100);
    const hasTax = taxBps > 0;
    const selfMode = !params.agentId || params.launchType === 'client';

    console.log('[register] Registering token...', { txHash, name: params.name, symbol: params.symbol });

    try {
      const res = await fetch('/api/tokens/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          symbol: params.symbol,
          meta: params.metaCid,
          creator,
          agent_name: params.agentId || '',
          tax_rate: taxBps,
          beneficiary: (hasTax && !selfMode) ? CUSTODY_ADDRESS : creator,
          tx_hash: txHash,
          launch_type: params.launchType || 'client',
          _rk: process.env.NEXT_PUBLIC_REGISTER_KEY || '',
        }),
      });
      const data = await res.json();
      console.log('[register] Success:', data);
      setRegistered(true);
      // Bust token cache so homepage shows new token immediately
      fetch('/api/tokens?refresh=1').catch(() => {});
    } catch (err) {
      console.error('[register] Failed:', err);
    }
  }, []);

  useEffect(() => {
    if (isSuccess && hash && launchParams && address && !registered) {
      console.log('[useFlap] TX confirmed, triggering registration. hash:', hash, 'params:', launchParams.symbol);
      registerToken(hash, launchParams, address);
    }
  }, [isSuccess, hash, launchParams, address, registered, registerToken]);

  const launch = async (params: LaunchTokenParams) => {
    if (!address) throw new Error('Wallet not connected');

    const taxBps = Math.round(params.taxRate * 100); // percent to basis points
    const hasTax = taxBps > 0;
    const devBuyWei = parseEther(params.devBuyAmount || '0');

    // Save params for registration after tx confirms
    setLaunchParams(params);
    setRegistered(false);

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
