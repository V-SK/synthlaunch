import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, isNFALiteOwner, isTimestampValid } from '@/lib/auth';
import { ZERO_ADDRESS } from '@/lib/nfaLite';

export const dynamic = 'force-dynamic';

const NFALITE_CONTRACT = (process.env.NFALITE_CONTRACT || process.env.NEXT_PUBLIC_NFALITE_CONTRACT || ZERO_ADDRESS) as `0x${string}`;
const FLAP_API = 'https://flap.sh/api';

function buildAvatarMessage(agentId: number, timestamp: number) {
  return `SynthLaunch Agent Avatar\n\nAgent ID: ${agentId}\nTimestamp: ${timestamp}`;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agentId = Number(params.id);
    if (!Number.isFinite(agentId) || agentId <= 0) {
      return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });
    }

    if (NFALITE_CONTRACT === ZERO_ADDRESS) {
      return NextResponse.json({ error: 'NFALite contract not configured' }, { status: 500 });
    }

    const signature = request.headers.get('x-signature') as `0x${string}` | null;
    const timestamp = Number(request.headers.get('x-timestamp') || 0);

    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    if (!isTimestampValid(timestamp)) {
      return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
    }

    const message = buildAvatarMessage(agentId, timestamp);
    const signer = await verifySignature(message, signature);

    const isOwner = await isNFALiteOwner(NFALITE_CONTRACT, agentId, signer);
    if (!isOwner) {
      return NextResponse.json({ error: 'Not the owner of this NFA' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const upload = new FormData();
    upload.append('file', file, file.name || 'avatar.png');

    const res = await fetch(`${FLAP_API}/upload`, {
      method: 'POST',
      body: upload,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || 'Upload failed' }, { status: 502 });
    }

    const data = await res.json();
    const cid = data?.cid || data?.IpfsHash;
    const url = cid ? `ipfs://${cid}` : data?.url;
    const gateway = cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : data?.url;

    return NextResponse.json({ cid, url, gateway }, { status: 200 });
  } catch (error) {
    console.error('POST /api/agent/[id]/avatar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
