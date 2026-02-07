import { NextResponse } from 'next/server';
import { getTwitterBot } from '@/services/twitter-bot';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const status = getTwitterBot().getStatus();
    return NextResponse.json(status);
  } catch (err) {
    console.error('[TwitterBot API] Status error:', err);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const bot = getTwitterBot();
    bot.start();
    return NextResponse.json(bot.getStatus());
  } catch (err) {
    console.error('[TwitterBot API] Start error:', err);
    return NextResponse.json({ error: 'Failed to start bot' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const bot = getTwitterBot();
    bot.stop();
    return NextResponse.json(bot.getStatus());
  } catch (err) {
    console.error('[TwitterBot API] Stop error:', err);
    return NextResponse.json({ error: 'Failed to stop bot' }, { status: 500 });
  }
}
