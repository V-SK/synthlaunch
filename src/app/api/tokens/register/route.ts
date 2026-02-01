import { NextResponse } from 'next/server';
import { createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const bsc = defineChain({
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-dataseed.binance.org/'] } },
});

const CUSTODY_ADDRESS = '0x611201B7F421a0E0Db6095a40BA2e76539789A09' as const;

const REGISTER_TOKEN_ABI = [
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'agentName', type: 'string' },
    ],
    name: 'registerToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, name, symbol, meta, creator, agent_name, tax_rate, beneficiary, tx_hash, launch_type } = body;

    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
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
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
        if (deployerKey) {
          const account = privateKeyToAccount(
            (deployerKey.startsWith('0x') ? deployerKey : `0x${deployerKey}`) as `0x${string}`
          );
          const walletClient = createWalletClient({
            account,
            chain: bsc,
            transport: http(),
          });
          await walletClient.writeContract({
            address: CUSTODY_ADDRESS,
            abi: REGISTER_TOKEN_ABI,
            functionName: 'registerToken',
            args: [address.toLowerCase() as `0x${string}`, agent_name],
          });
          console.log(`[register] registerToken tx sent for ${address} / ${agent_name}`);
        }
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
