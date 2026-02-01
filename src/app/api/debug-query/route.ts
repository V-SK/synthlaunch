import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const results: any = {};
  
  // Query with service key
  try {
    const r1 = await fetch(`${url}/rest/v1/tokens?select=address,name,symbol,meta,creator,agent_name,tax_rate,created_at&order=created_at.desc`, {
      headers: { apikey: svcKey!, Authorization: `Bearer ${svcKey!}` },
    });
    const d1 = await r1.json();
    results.svc = { status: r1.status, count: Array.isArray(d1) ? d1.length : 'not-array', data: d1 };
  } catch (e: any) { results.svc = { error: e.message }; }

  // Query with anon key
  try {
    const r2 = await fetch(`${url}/rest/v1/tokens?select=id,address&order=id.desc`, {
      headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey!}` },
    });
    const d2 = await r2.json();
    results.anon = { status: r2.status, count: Array.isArray(d2) ? d2.length : 'not-array', data: d2 };
  } catch (e: any) { results.anon = { error: e.message }; }

  return NextResponse.json(results);
}
