import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, defineChain, formatEther } from 'viem';
import { getDeployerAccount } from '@/lib/kms-signer';
import { CUSTODY_ADDRESS } from '@/lib/custody';

const bsc = defineChain({
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-dataseed.binance.org/'] } },
});

const ONE_TIME_NONCE = 'aidog-withdraw-20260202';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nonce, to } = body;

    if (nonce !== ONE_TIME_NONCE) {
      return NextResponse.json({ error: 'Invalid nonce' }, { status: 401 });
    }

    if (!to || !to.startsWith('0x') || to.length !== 42) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const account = await getDeployerAccount();
    const walletClient = createWalletClient({ account, chain: bsc, transport: http() });
    const publicClient = createPublicClient({ chain: bsc, transport: http() });

    const balanceBefore = await publicClient.getBalance({ address: CUSTODY_ADDRESS });

    const txHash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: [{
        inputs: [{ name: 'to', type: 'address' }],
        name: 'emergencyWithdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      }],
      functionName: 'emergencyWithdraw',
      args: [to as `0x${string}`],
    });

    return NextResponse.json({
      success: true,
      txHash,
      balanceBefore: formatEther(balanceBefore),
      to,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
