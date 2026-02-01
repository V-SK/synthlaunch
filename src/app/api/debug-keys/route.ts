import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const svc = process.env.SUPABASE_SERVICE_KEY || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return NextResponse.json({
    url_start: url.substring(0, 30),
    svc_start: svc.substring(0, 15),
    anon_start: anon.substring(0, 15),
    same_key: svc === anon,
    svc_len: svc.length,
    anon_len: anon.length,
  });
}
