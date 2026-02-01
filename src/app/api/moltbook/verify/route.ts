import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 400 });
    }

    // 服务端调用 Moltbook，API Key 不暴露给浏览器
    const res = await fetch('https://www.moltbook.com/api/v1/agents/me', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (err) {
    console.error('[moltbook/verify] Error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
