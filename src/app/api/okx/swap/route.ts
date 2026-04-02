import { NextRequest, NextResponse } from 'next/server';
import { isOkxConfigured, mapOkxErrorMessage, okxSwap } from '@/lib/okx';

export const dynamic = 'force-dynamic';

function readPayload(request: NextRequest) {
  const fromTokenAddress =
    request.nextUrl.searchParams.get('fromTokenAddress')?.trim() ?? '';
  const toTokenAddress =
    request.nextUrl.searchParams.get('toTokenAddress')?.trim() ?? '';
  const amount = request.nextUrl.searchParams.get('amount')?.trim() ?? '';
  const userWalletAddress =
    request.nextUrl.searchParams.get('userWalletAddress')?.trim() ?? '';
  const slippage =
    request.nextUrl.searchParams.get('slippage')?.trim() ?? '0.5';

  return {
    fromTokenAddress,
    toTokenAddress,
    amount,
    userWalletAddress,
    slippage,
  };
}

async function handleSwap(payload: ReturnType<typeof readPayload>) {
  if (
    !payload.fromTokenAddress ||
    !payload.toTokenAddress ||
    !payload.amount ||
    !payload.userWalletAddress
  ) {
    return NextResponse.json(
      {
        error:
          'Missing fromTokenAddress, toTokenAddress, amount or userWalletAddress',
      },
      { status: 400 },
    );
  }

  if (!isOkxConfigured()) {
    return NextResponse.json(
      { error: 'OKX credentials are not configured' },
      { status: 503 },
    );
  }

  if (!/^\d+$/.test(payload.amount) || payload.amount === '0') {
    return NextResponse.json(
      { error: 'Amount must be a positive base-unit string.' },
      { status: 400 },
    );
  }

  const numericSlippage = Number(payload.slippage);
  if (!Number.isFinite(numericSlippage) || numericSlippage <= 0 || numericSlippage > 100) {
    return NextResponse.json(
      { error: 'Slippage must be a percentage between 0 and 100.' },
      { status: 400 },
    );
  }

  try {
    const data = await okxSwap(payload);
    return NextResponse.json({ data });
  } catch (error) {
    const message = mapOkxErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return await handleSwap(readPayload(request));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<
    ReturnType<typeof readPayload>
  >;

  return await handleSwap({
    fromTokenAddress: body.fromTokenAddress?.trim() ?? '',
    toTokenAddress: body.toTokenAddress?.trim() ?? '',
    amount: body.amount?.trim() ?? '',
    userWalletAddress: body.userWalletAddress?.trim() ?? '',
    slippage: body.slippage?.trim() ?? '0.5',
  });
}
