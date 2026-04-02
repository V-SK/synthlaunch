import { NextRequest, NextResponse } from 'next/server';
import { isOkxConfigured, mapOkxErrorMessage, okxQuote } from '@/lib/okx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const fromTokenAddress =
    request.nextUrl.searchParams.get('fromTokenAddress')?.trim() ?? '';
  const toTokenAddress =
    request.nextUrl.searchParams.get('toTokenAddress')?.trim() ?? '';
  const amount = request.nextUrl.searchParams.get('amount')?.trim() ?? '';
  const slippage =
    request.nextUrl.searchParams.get('slippage')?.trim() ?? '0.5';
  const userWalletAddress =
    request.nextUrl.searchParams.get('userWalletAddress')?.trim() ?? undefined;

  if (!fromTokenAddress || !toTokenAddress || !amount) {
    return NextResponse.json(
      { error: 'Missing fromTokenAddress, toTokenAddress or amount' },
      { status: 400 },
    );
  }

  if (!isOkxConfigured()) {
    return NextResponse.json(
      { error: 'OKX credentials are not configured' },
      { status: 503 },
    );
  }

  if (!/^\d+$/.test(amount) || amount === '0') {
    return NextResponse.json(
      { error: 'Amount must be a positive base-unit string.' },
      { status: 400 },
    );
  }

  const numericSlippage = Number(slippage);
  if (!Number.isFinite(numericSlippage) || numericSlippage <= 0 || numericSlippage > 100) {
    return NextResponse.json(
      { error: 'Slippage must be a percentage between 0 and 100.' },
      { status: 400 },
    );
  }

  try {
    const data = await okxQuote({
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippage,
      userWalletAddress,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = mapOkxErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
