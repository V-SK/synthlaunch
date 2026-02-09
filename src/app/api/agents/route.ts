import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { xorEncrypt } from '@/lib/agentEncryption';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AGENT_SELECT = 'id,user_address,name,description,plan,payment_method,payment_amount,status,created_at,expires_at,tx_hash,container_id';
const ALLOWED_PLANS = new Set(['7d', '14d', '30d']);
const ALLOWED_PAYMENT_METHODS = new Set(['synth', 'usdt', 'bnb']);

function jsonError(message: string, status: number = 400, details?: string) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('user_address');

    if (!userAddress) {
      return jsonError('Missing user_address', 400);
    }

    const supabase = createClient();
    const encodedAddress = encodeURIComponent(userAddress);
    const data = await supabase.request<any[]>(
      `hosted_agents?select=${AGENT_SELECT}&user_address=eq.${encodedAddress}&order=created_at.desc`
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error('[agents][GET] error:', error);
    return jsonError('Failed to fetch agents', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_address,
      name,
      bot_token,
      description,
      plan,
      payment_method,
      payment_amount,
      expires_at,
      tx_hash,
    } = body || {};

    if (!user_address || !name || !bot_token || !plan || !payment_method || !expires_at || !tx_hash) {
      return jsonError('Missing required fields', 400);
    }

    if (!ALLOWED_PLANS.has(plan)) {
      return jsonError('Invalid plan', 400);
    }

    if (!ALLOWED_PAYMENT_METHODS.has(payment_method)) {
      return jsonError('Invalid payment_method', 400);
    }

    const expiresAt = new Date(expires_at);
    if (Number.isNaN(expiresAt.getTime())) {
      return jsonError('Invalid expires_at', 400);
    }

    const supabase = createClient();
    const encodedTx = encodeURIComponent(tx_hash);
    const existing = await supabase.request<any[]>(
      `hosted_agents?select=id&tx_hash=eq.${encodedTx}&limit=1`
    );

    if (existing.length > 0) {
      return jsonError('Duplicate tx_hash', 409);
    }

    const bot_token_encrypted = xorEncrypt(String(bot_token));

    const insertPayload: Record<string, unknown> = {
      user_address,
      name,
      bot_token_encrypted,
      description: description ?? null,
      plan,
      payment_method,
      payment_amount: payment_amount ?? null,
      expires_at: expiresAt.toISOString(),
      tx_hash,
    };

    const created = await supabase.request<any[]>(
      `hosted_agents?select=${AGENT_SELECT}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(insertPayload),
      }
    );

    if (!created || created.length === 0) {
      return jsonError('Failed to create agent', 500);
    }

    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error('[agents][POST] error:', error);
    return jsonError('Failed to create agent', 500);
  }
}
