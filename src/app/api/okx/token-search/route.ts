import { NextRequest, NextResponse } from 'next/server';
import { isOkxConfigured, okxTokenSearch } from '@/lib/okx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')?.trim();

  if (!search) {
    return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
  }

  if (!isOkxConfigured()) {
    return NextResponse.json(
      { error: 'OKX credentials are not configured' },
      { status: 503 },
    );
  }

  try {
    const results = await okxTokenSearch(search);
    return NextResponse.json({ data: results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Token search request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
