import { NextResponse } from 'next/server';
import {
  getAiAuthCookieName,
  getAiSessionCookieOptions,
} from '@/lib/ai/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(getAiAuthCookieName(), '', {
    ...getAiSessionCookieOptions(0),
    expires: new Date(0),
  });
  return response;
}
