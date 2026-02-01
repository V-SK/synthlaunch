import { NextRequest, NextResponse } from 'next/server';

const FLAP_UPLOAD_URL = 'https://funcs.flap.sh/api/upload';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const symbol = formData.get('symbol') as string | null;
    const description = formData.get('description') as string | null;

    if (!file || !name || !symbol) {
      return NextResponse.json(
        { error: 'file, name, and symbol are required' },
        { status: 400 },
      );
    }

    // Build meta object
    const meta: Record<string, string> = {
      name,
      symbol,
      description: description || '',
    };

    const website = formData.get('website') as string | null;
    const twitter = formData.get('twitter') as string | null;
    const telegram = formData.get('telegram') as string | null;
    if (website) meta.website = website;
    if (twitter) meta.twitter = twitter;
    if (telegram) meta.telegram = telegram;

    // Build GraphQL multipart request for Flap
    const operations = JSON.stringify({
      query:
        'mutation ($file: Upload!, $meta: JSON!) { uploadFile(file: $file, meta: $meta) { cid } }',
      variables: { file: null, meta },
    });

    const map = JSON.stringify({ '0': ['variables.file'] });

    const flapForm = new FormData();
    flapForm.append('operations', operations);
    flapForm.append('map', map);
    flapForm.append('0', file);

    const res = await fetch(FLAP_UPLOAD_URL, {
      method: 'POST',
      body: flapForm,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Flap API error (${res.status}): ${text}` },
        { status: res.status },
      );
    }

    const data = await res.json();

    // Response: { "data": { "create": "bafkrei..." } }
    const cid = data?.data?.create;
    if (!cid) {
      return NextResponse.json(
        { error: 'Unexpected response from Flap API', raw: data },
        { status: 502 },
      );
    }

    return NextResponse.json({ cid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
