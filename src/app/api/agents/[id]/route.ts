import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const AGENT_SELECT = 'id,user_address,name,description,plan,payment_method,payment_amount,status,created_at,expires_at,tx_hash,container_id,soul_md';
const ALLOWED_STATUSES = new Set(['pending', 'deploying', 'running', 'stopped', 'expired']);
const VPS_HOST = '45.76.180.239';
const VPS_DEPLOY_SECRET = process.env.VPS_DEPLOY_SECRET || 'synth-deploy-2026';

function jsonError(message: string, status: number = 400, details?: string) {
  return NextResponse.json({ error: message, details }, { status });
}

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

async function updateSoulOnVps(agentId: string, soulMd: string) {
  const response = await fetch(`http://${VPS_HOST}:3456/soul`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VPS_DEPLOY_SECRET}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      soul_md: soulMd,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'VPS update failed');
  }
}

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const ip = getClientIP(_request);
    const rl = rateLimit(`agents:id:get:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const id = context.params?.id;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);
    const data = await supabase.request<any[]>(
      `hosted_agents?select=${AGENT_SELECT}&id=eq.${encodedId}&limit=1`
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
    const ip = getClientIP(request);
    const rl = rateLimit(`agents:id:patch:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const id = context.params?.id;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    const supabase = createClient();

    if (body && typeof body.status === 'string') {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return jsonError('Invalid status', 400);
      }
      updates.status = body.status;
    }

    if (body && Object.prototype.hasOwnProperty.call(body, 'container_id')) {
      updates.container_id = body.container_id ?? null;
    }

    if (body && Object.prototype.hasOwnProperty.call(body, 'soul_md')) {
      if (typeof body.soul_md !== 'string') {
        return jsonError('Invalid soul_md', 400);
      }
      if (!body.user_address) {
        return jsonError('Missing user_address', 400);
      }

      const encodedId = encodeURIComponent(id);
      const agentRows = await supabase.request<any[]>(
        `hosted_agents?select=id,user_address&id=eq.${encodedId}&limit=1`
      );

      if (!agentRows || agentRows.length === 0) {
        return jsonError('Agent not found', 404);
      }

      const agent = agentRows[0];
      if (normalizeAddress(agent.user_address) !== normalizeAddress(body.user_address)) {
        return jsonError('Not authorized', 403);
      }

      await updateSoulOnVps(id, body.soul_md);
      updates.soul_md = body.soul_md;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError('No valid fields to update', 400);
    }

    const encodedId = encodeURIComponent(id);
    const data = await supabase.request<any[]>(
      `hosted_agents?id=eq.${encodedId}&select=${AGENT_SELECT}`,
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
    const ip = getClientIP(_request);
    const rl = rateLimit(`agents:id:delete:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const id = context.params?.id;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);
    const data = await supabase.request<any[]>(
      `hosted_agents?id=eq.${encodedId}&select=${AGENT_SELECT}`,
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
