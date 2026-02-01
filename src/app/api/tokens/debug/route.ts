import { NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, parseAbi, getAddress, type Address } from 'viem';
import { bsc } from 'viem/chains';

export const dynamic = 'force-dynamic';

const BSC_RPC = 'https://bsc-dataseed.binance.org';
const PORTAL_ADDRESS = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0';
const PORTAL_ABI = parseAbi([
  'function getTokenV5(address token) external view returns ((uint8,uint256,uint256,uint256,uint8,uint256,uint256,uint256,uint256,address,bool,bytes32))',
]);

const client = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'no supabase' });
  }

  // 1. Fetch from Supabase
  const res = await fetch(
    `${supabaseUrl}/rest/v1/tokens?select=id,address,agent_name,symbol&order=created_at.desc`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const allTokens = await res.json();
  const valid = allTokens.filter((t: any) => t.address?.startsWith('0x') && t.address.length === 42);

  // 2. Test each on-chain
  const results: any[] = [];
  for (const t of valid) {
    const start = Date.now();
    try {
      const addr = getAddress(t.address) as Address;
      const result = await client.readContract({
        address: PORTAL_ADDRESS,
        abi: PORTAL_ABI,
        functionName: 'getTokenV5',
        args: [addr],
      }) as any;
      results.push({
        address: t.address,
        symbol: t.symbol,
        ok: true,
        status: Number(result[0]),
        reserve: formatEther(result[1]),
        ms: Date.now() - start,
      });
    } catch (e: any) {
      results.push({
        address: t.address,
        symbol: t.symbol,
        ok: false,
        error: e.message?.substring(0, 200),
        ms: Date.now() - start,
      });
    }
  }

  return NextResponse.json({
    supabase_total: allTokens.length,
    valid_total: valid.length,
    results,
  });
}
