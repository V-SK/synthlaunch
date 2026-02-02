import { NextRequest, NextResponse } from 'next/server';

const FLAP_UPLOAD_URL = 'https://funcs.flap.sh/api/upload';

/**
 * Upload SynthID metadata JSON to IPFS
 * POST { name, platform, platformId, avatar, description, skills, tokenId }
 * Returns { uri: "https://gateway.pinata.cloud/ipfs/..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, platform, platformId, avatar, description, skills, tokenId } = body;

    if (!name || !tokenId) {
      return NextResponse.json({ error: 'name and tokenId are required' }, { status: 400 });
    }

    // Build standard NFT metadata
    const metadata = {
      name: `SynthID #${tokenId}`,
      description: description
        ? `AI Agent Identity on BSC — ${name}. ${description}`
        : `AI Agent Identity on BSC — ${name}`,
      image: avatar || '',
      external_url: `https://synthlaunch.fun/identity/agent/${tokenId}`,
      attributes: [
        { trait_type: 'Name', value: name },
        { trait_type: 'Platform', value: platform || 'custom' },
        { trait_type: 'Platform ID', value: platformId || '' },
        { trait_type: 'Status', value: 'VERIFIED' },
        ...(skills && skills.length > 0
          ? [{ trait_type: 'Skills', value: skills.join(', ') }]
          : []),
      ],
    };

    // Create JSON file blob
    const jsonBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const file = new File([jsonBlob], `synthid-${tokenId}.json`, { type: 'application/json' });

    // Upload to Flap IPFS
    const meta = { name: `SynthID #${tokenId}`, symbol: 'SID', description: 'SynthID Metadata' };
    const operations = JSON.stringify({
      query: 'mutation ($file: Upload!, $meta: JSON!) { uploadFile(file: $file, meta: $meta) { cid } }',
      variables: { file: null, meta },
    });

    const flapForm = new FormData();
    flapForm.append('operations', operations);
    flapForm.append('map', JSON.stringify({ '0': ['variables.file'] }));
    flapForm.append('0', file);

    const res = await fetch(FLAP_UPLOAD_URL, {
      method: 'POST',
      body: flapForm,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ error: `IPFS upload failed: ${text}` }, { status: 502 });
    }

    const data = await res.json();
    const cid = data?.data?.uploadFile?.cid || data?.data?.create || data?.cid;
    if (!cid) {
      return NextResponse.json({ error: 'No CID returned', raw: data }, { status: 502 });
    }

    const uri = `https://gateway.pinata.cloud/ipfs/${cid}`;
    return NextResponse.json({ uri, cid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
