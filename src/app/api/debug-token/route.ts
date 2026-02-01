import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, parseAbi, getAddress } from 'viem';
import { bsc } from 'viem/chains';

export const dynamic = 'force-dynamic';

const PORTAL_ADDRESS = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0';
const PORTAL_ABI = parseAbi([
  'function getTokenV5(address token) external view returns ((uint8,uint256,uint256,uint256,uint8,uint256,uint256,uint256,uint256,address,bool,bytes32))',
]);

export async function GET(request: NextRequest) {
  const addr = request.nextUrl.searchParams.get('address');
  if (!addr) return NextResponse.json({ error: 'need address param' });

  const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

  try {
    const checksummed = getAddress(addr);
    const result = await client.readContract({
      address: PORTAL_ADDRESS,
      abi: PORTAL_ABI,
      functionName: 'getTokenV5',
      args: [checksummed],
    }) as any;

    return NextResponse.json({
      address: checksummed,
      status: Number(result[0]),
      reserve: formatEther(result[1]),
      price: formatEther(result[3]),
      raw: JSON.stringify(result, (k, v) => typeof v === 'bigint' ? v.toString() : v),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message?.substring(0, 500) }, { status: 500 });
  }
}
