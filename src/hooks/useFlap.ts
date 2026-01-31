'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, encodeAbiParameters, keccak256 } from 'viem';
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
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const TAX_DURATION = BigInt(3153600000); // 100 years in seconds

export function useLaunchToken() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const launch = (params: LaunchTokenParams) => {
    if (!address) throw new Error('Wallet not connected');

    const taxBps = Math.round(params.taxRate * 100); // percent to basis points
    const devBuyWei = parseEther(params.devBuyAmount || '0');

    writeContract({
      address: FLAP_ADDRESS,
      abi: FLAP_ABI,
      functionName: 'newTokenV5',
      args: [
        {
          name: params.name,
          symbol: params.symbol,
          meta: params.metaCid,
          dexThresh: 1,                    // FOUR_FIFTHS (80%)
          salt: randomSalt(),
          taxRate: taxBps,
          migratorType: 1,                 // V2_MIGRATOR (required for tax tokens)
          quoteToken: ZERO_ADDRESS,        // BNB
          quoteAmt: devBuyWei,
          beneficiary: address,            // tax goes to user's wallet
          permitData: '0x' as `0x${string}`,
          extensionID: ZERO_BYTES32,
          extensionData: '0x' as `0x${string}`,
          dexId: 0,                        // DEX0 (PancakeSwap)
          lpFeeProfile: 0,                 // STANDARD
          taxDuration: TAX_DURATION,
          antiFarmerDuration: BigInt(0),
          mktBps: taxBps,                  // 100% of tax to beneficiary
          deflationBps: 0,
          dividendBps: 0,
          lpBps: 0,
          minimumShareBalance: BigInt(0),
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
