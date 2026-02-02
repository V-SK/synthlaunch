import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/synthid/moltbook?name=AliceBTC
 * Proxy Moltbook agent profile data for display on SynthID pages
 * Avoids CORS issues and caches for 5 minutes
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.moltbook.com/api/v1/agents/profile?name=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      return NextResponse.json({ found: false });
    }

    const data = await res.json();
    const agent = data.agent || data;

    if (!agent.name) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      name: agent.name,
      karma: agent.karma || 0,
      is_claimed: agent.is_claimed || false,
      avatar_url: agent.avatar_url || '',
      bio: agent.bio || '',
      x_handle: agent.x_handle || '',
      post_count: agent.post_count || agent.posts_count || 0,
      comment_count: agent.comment_count || agent.comments_count || 0,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return NextResponse.json({ found: false, error: 'timeout' });
  }
}
