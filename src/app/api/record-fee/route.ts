import { NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { CUSTODY_ABI, CUSTODY_ADDRESS } from '@/lib/custody';

const BSC_RPC = 'https://bsc-dataseed.binance.org';

function errorResponse(error: string, code: string, status: number = 400) {
  return NextResponse.json({ error, code }, { status });
}

// Verify admin secret from request
function verifyAdmin(request: Request): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  return token === adminSecret;
}

export async function POST(request: Request) {
  try {
    // Auth check
    if (!verifyAdmin(request)) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const { token, amount } = body;

    if (!token || !amount) {
      return errorResponse('Missing required fields: token, amount', 'INVALID_FORMAT');
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(token)) {
      return errorResponse('Invalid token address', 'INVALID_TOKEN');
    }

    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerKey) {
      return errorResponse('Server configuration error', 'CONFIG_ERROR', 500);
    }

    const account = privateKeyToAccount(deployerKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http(BSC_RPC),
    });
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http(BSC_RPC),
    });

    // amount is in wei (string or number)
    const amountBigInt = BigInt(amount);

    console.log(`[record-fee] Recording fee: token=${token}, amount=${amountBigInt}`);

    const txHash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'recordFee',
      args: [token as `0x${string}`, amountBigInt],
    });

    console.log(`[record-fee] Transaction sent: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
    console.log(`[record-fee] Confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

    return NextResponse.json({
      success: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[record-fee] Error:`, msg);
    return errorResponse(`Failed to record fee: ${msg}`, 'TX_FAILED', 500);
  }
}
