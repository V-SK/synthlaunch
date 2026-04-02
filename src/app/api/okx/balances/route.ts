import { NextRequest, NextResponse } from 'next/server';
import { isOkxConfigured, okxBalances, okxTotalValue } from '@/lib/okx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }

  if (!isOkxConfigured()) {
    return NextResponse.json(
      { error: 'OKX credentials are not configured' },
      { status: 503 },
    );
  }

  try {
    const [balances, totals] = await Promise.all([
      okxBalances(address),
      okxTotalValue(address).catch(() => []),
    ]);

    return NextResponse.json({
      data: balances,
      totalValueUsd: totals[0]?.totalValue ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Balances request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
