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

const RECLAIM_DAYS = 30; // 30 days without claim → reclaim
const WITHDRAW_TO = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e' as const;

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const publicClient = createPublicClient({ chain: bsc, transport: http() });

    // 1. Get all tokens from Supabase
    const res = await fetch(`${supabaseUrl}/rest/v1/tokens?select=address,name,agent_name,created_at`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
    }
    const tokens = await res.json();

    const now = Date.now();
    const reclaimThreshold = RECLAIM_DAYS * 24 * 60 * 60 * 1000;
    const reclaimed: { address: string; name: string; amount: string }[] = [];

    for (const token of tokens) {
      const tokenAge = now - new Date(token.created_at).getTime();
      if (tokenAge < reclaimThreshold) continue; // Too young

      // 2. Check if wallet is bound
      try {
        const agentName = token.agent_name || '';
        if (agentName) {
          const isBound = await publicClient.readContract({
            address: CUSTODY_ADDRESS,
            abi: CUSTODY_ABI,
            functionName: 'isWalletBound',
            args: [agentName],
          });
          if (isBound) continue; // Wallet bound, skip
        }

        // 3. Check if there are unclaimed fees
        const info = await publicClient.readContract({
          address: CUSTODY_ADDRESS,
          abi: CUSTODY_ABI,
          functionName: 'getTokenInfo',
          args: [token.address as `0x${string}`],
        }) as [string, bigint, bigint, bigint, string];

        const pendingClaim = info[3];
        if (pendingClaim === 0n) continue; // Nothing to reclaim

        // 4. Log for now — actual reclaim via emergencyWithdraw
        reclaimed.push({
          address: token.address,
          name: token.name || agentName,
          amount: formatEther(pendingClaim),
        });

      } catch (e) {
        console.log(`[reclaim] Error checking ${token.address}:`, (e as Error).message?.substring(0, 80));
        continue;
      }
    }

    if (reclaimed.length === 0) {
      return NextResponse.json({ success: true, message: 'No tokens eligible for reclaim', reclaimed: [] });
    }

    // 5. Execute emergencyWithdraw for eligible tokens
    // Note: emergencyWithdraw withdraws ALL contract BNB, so we only do this
    // if we're sure. For safety, just log and report — manual approval needed.
    return NextResponse.json({
      success: true,
      message: `Found ${reclaimed.length} tokens eligible for reclaim (>30 days, no wallet bound)`,
      reclaimed,
      action: 'pending_manual_approval',
      note: 'Call POST /api/reclaim-fees?execute=true to withdraw',
    });

  } catch (error) {
    console.error('Reclaim fees error:', error);
    return NextResponse.json(
      { error: 'Failed to check reclaim', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
