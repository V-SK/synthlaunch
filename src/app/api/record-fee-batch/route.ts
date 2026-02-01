import { NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { CUSTODY_ABI, CUSTODY_ADDRESS } from '@/lib/custody';

const BSC_RPC = 'https://bsc-dataseed.binance.org';

function errorResponse(error: string, code: string, status: number = 400) {
  return NextResponse.json({ error, code }, { status });
}

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
    if (!verifyAdmin(request)) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const { tokens, amounts } = body;

    if (!tokens || !amounts || !Array.isArray(tokens) || !Array.isArray(amounts)) {
      return errorResponse('Missing required fields: tokens (array), amounts (array)', 'INVALID_FORMAT');
    }

    if (tokens.length !== amounts.length) {
      return errorResponse('tokens and amounts arrays must have the same length', 'INVALID_FORMAT');
    }

    if (tokens.length === 0) {
      return errorResponse('Empty arrays', 'INVALID_FORMAT');
    }

    // Validate all token addresses
    for (const t of tokens) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(t)) {
        return errorResponse(`Invalid token address: ${t}`, 'INVALID_TOKEN');
      }
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

    const tokenAddresses = tokens.map((t: string) => t as `0x${string}`);
    const amountsBigInt = amounts.map((a: string | number) => BigInt(a));

    console.log(`[record-fee-batch] Recording ${tokens.length} fee entries`);

    const txHash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'recordFeeBatch',
      args: [tokenAddresses, amountsBigInt],
    });

    console.log(`[record-fee-batch] Transaction sent: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
    console.log(`[record-fee-batch] Confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

    return NextResponse.json({
      success: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      count: tokens.length,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[record-fee-batch] Error:`, msg);
    return errorResponse(`Failed to record fees: ${msg}`, 'TX_FAILED', 500);
  }
}
