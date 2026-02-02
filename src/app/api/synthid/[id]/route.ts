import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, type Address } from 'viem';
import { bsc } from 'viem/chains';
import { SYNTHID_ABI, SYNTHID_ADDRESS } from '@/lib/synthid';

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org'),
});

/**
 * GET /api/synthid/[id]
 * Returns standard NFT metadata JSON for SynthID token
 * This URL is set as agentURI so wallets can display the NFT properly
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tokenId = BigInt(id);

    const [identity, profile] = await Promise.all([
      client.readContract({
        address: SYNTHID_ADDRESS as Address,
        abi: SYNTHID_ABI,
        functionName: 'getAgentIdentity',
        args: [tokenId],
      }) as Promise<[string, string, string, string, bigint, string, boolean]>,
      client.readContract({
        address: SYNTHID_ADDRESS as Address,
        abi: SYNTHID_ABI,
        functionName: 'getAgentProfile',
        args: [tokenId],
      }) as Promise<[string, string, string[]]>,
    ]);

    const [name, platform, platformId, , createdAt, owner, revoked] = identity;
    const [avatar, description, skills] = profile;

    const metadata = {
      name: `SynthID #${id}`,
      description: description
        ? `AI Agent Identity on BSC — ${name}. ${description}`
        : `AI Agent Identity on BSC — ${name}`,
      image: avatar || '',
      external_url: `https://synthlaunch.fun/identity/agent/${id}`,
      attributes: [
        { trait_type: 'Name', value: name },
        { trait_type: 'Platform', value: platform },
        { trait_type: 'Platform ID', value: platformId },
        { trait_type: 'Status', value: revoked ? 'REVOKED' : 'VERIFIED' },
        { trait_type: 'Owner', value: owner },
        { trait_type: 'Created', value: new Date(Number(createdAt) * 1000).toISOString().split('T')[0] },
        ...(skills.length > 0 ? [{ trait_type: 'Skills', value: skills.join(', ') }] : []),
      ],
    };

    return NextResponse.json(metadata, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 min cache
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Token not found' },
      { status: 404 }
    );
  }
}
