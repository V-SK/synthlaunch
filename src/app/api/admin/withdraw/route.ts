import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, defineChain, formatEther } from 'viem';
import { getDeployerAccount } from '@/lib/kms-signer';
import { CUSTODY_ADDRESS, CUSTODY_ABI } from '@/lib/custody';

const bsc = defineChain({
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-dataseed.binance.org/'] } },
});

const EMERGENCY_WITHDRAW_ABI = [
  {
    inputs: [{ name: 'to', type: 'address' }],
    name: 'emergencyWithdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    const auth = request.headers.get('authorization');

    if (!adminSecret || auth !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { to } = body;

    if (!to || !to.startsWith('0x') || to.length !== 42) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 });
    }

    const publicClient = createPublicClient({ chain: bsc, transport: http() });

    // Check how much excess BNB is available
    const balance = await publicClient.getBalance({ address: CUSTODY_ADDRESS });
    
    // Read totalRecorded and totalClaimedAmount to calculate excess
    const totalRecorded = await publicClient.readContract({
      address: CUSTODY_ADDRESS,
      abi: [{ inputs: [], name: 'totalRecorded', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
      functionName: 'totalRecorded',
    });

    const totalClaimed = await publicClient.readContract({
      address: CUSTODY_ADDRESS,
      abi: [{ inputs: [], name: 'totalClaimedAmount', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
      functionName: 'totalClaimedAmount',
    });

    const platformFee = await publicClient.readContract({
      address: CUSTODY_ADDRESS,
      abi: [{ inputs: [], name: 'platformFeeBalance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
      functionName: 'platformFeeBalance',
    });

    const accounted = platformFee + (totalRecorded - totalClaimed);
    const excess = balance > accounted ? balance - accounted : BigInt(0);

    if (excess === BigInt(0)) {
      return NextResponse.json({ 
        error: 'No excess BNB to withdraw',
        balance: formatEther(balance),
        accounted: formatEther(accounted),
      }, { status: 400 });
    }

    // Execute emergencyWithdraw
    const account = await getDeployerAccount();
    const walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http(),
    });

    const txHash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: EMERGENCY_WITHDRAW_ABI,
      functionName: 'emergencyWithdraw',
      args: [to as `0x${string}`],
    });

    return NextResponse.json({
      success: true,
      txHash,
      amount: formatEther(excess),
      to,
      balance: formatEther(balance),
      accounted: formatEther(accounted),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/withdraw] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
