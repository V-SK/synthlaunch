import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  const res = await fetch(
    `${url}/rest/v1/tokens?address=eq.0xb345810cba7fede759728366c0b8a949540e7777`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: key!,
        Authorization: `Bearer ${key!}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: 'AliceBTC',
        symbol: 'ALICE',
        tax_rate: 200,
        meta: 'bafkreifsorqh23zxibaixbghkvyxhfiyrck5pg7qczjza7xiv2ht7jqt6y',
      }),
    }
  );
  const data = await res.json();
  return NextResponse.json({ status: res.status, data });
}
