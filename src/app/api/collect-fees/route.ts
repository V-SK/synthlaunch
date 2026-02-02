import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, defineChain, formatEther } from 'viem';
import { getDeployerAccount } from '@/lib/kms-signer';
import { CUSTODY_ABI, CUSTODY_ADDRESS } from '@/lib/custody';

const bsc = defineChain({
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-dataseed.binance.org/'] } },
});

const WITHDRAW_TO = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e' as const; // V's wallet

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicClient = createPublicClient({ chain: bsc, transport: http() });

    // 1. Check platform fee balance
    const platformBalance = await publicClient.readContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'platformFeeBalance',
    }) as bigint;

    if (platformBalance === 0n) {
      return NextResponse.json({ 
        success: true, 
        message: 'No platform fees to collect',
        balance: '0' 
      });
    }

    // 2. Get all tokens from Supabase REST API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    let tokenAddresses: string[] = [];
    if (supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/tokens?select=address`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
        if (res.ok) {
          const tokens = await res.json();
          tokenAddresses = tokens.map((t: { address: string }) => t.address);
        }
      } catch (e) {
        console.log('Failed to fetch tokens from Supabase:', (e as Error).message);
      }
    }

    // 3. Collect fees from all tokens (if any registered)
    const account = await getDeployerAccount();
    const walletClient = createWalletClient({ account, chain: bsc, transport: http() });

    if (tokenAddresses.length > 0) {
      try {
        const collectHash = await walletClient.writeContract({
          address: CUSTODY_ADDRESS,
          abi: CUSTODY_ABI,
          functionName: 'collectPlatformFeeBatch',
          args: [tokenAddresses as `0x${string}`[]],
        });
        await publicClient.waitForTransactionReceipt({ hash: collectHash, timeout: 30000 });
      } catch (e) {
        // collectPlatformFeeBatch might fail if no new fees, continue to withdraw
        console.log('collectPlatformFeeBatch skipped:', (e as Error).message?.substring(0, 100));
      }
    }

    // 4. Re-check balance after collection
    const updatedBalance = await publicClient.readContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'platformFeeBalance',
    }) as bigint;

    if (updatedBalance === 0n) {
      return NextResponse.json({ 
        success: true, 
        message: 'No fees after collection',
        balance: '0' 
      });
    }

    // 5. Withdraw to V's wallet
    const withdrawHash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'withdrawPlatformFee',
      args: [WITHDRAW_TO],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash, timeout: 30000 });

    return NextResponse.json({
      success: true,
      message: `Withdrew ${formatEther(updatedBalance)} BNB to ${WITHDRAW_TO}`,
      amount: formatEther(updatedBalance),
      txHash: withdrawHash,
      status: receipt.status,
    });

  } catch (error) {
    console.error('Collect fees error:', error);
    return NextResponse.json(
      { error: 'Failed to collect fees', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel Cron
export async function GET(request: Request) {
  return POST(request);
}
