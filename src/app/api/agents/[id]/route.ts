import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AGENT_SELECT = 'id,user_address,name,description,plan,payment_method,payment_amount,status,created_at,expires_at,tx_hash,container_id';
const ALLOWED_STATUSES = new Set(['pending', 'deploying', 'running', 'stopped', 'expired']);

function jsonError(message: string, status: number = 400, details?: string) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const id = context.params?.id;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);
    const data = await supabase.request<any[]>(
      `agents?select=${AGENT_SELECT}&id=eq.${encodedId}&limit=1`
    );

    if (!data || data.length === 0) {
      return jsonError('Agent not found', 404);
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('[agents][id][GET] error:', error);
    return jsonError('Failed to fetch agent', 500);
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const id = context.params?.id;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body && typeof body.status === 'string') {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return jsonError('Invalid status', 400);
      }
      updates.status = body.status;
    }

    if (body && Object.prototype.hasOwnProperty.call(body, 'container_id')) {
      updates.container_id = body.container_id ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError('No valid fields to update', 400);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);
    const data = await supabase.request<any[]>(
      `agents?id=eq.${encodedId}&select=${AGENT_SELECT}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!data || data.length === 0) {
      return jsonError('Agent not found', 404);
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('[agents][id][PATCH] error:', error);
    return jsonError('Failed to update agent', 500);
  }
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const id = context.params?.id;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);
    const data = await supabase.request<any[]>(
      `agents?id=eq.${encodedId}&select=${AGENT_SELECT}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ status: 'stopped' }),
      }
    );

    if (!data || data.length === 0) {
      return jsonError('Agent not found', 404);
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('[agents][id][DELETE] error:', error);
    return jsonError('Failed to stop agent', 500);
  }
}
