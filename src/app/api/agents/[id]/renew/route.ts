import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, decodeEventLog, http, parseAbi, recoverMessageAddress } from 'viem';
import { bsc } from 'viem/chains';
import { createClient } from '@/lib/supabase';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { isTimestampValid } from '@/lib/auth';
import { SYNTH_TOKEN_ADDRESS } from '@/lib/contracts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const AGENT_SELECT = 'id,user_address,name,description,plan,payment_method,payment_amount,status,created_at,expires_at,tx_hash,container_id,soul_md';
const ALLOWED_PLANS = new Set(['7d', '14d', '30d']);
const PLAN_DAYS: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30 };
const ALLOWED_PAYMENT_METHODS = new Set(['synth', 'usdt', 'bnb']);
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const TREASURY_ADDRESS = '0x8028227C43947F41bB431571002D512815D77C4F';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const TRANSFER_EVENT_ABI = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const publicClient = createPublicClient({ chain: bsc, transport: http() });

type TxVerification =
  | { ok: true }
  | { ok: false; status: number; error: string };

function jsonError(message: string, status: number = 400, details?: string) {
  return NextResponse.json({ error: message, details }, { status });
}

function extractTimestamp(message: string): number | null {
  const match = message.match(/timestamp:\s*(\d{10,})/i);
  if (!match) {
    return null;
  }
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) {
    return null;
  }
  return raw < 1_000_000_000_000 ? raw * 1000 : raw;
}

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function getPaymentConfig(paymentMethod: string): { tokenAddress?: string; recipient: string } | null {
  if (paymentMethod === 'bnb') {
    return { recipient: TREASURY_ADDRESS };
  }
  if (paymentMethod === 'usdt') {
    return { tokenAddress: USDT_ADDRESS, recipient: TREASURY_ADDRESS };
  }
  if (paymentMethod === 'synth') {
    return { tokenAddress: SYNTH_TOKEN_ADDRESS, recipient: DEAD_ADDRESS };
  }
  return null;
}

async function verifyPaymentTx(
  txHash: string,
  userAddress: string,
  paymentMethod: string
): Promise<TxVerification> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, status: 400, error: 'Invalid tx_hash' };
  }

  const config = getPaymentConfig(paymentMethod);
  if (!config) {
    return { ok: false, status: 400, error: 'Invalid payment_method' };
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch (error) {
    console.error('[agents][renew] tx receipt error:', error);
    return { ok: false, status: 400, error: 'Transaction not found or not confirmed' };
  }

  if (!receipt || receipt.status !== 'success') {
    return { ok: false, status: 400, error: 'Transaction not confirmed' };
  }

  const sender = normalizeAddress(receipt.from);
  if (!sender || sender !== normalizeAddress(userAddress)) {
    return { ok: false, status: 400, error: 'Transaction sender mismatch' };
  }

  if (!config.tokenAddress) {
    const to = normalizeAddress(receipt.to);
    if (!to || to !== normalizeAddress(config.recipient)) {
      return { ok: false, status: 400, error: 'Transaction recipient mismatch' };
    }
    return { ok: true };
  }

  const tokenAddress = normalizeAddress(config.tokenAddress);
  const txTo = normalizeAddress(receipt.to);
  if (!txTo || txTo !== tokenAddress) {
    return { ok: false, status: 400, error: 'Token contract mismatch' };
  }

  const expectedRecipient = normalizeAddress(config.recipient);
  let transferFound = false;
  for (const log of receipt.logs) {
    if (normalizeAddress(log.address) !== tokenAddress) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: TRANSFER_EVENT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== 'Transfer') {
        continue;
      }
      const { from, to } = decoded.args as { from: string; to: string; value: bigint };
      if (normalizeAddress(from) === sender && normalizeAddress(to) === expectedRecipient) {
        transferFound = true;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!transferFound) {
    return { ok: false, status: 400, error: 'Transfer not found for payment' };
  }

  return { ok: true };
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const ip = getClientIP(request);
    const rl = rateLimit(`agents:id:renew:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const id = context.params?.id;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const body = await request.json();
    const { user_address, plan, payment_method, payment_amount, tx_hash, signature, message } = body || {};

    if (!user_address || !plan || !payment_method || !tx_hash || !signature || !message) {
      return jsonError('Missing required fields', 400);
    }

    if (!ALLOWED_PLANS.has(plan)) {
      return jsonError('Invalid plan', 400);
    }

    if (!ALLOWED_PAYMENT_METHODS.has(payment_method)) {
      return jsonError('Invalid payment_method', 400);
    }

    if (typeof message !== 'string' || typeof signature !== 'string') {
      return jsonError('Invalid signature or message', 400);
    }

    const timestamp = extractTimestamp(message);
    if (!timestamp) {
      return jsonError('Missing timestamp in message', 400);
    }
    if (!isTimestampValid(timestamp)) {
      return jsonError('Timestamp expired', 401);
    }

    if (!/^0x[0-9a-fA-F]+$/.test(signature)) {
      return jsonError('Invalid signature', 400);
    }

    let recoveredAddress: string;
    try {
      recoveredAddress = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      });
    } catch (error) {
      return jsonError('Invalid signature', 401);
    }

    if (normalizeAddress(recoveredAddress) !== normalizeAddress(user_address)) {
      return jsonError('Signature does not match user_address', 401);
    }

    const txVerification = await verifyPaymentTx(tx_hash, user_address, payment_method);
    if (!txVerification.ok) {
      return jsonError(txVerification.error, txVerification.status);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);

    const agents = await supabase.request<any[]>(
      `hosted_agents?select=id,user_address,expires_at&id=eq.${encodedId}&limit=1`
    );
    if (!agents || agents.length === 0) {
      return jsonError('Agent not found', 404);
    }

    const agent = agents[0];
    if (normalizeAddress(agent.user_address) !== normalizeAddress(user_address)) {
      return jsonError('Not authorized', 403);
    }

    const encodedTx = encodeURIComponent(tx_hash);
    const existing = await supabase.request<any[]>(
      `hosted_agents?select=id&tx_hash=eq.${encodedTx}&limit=1`
    );
    if (existing.length > 0) {
      return jsonError('Duplicate tx_hash', 409);
    }

    const planDays = PLAN_DAYS[plan] ?? 0;
    const now = new Date();
    const currentExpires = new Date(agent.expires_at);
    const baseTime = Number.isFinite(currentExpires.getTime()) && currentExpires > now ? currentExpires : now;
    const newExpiresAt = new Date(baseTime.getTime() + planDays * 24 * 60 * 60 * 1000);

    const updated = await supabase.request<any[]>(
      `hosted_agents?id=eq.${encodedId}&select=${AGENT_SELECT}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          expires_at: newExpiresAt.toISOString(),
          plan,
          payment_method,
          payment_amount: payment_amount ?? null,
          tx_hash,
        }),
      }
    );

    if (!updated || updated.length === 0) {
      return jsonError('Failed to renew agent', 500);
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('[agents][id][renew][POST] error:', error);
    return jsonError('Failed to renew agent', 500, error instanceof Error ? error.message : undefined);
  }
}
