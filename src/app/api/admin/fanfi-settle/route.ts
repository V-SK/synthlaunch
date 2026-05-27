import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { scoreReceipt, SETTLEMENT_SCORING_RULES } from '@/lib/fanfiSettle';

/**
 * Admin endpoint to resolve a Prediction Arena and write reputation points
 * back to all matching receipts.
 *
 * Auth: wallet signature from the SynthLaunch deployer wallet (same pattern
 * as /api/admin/alice-distribute). The signed message must include
 * "Timestamp: <ms>" and the request body must echo the same templateId and
 * targetMatch (so signing one settle and replaying as another is rejected).
 *
 * Body:
 *   {
 *     templateId: "brazil" | "final" | "player" | "var" | "scout",
 *     targetMatch: "Brazil vs France",       // free text; matches receipt.target_match
 *     outcome: "Brazil wins",                 // free text; passed to scoring engine
 *     cutoffTimestamp?: "2026-06-11T18:30Z", // optional; for precise early-receipt bonus
 *     dryRun?: true                           // if true, returns scores without writing
 *   }
 */

const ADMIN_ADDRESS = '0x0198b366978ff0ee67bf308b0367c9b6fced2725';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}

async function verifyAdmin(req: NextRequest, body: any): Promise<boolean> {
  const sig = req.headers.get('x-admin-signature');
  const rawMsg = req.headers.get('x-admin-message');
  if (!sig || !rawMsg) return false;
  try {
    const msg = decodeURIComponent(rawMsg);

    // Message must reference the templateId + outcome being settled to bind
    // the signature to this request body.
    if (!msg.includes(`Template: ${body?.templateId}`)) return false;
    if (!msg.includes(`Outcome: ${body?.outcome}`)) return false;

    // Recent timestamp guard (5 min replay window).
    const match = msg.match(/Timestamp:\s*(\d+)/);
    if (!match) return false;
    const ts = Number.parseInt(match[1], 10);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;

    const valid = await verifyMessage({
      address: ADMIN_ADDRESS as `0x${string}`,
      message: msg,
      signature: sig as `0x${string}`,
    });
    return valid;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const isAdmin = await verifyAdmin(req, body);
  if (!isAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const templateId = String(body?.templateId || '').trim();
  const targetMatch = String(body?.targetMatch || '').trim();
  const outcome = String(body?.outcome || '').trim();
  const cutoffTimestamp = body?.cutoffTimestamp ? String(body.cutoffTimestamp) : undefined;
  const dryRun = body?.dryRun === true;

  if (!templateId || !outcome) {
    return NextResponse.json(
      { error: 'templateId and outcome are required' },
      { status: 400 },
    );
  }

  const supabase = getSupabase();

  // Pull all OPEN receipts for this template (+ optional targetMatch filter).
  let query = supabase
    .from('fanfi_market_proofs')
    .select('*')
    .eq('template_id', templateId)
    .eq('settlement_status', 'open');
  if (targetMatch) {
    query = query.eq('target_match', targetMatch);
  }

  const { data: receipts, error: receiptError } = await query;
  if (receiptError) {
    return NextResponse.json(
      { error: `Failed to load receipts: ${receiptError.message}` },
      { status: 500 },
    );
  }

  const settlementOutcome = { outcome, cutoffTimestamp };
  const resolvedAt = new Date().toISOString();

  type SettledRow = {
    id: string;
    fanId: string;
    direction: string | null;
    probability: number | null;
    breakdown: ReturnType<typeof scoreReceipt>;
  };

  const settled: SettledRow[] = (receipts || []).map((row: any) => {
    const breakdown = scoreReceipt(
      {
        predictionDirection: row.prediction_direction,
        predictionProbability: row.prediction_probability,
        predictionReason: row.prediction_reason,
        createdAt: row.created_at,
      },
      settlementOutcome,
    );
    return {
      id: row.id,
      fanId: row.fan_id,
      direction: row.prediction_direction,
      probability: row.prediction_probability,
      breakdown,
    };
  });

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      template: templateId,
      targetMatch: targetMatch || null,
      outcome,
      scoringRules: SETTLEMENT_SCORING_RULES,
      settled,
      count: settled.length,
    });
  }

  // Write reputation + settlement_status back to each receipt.
  const errors: Array<{ id: string; error: string }> = [];
  for (const row of settled) {
    const { error: updateError } = await supabase
      .from('fanfi_market_proofs')
      .update({
        settlement_status: 'resolved',
        resolved_at: resolvedAt,
        resolved_outcome: outcome,
        reputation_points: row.breakdown.total,
        reputation_breakdown: {
          direction: row.breakdown.directionPoints,
          probability: row.breakdown.probabilityPoints,
          earlyReceipt: row.breakdown.earlyReceiptPoints,
          reasonQuality: row.breakdown.reasonQualityPoints,
        },
      })
      .eq('id', row.id);

    if (updateError) {
      errors.push({ id: row.id, error: updateError.message });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    template: templateId,
    targetMatch: targetMatch || null,
    outcome,
    resolvedAt,
    scoringRules: SETTLEMENT_SCORING_RULES,
    settled,
    count: settled.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * GET — preview which receipts would be settled (no auth required for
 * read-only inspection). Useful for the admin UI to show "what will happen".
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const templateId = url.searchParams.get('templateId');
  const targetMatch = url.searchParams.get('targetMatch');

  if (!templateId) {
    return NextResponse.json({ error: 'templateId query param required' }, { status: 400 });
  }

  const supabase = getSupabase();
  let query = supabase
    .from('fanfi_market_proofs')
    .select(
      'id, fan_id, prediction_direction, prediction_probability, prediction_reason, created_at, settlement_status',
    )
    .eq('template_id', templateId);
  if (targetMatch) {
    query = query.eq('target_match', targetMatch);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    template: templateId,
    targetMatch: targetMatch || null,
    receipts: data || [],
    count: (data || []).length,
    scoringRules: SETTLEMENT_SCORING_RULES,
  });
}

export const dynamic = 'force-dynamic';
