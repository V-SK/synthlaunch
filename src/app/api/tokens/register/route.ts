import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, defineChain, decodeEventLog, parseAbi, type Address, getAddress } from 'viem';
import { getDeployerAccount } from '@/lib/kms-signer';
import { CUSTODY_ABI } from '@/lib/custody';
import { CHAIN_CONFIG, type SupportedChainId } from '@/lib/contracts';

const bsc = defineChain({
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-dataseed.binance.org/'] } },
});

const xlayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://xlayerrpc.okx.com'] } },
});

function getChain(chainId: SupportedChainId) {
  return chainId === 196 ? xlayer : bsc;
}

const PORTAL_ABI = parseAbi([
  'function getTokenV5(address token) external view returns ((uint8,uint256,uint256,uint256,uint8,uint256,uint256,uint256,uint256,address,bool,bytes32))',
]);

const TOKEN_CREATED_TOPIC = '0xb48e5ee3c728ab39908c38d51d4be5fcf41950f5894e3b1e6a52e18e0e1be050'; // TokenCreated event

// Extract token address from tx receipt logs
async function getTokenAddressFromTx(txHash: string, chainId: SupportedChainId = 56): Promise<string | null> {
  try {
    const publicClient = createPublicClient({ chain: getChain(chainId), transport: http(CHAIN_CONFIG[chainId].rpc) });
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
    let { address, name, symbol, meta, creator, agent_name, tax_rate, beneficiary, tx_hash, launch_type, _rk, chainId } = body;

    // Verify register key — only our frontend/API should register tokens
    const REGISTER_KEY = process.env.REGISTER_SECRET || process.env.ADMIN_SECRET || '';
    if (!_rk || _rk !== REGISTER_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Resolve chain (default BSC for backward compat with existing Twitter / Moltbook flows)
    const parsedChainId: SupportedChainId =
      chainId === 196 || chainId === '196' ? 196 : 56;
    const chainConfig = CHAIN_CONFIG[parsedChainId];
    const PORTAL_ADDRESS = chainConfig.flapAddress as Address;

    // If no address but have tx_hash, extract token address from chain
    if (!address && tx_hash) {
      const extracted = await getTokenAddressFromTx(tx_hash, parsedChainId);
      if (extracted) {
        address = extracted;
        console.log(`[register] Extracted token address from tx: ${address}`);
      }
    }

    if (!address) {
      return NextResponse.json({ error: 'address required (could not extract from tx)' }, { status: 400 });
    }

    // === ON-CHAIN VERIFICATION: token must exist on Flap Portal ===
    try {
      const publicClient = createPublicClient({
        chain: getChain(parsedChainId),
        transport: http(chainConfig.rpc),
      });
      const result = await publicClient.readContract({
        address: PORTAL_ADDRESS,
        abi: PORTAL_ABI,
        functionName: 'getTokenV5',
        args: [getAddress(address) as Address],
      }) as any;
      const status = Number(result[0]);
      if (status === 0) {
        return NextResponse.json({ error: 'Token not found on-chain. Only real Flap tokens can be registered.' }, { status: 403 });
      }
    } catch (e) {
      console.error('[register] On-chain verification failed:', (e as Error).message?.substring(0, 100));
      return NextResponse.json({ error: 'Failed to verify token on-chain' }, { status: 502 });
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
        chain_id: parsedChainId,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Supabase error: ${text}` }, { status: res.status });
    }

    const data = await res.json();

    // Best-effort: register token on SynthLaunchCustody contract for this chain
    if (agent_name && address) {
      try {
          const account = await getDeployerAccount();
          const walletClient = createWalletClient({
            account,
            chain: getChain(parsedChainId),
            transport: http(chainConfig.rpc),
          });
          await walletClient.writeContract({
            address: chainConfig.custodyAddress as `0x${string}`,
            abi: CUSTODY_ABI,
            functionName: 'registerToken',
            args: [address.toLowerCase() as `0x${string}`, agent_name],
          });
          console.log(`[register] registerToken tx sent on chain ${parsedChainId} for ${address} / ${agent_name}`);
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
