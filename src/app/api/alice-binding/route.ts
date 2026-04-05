import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

// ---------------------------------------------------------------------------
// Supabase client (server-side, service role only)
// ---------------------------------------------------------------------------
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// GET /api/alice-binding?bsc=0x...
// Returns the current binding for a BSC address
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = rateLimit(`alice-binding-get:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 });
  }

  const bscAddress = req.nextUrl.searchParams.get('bsc')?.toLowerCase();
  if (!bscAddress || !/^0x[0-9a-f]{40}$/i.test(bscAddress)) {
    return NextResponse.json({ error: 'invalid bsc address' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('alice_bindings')
      .select('alice_address, created_at, updated_at')
      .eq('bsc_address', bscAddress)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ binding: data ?? null });
  } catch (e) {
    console.error('GET alice-binding error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/alice-binding
// Body: { bscAddress, aliceAddress, signature, message, nonce }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = rateLimit(`alice-binding-post:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { bscAddress, aliceAddress, signature, message, nonce } = body;

  // --- Basic field checks ---
  if (!bscAddress || !aliceAddress || !signature || !message || !nonce) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // --- BSC address format ---
  if (!/^0x[0-9a-fA-F]{40}$/.test(bscAddress)) {
    return NextResponse.json({ error: 'invalid bsc address format' }, { status: 400 });
  }

  // --- Alice address format: must be valid SS58 prefix 300 ---
  try {
    const { decodeAddress, encodeAddress } = await import('@polkadot/util-crypto');
    const pubKey = decodeAddress(aliceAddress, false, 300);
    const reencoded = encodeAddress(pubKey, 300);
    if (reencoded !== aliceAddress) {
      return NextResponse.json({ error: 'invalid alice address' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'invalid alice address format' }, { status: 400 });
  }

  // --- Nonce format: must be 32-char hex (16 random bytes) ---
  if (!/^[0-9a-f]{32}$/.test(nonce)) {
    return NextResponse.json({ error: 'invalid nonce' }, { status: 400 });
  }

  // --- Verify message matches expected template (prevents replay with altered content) ---
  const expectedMessage = `Bind Alice address ${aliceAddress} to BSC address ${bscAddress.toLowerCase()}\nNonce: ${nonce}`;
  if (message !== expectedMessage) {
    return NextResponse.json({ error: 'message mismatch' }, { status: 400 });
  }

  // --- Verify EIP-191 signature ---
  const { verifyMessage } = await import('viem');
  let valid = false;
  try {
    valid = await verifyMessage({
      address: bscAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 400 });
  }
  if (!valid) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
  }

  // --- Nonce replay check (rely on DB primary key constraint) ---
  try {
    const supabase = getSupabase();

    // Insert nonce — PK constraint prevents replay (no TOCTOU race)
    const { error: nonceErr } = await supabase
      .from('alice_binding_nonces')
      .insert({ nonce, bsc_address: bscAddress.toLowerCase() });

    if (nonceErr) {
      if (nonceErr.code === '23505') {
        return NextResponse.json({ error: 'nonce already used' }, { status: 409 });
      }
      throw nonceErr;
    }

    // Upsert binding
    const { error } = await supabase.from('alice_bindings').upsert(
      {
        bsc_address: bscAddress.toLowerCase(),
        alice_address: aliceAddress,
        signature,
        message,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'bsc_address' },
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST alice-binding error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
