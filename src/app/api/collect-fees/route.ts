import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { CUSTODY_ADDRESS, CUSTODY_ABI } from '@/lib/custody';

const CRON_SECRET = process.env.CRON_SECRET || '';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET || '0x8028227C43947F41bB431571002D512815D77C4F';

export const dynamic = 'force-dynamic';

async function collectFees() {
  if (!DEPLOYER_PRIVATE_KEY) {
    return NextResponse.json({ error: 'DEPLOYER_PRIVATE_KEY not configured' }, { status: 500 });
  }

  try {
    const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({ chain: bsc, transport: http() });
    const walletClient = createWalletClient({ account, chain: bsc, transport: http() });

    // Check platform fee balance
    const platformFeeBalance = await publicClient.readContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'platformFeeBalance',
    }) as bigint;

    if (platformFeeBalance === BigInt(0)) {
      return NextResponse.json({ 
        success: true, 
        message: 'No platform fees to collect',
        balance: '0' 
      });
    }

    // Withdraw platform fees
    const txHash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'withdrawPlatformFee',
      args: [PLATFORM_WALLET as `0x${string}`],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash, 
      confirmations: 1 
    });

    return NextResponse.json({
      success: true,
      message: `Withdrawn ${formatEther(platformFeeBalance)} BNB to ${PLATFORM_WALLET}`,
      amount: formatEther(platformFeeBalance),
      txHash,
      blockNumber: Number(receipt.blockNumber),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Collect fees error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — Vercel Cron uses GET requests
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return collectFees();
}

// POST — manual trigger
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return collectFees();
}
