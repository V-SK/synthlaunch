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

    // Extract IPFS CID and resolve actual image
    let imageUrl = avatar || '';
    let ipfsCid = '';
    
    // Extract CID from various URL formats
    const pinataMatch = imageUrl.match(/gateway\.pinata\.cloud\/ipfs\/([a-zA-Z0-9]+)/);
    const ipfsIoMatch = imageUrl.match(/ipfs\.io\/ipfs\/([a-zA-Z0-9]+)/);
    const rawCidMatch = imageUrl.match(/^(bafkrei[a-z0-9]+)$/);
    
    if (pinataMatch) ipfsCid = pinataMatch[1];
    else if (ipfsIoMatch) ipfsCid = ipfsIoMatch[1];
    else if (rawCidMatch) ipfsCid = rawCidMatch[1];
    
    // If we have a CID, check if it's a Flap JSON wrapper and extract real image
    if (ipfsCid) {
      try {
        const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsCid}`, {
          headers: { 'Accept': 'application/json, image/*' },
        });
        const contentType = res.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          // It's JSON - likely a Flap wrapper, extract the real image
          const wrapper = await res.json();
          if (wrapper.image && typeof wrapper.image === 'string') {
            // wrapper.image might be just CID or full URL
            const innerCid = wrapper.image.match(/([a-zA-Z0-9]{59})/)?.[1] || wrapper.image;
            imageUrl = `ipfs://${innerCid}`;
          } else {
            imageUrl = `ipfs://${ipfsCid}`;
          }
        } else {
          // It's an actual image
          imageUrl = `ipfs://${ipfsCid}`;
        }
      } catch {
        // Fallback to original CID
        imageUrl = `ipfs://${ipfsCid}`;
      }
    }

    const metadata = {
      name: `SynthID #${id}`,
      description: description
        ? `Soulbound AI Agent Identity on X Layer + BSC — ${name}. ${description}`
        : `Soulbound AI Agent Identity on X Layer + BSC — ${name}`,
      image: imageUrl,
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
