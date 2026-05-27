import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { ADMIN_ADDRESS } from '@/lib/admin';
import { buildAdminSettleMessage } from '@/lib/fanfiSettleSignature';
import { scoreReceipt, SETTLEMENT_SCORING_RULES } from '@/lib/fanfiSettle';

/**
 * Admin endpoint to resolve a Prediction Arena and write reputation points
 * back to all matching receipts.
 *
 * Auth model: the signed `x-admin-message` must be byte-for-byte equal to
 * what `buildAdminSettleMessage` reconstructs from the request body — same
 * pattern as fanfiProofAuth (verifyMessage AFTER rebuild-equality). This
 * binds the signature to every settle parameter, not just substrings.
 *
 * Required body:
 *   {
 *     templateId: string,           // e.g. "brazil"
 *     targetMatch: string,          // free text; "" if none
 *     outcome: string,              // free text; e.g. "Brazil wins"
 *     cutoffTimestamp?: string,     // ISO; "" if none
 *     dryRun?: boolean              // default false
 *   }
 *
 * Required headers:
 *   x-admin-signature: 0x<sig>
 *   x-admin-message:   <urlencoded canonical message>
 */

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}

interface SettleBody {
  templateId: string;
  targetMatch: string;
  outcome: string;
  cutoffTimestamp: string;
  dryRun: boolean;
}

function normalizeBody(raw: any): SettleBody | { error: string } {
  const templateId = typeof raw?.templateId === 'string' ? raw.templateId.trim() : '';
  const outcome = typeof raw?.outcome === 'string' ? raw.outcome.trim() : '';
  if (!templateId) return { error: 'templateId is required' };
  if (!outcome) return { error: 'outcome is required' };

  return {
    templateId,
    targetMatch: typeof raw?.targetMatch === 'string' ? raw.targetMatch.trim() : '',
    outcome,
    cutoffTimestamp: typeof raw?.cutoffTimestamp === 'string' ? raw.cutoffTimestamp.trim() : '',
    dryRun: raw?.dryRun === true,
  };
}

async function verifyAdmin(req: NextRequest, body: SettleBody): Promise<{
  ok: true;
} | {
  ok: false;
  reason: string;
}> {
  const sig = req.headers.get('x-admin-signature');
  const rawMsg = req.headers.get('x-admin-message');
  if (!sig || !rawMsg) return { ok: false, reason: 'missing signature headers' };
  if (!/^0x[0-9a-fA-F]+$/.test(sig)) return { ok: false, reason: 'malformed signature' };

  let msg: string;
  try {
    msg = decodeURIComponent(rawMsg);
  } catch {
    return { ok: false, reason: 'message header not url-decodable' };
  }

  // Timestamp parse — required line in our canonical format.
  const tsMatch = msg.match(/^Timestamp:\s*(.+)$/m);
  if (!tsMatch) return { ok: false, reason: 'timestamp missing in signed message' };
  const ts = Number.parseInt(tsMatch[1], 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'timestamp not numeric' };
  if (Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
    return { ok: false, reason: 'signature expired or clock skew' };
  }

  // Rebuild expected canonical message from the body and require byte equality.
  // This is the critical binding: a captured signature can no longer be
  // replayed with a different (shorter / longer) body.
  const rebuilt = buildAdminSettleMessage({
    templateId: body.templateId,
    targetMatch: body.targetMatch,
    outcome: body.outcome,
    cutoffTimestamp: body.cutoffTimestamp,
    dryRun: body.dryRun,
    timestamp: String(ts),
  });

  if (msg !== rebuilt) {
    return { ok: false, reason: 'signed message does not match body' };
  }

  // Only after the message+body are equality-bound do we verify the signature.
  try {
    const valid = await verifyMessage({
      address: ADMIN_ADDRESS as `0x${string}`,
      message: msg,
      signature: sig as `0x${string}`,
    });
    if (!valid) return { ok: false, reason: 'signature did not recover admin address' };
  } catch {
    return { ok: false, reason: 'signature verification threw' };
  }

  return { ok: true };
}

export async function POST(req: NextRequest) {
  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const body = normalizeBody(raw);
  if ('error' in body) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }

  const auth = await verifyAdmin(req, body);
  if (!auth.ok) {
    // Generic 401 to the client; the specific reason goes to server logs only.
    console.warn('[admin/fanfi-settle] auth failed:', auth.reason);
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    console.error('[admin/fanfi-settle] supabase init failed', e);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }

  // Pull all OPEN receipts for this template (+ optional targetMatch filter).
  let query = supabase
    .from('fanfi_market_proofs')
    .select('*')
    .eq('template_id', body.templateId)
    .eq('settlement_status', 'open');
  if (body.targetMatch) query = query.eq('target_match', body.targetMatch);

  const { data: receipts, error: receiptError } = await query;
  if (receiptError) {
    console.error('[admin/fanfi-settle] receipt load error:', receiptError);
    return NextResponse.json({ error: 'failed to load receipts' }, { status: 500 });
  }

  const settlementOutcome = {
    outcome: body.outcome,
    cutoffTimestamp: body.cutoffTimestamp || undefined,
  };
  const resolvedAt = new Date().toISOString();

  const settled = (receipts || []).map((row: any) => {
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

  if (body.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      template: body.templateId,
      targetMatch: body.targetMatch || null,
      outcome: body.outcome,
      scoringRules: SETTLEMENT_SCORING_RULES,
      settled,
      count: settled.length,
    });
  }

  // Real write — flip status + write reputation + breakdown.
  let errorCount = 0;
  for (const row of settled) {
    const { error: updateError } = await supabase
      .from('fanfi_market_proofs')
      .update({
        settlement_status: 'resolved',
        resolved_at: resolvedAt,
        resolved_outcome: body.outcome,
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
      // Don't leak the underlying DB error to the client. Log + count.
      console.error('[admin/fanfi-settle] receipt update failed:', row.id, updateError);
      errorCount += 1;
    }
  }

  return NextResponse.json({
    ok: errorCount === 0,
    template: body.templateId,
    targetMatch: body.targetMatch || null,
    outcome: body.outcome,
    resolvedAt,
    scoringRules: SETTLEMENT_SCORING_RULES,
    settled,
    count: settled.length,
    errorCount: errorCount > 0 ? errorCount : undefined,
  });
}

/**
 * GET — preview which receipts would be settled. No auth (read-only).
 * Returns sanitized rows (no signature material, no signed messages) and
 * does not leak Supabase error internals.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const templateId = url.searchParams.get('templateId')?.trim();
  const targetMatch = url.searchParams.get('targetMatch')?.trim() || '';

  if (!templateId) {
    return NextResponse.json({ error: 'templateId query param required' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    console.error('[admin/fanfi-settle GET] supabase init failed', e);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }

  let query = supabase
    .from('fanfi_market_proofs')
    .select(
      'id, fan_id, prediction_direction, prediction_probability, prediction_reason, created_at, settlement_status',
    )
    .eq('template_id', templateId);
  if (targetMatch) query = query.eq('target_match', targetMatch);

  const { data, error } = await query;
  if (error) {
    console.error('[admin/fanfi-settle GET] receipt load error:', error);
    return NextResponse.json({ error: 'failed to load receipts' }, { status: 500 });
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
