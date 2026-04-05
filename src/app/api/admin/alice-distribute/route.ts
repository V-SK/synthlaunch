import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const ADMIN_ADDRESS = '0x0198b366978ff0ee67bf308b0367c9b6fced2725';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const sig = req.headers.get('x-admin-signature');
  const rawMsg = req.headers.get('x-admin-message');
  if (!sig || !rawMsg) return false;
  try {
    const msg = decodeURIComponent(rawMsg);
    const valid = await verifyMessage({
      address: ADMIN_ADDRESS as `0x${string}`,
      message: msg,
      signature: sig as `0x${string}`,
    });
    // Message must be recent (within 5 minutes)
    const match = msg.match(/Timestamp: (\d+)/);
    if (!match) return false;
    const ts = parseInt(match[1]);
    if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
    return valid;
  } catch {
    return false;
  }
}

// GET: fetch distribution history + stats
export async function GET(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();

  // Recent rounds
  const { data: rounds } = await supabase
    .from('alice_distribution_rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  // Per-address totals
  const { data: totals } = await supabase
    .from('alice_distributions')
    .select('bsc_address, alice_address, alice_amount, status')
    .eq('status', 'success');

  // Aggregate totals per address
  const addressTotals = new Map<string, { aliceAddress: string; total: bigint }>();
  for (const row of totals ?? []) {
    const existing = addressTotals.get(row.bsc_address);
    const amount = BigInt(row.alice_amount);
    if (existing) {
      existing.total += amount;
    } else {
      addressTotals.set(row.bsc_address, { aliceAddress: row.alice_address, total: amount });
    }
  }

  const perAddress = Array.from(addressTotals.entries()).map(([bsc, { aliceAddress, total }]) => ({
    bscAddress: bsc,
    aliceAddress,
    totalAlice: total.toString(),
  }));

  return NextResponse.json({ rounds: rounds ?? [], perAddress });
}

// POST: manually trigger distribution
export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Trigger the cron endpoint internally
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = req.nextUrl.origin;
  const res = await fetch(`${baseUrl}/api/cron/alice-distribute`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
