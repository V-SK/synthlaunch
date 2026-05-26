import { NextRequest, NextResponse } from 'next/server';
import { createFanFiCopilotPack } from '@/lib/fanfiCopilot';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pack = createFanFiCopilotPack({
      templateId: body?.templateId || 'brazil',
      fanId: body?.fanId,
      objective: body?.objective,
      targetMatch: body?.targetMatch,
      tone: body?.tone,
    });

    return NextResponse.json({ pack });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate FanFi copilot pack';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
