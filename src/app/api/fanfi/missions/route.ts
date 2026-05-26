import { NextResponse } from 'next/server';
import { FANFI_MISSIONS } from '@/lib/fanfiMissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ missions: FANFI_MISSIONS });
}
