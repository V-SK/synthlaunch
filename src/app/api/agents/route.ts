import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://moltboard-production.up.railway.app/api/agents/leaderboard', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      console.error('[agents] MoltBoard API error:', res.status);
      return NextResponse.json({ error: 'MoltBoard unavailable' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[agents] Proxy error:', err);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}
