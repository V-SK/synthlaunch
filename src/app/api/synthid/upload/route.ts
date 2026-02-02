import { NextRequest, NextResponse } from 'next/server';

const FLAP_UPLOAD_URL = 'https://funcs.flap.sh/api/upload';

/**
 * POST /api/synthid/upload
 * Upload an image file directly to IPFS (returns raw image CID, not wrapped in metadata JSON)
 * Used by SynthID register page for avatar uploads
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 });
    }

    if (file.size > 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 1MB)' }, { status: 400 });
    }

    // Upload with empty meta so Flap doesn't wrap it in JSON metadata
    // Use minimal meta to satisfy the API requirement
    const meta = { name: file.name, symbol: '', description: '' };

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
    const cid = data?.data?.uploadFile?.cid || data?.data?.create;

    if (!cid) {
      return NextResponse.json({ error: 'No CID returned', raw: data }, { status: 502 });
    }

    // Verify the uploaded content is actually an image
    const verifyRes = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    const contentType = verifyRes.headers.get('content-type') || '';

    if (contentType.startsWith('image/')) {
      // Direct image CID — use as-is
      return NextResponse.json({
        cid,
        url: `https://gateway.pinata.cloud/ipfs/${cid}`,
        type: 'image',
      });
    }

    // Flap wrapped it in JSON — extract the inner image CID
    try {
      const metaRes = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
        signal: AbortSignal.timeout(10000),
      });
      const metaJson = await metaRes.json();
      const imageCid = metaJson?.image;
      if (imageCid) {
        return NextResponse.json({
          cid: imageCid,
          url: `https://gateway.pinata.cloud/ipfs/${imageCid}`,
          type: 'unwrapped',
        });
      }
    } catch {
      // fall through
    }

    // Fallback: return the CID anyway
    return NextResponse.json({
      cid,
      url: `https://gateway.pinata.cloud/ipfs/${cid}`,
      type: 'unknown',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
