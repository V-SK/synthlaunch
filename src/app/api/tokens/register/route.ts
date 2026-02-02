import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, defineChain, decodeEventLog } from 'viem';
import { getDeployerAccount } from '@/lib/kms-signer';
import { CUSTODY_ADDRESS, CUSTODY_ABI } from '@/lib/custody';

const bsc = defineChain({
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-dataseed.binance.org/'] } },
});

const TOKEN_CREATED_TOPIC = '0xb48e5ee3c728ab39908c38d51d4be5fcf41950f5894e3b1e6a52e18e0e1be050'; // TokenCreated event

// Extract token address from tx receipt logs
async function getTokenAddressFromTx(txHash: string): Promise<string | null> {
  try {
    const publicClient = createPublicClient({ chain: bsc, transport: http() });
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    
    // Look for TokenCreated or similar event - token address is usually in the first CREATE2 log
    // The new token address appears as a topic in Transfer events (first transfer = minting)
    for (const log of receipt.logs) {
      // Look for Transfer event from zero address (mint) - topic0 = Transfer(address,address,uint256)
      if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        // Transfer from 0x0 = mint, the log.address IS the new token
        const from = log.topics[1];
        if (from === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          return log.address;
        }
      }
    }
    
    // Fallback: look for any contract creation in internal txns
    // The token address usually ends with 7777 or 8888
    for (const log of receipt.logs) {
      const addr = log.address.toLowerCase();
      if (addr.endsWith('7777') || addr.endsWith('8888')) {
        return addr;
      }
    }
    
    return null;
  } catch (e) {
    console.error('[register] Failed to get token from tx:', (e as Error).message?.substring(0, 100));
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { address, name, symbol, meta, creator, agent_name, tax_rate, beneficiary, tx_hash, launch_type } = body;

    // If no address but have tx_hash, extract token address from chain
    if (!address && tx_hash) {
      const extracted = await getTokenAddressFromTx(tx_hash);
      if (extracted) {
        address = extracted;
        console.log(`[register] Extracted token address from tx: ${address}`);
      }
    }

    if (!address) {
      return NextResponse.json({ error: 'address required (could not extract from tx)' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/tokens`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        address: address.toLowerCase(),
        name: name || '',
        symbol: symbol || '',
        meta: meta || '',
        creator: creator || '',
        agent_name: agent_name || '',
        tax_rate: tax_rate || 0,
        beneficiary: beneficiary || '',
        tx_hash: tx_hash || '',
        launch_type: launch_type || 'manual',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Supabase error: ${text}` }, { status: res.status });
    }

    const data = await res.json();

    // Best-effort: register token on SynthLaunchCustody contract
    if (agent_name && address) {
      try {
          const account = await getDeployerAccount();
          const walletClient = createWalletClient({
            account,
            chain: bsc,
            transport: http(),
          });
          await walletClient.writeContract({
            address: CUSTODY_ADDRESS,
            abi: CUSTODY_ABI,
            functionName: 'registerToken',
            args: [address.toLowerCase() as `0x${string}`, agent_name],
          });
          console.log(`[register] registerToken tx sent for ${address} / ${agent_name}`);
      } catch (contractErr: unknown) {
        const errMsg = contractErr instanceof Error ? contractErr.message : String(contractErr);
        console.error(`[register] registerToken failed (non-fatal): ${errMsg}`);
      }
    }

    return NextResponse.json({ success: true, token: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
