import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const AGENT_SELECT = 'id,user_address,name,description,plan,payment_method,payment_amount,status,created_at,expires_at,tx_hash,container_id';
const VPS_HOST = '45.76.180.239';
const VPS_DEPLOY_SECRET = process.env.VPS_DEPLOY_SECRET || 'synth-deploy-2026';

const ALLOWED_ACTIONS = new Set(['stop', 'restart', 'delete', 'deploy']);

function jsonError(message: string, status: number = 400, details?: string) {
  return NextResponse.json({ error: message, details }, { status });
}

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request);
    const rl = rateLimit(`agents:id:action:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = await context.params;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const body = await request.json();
    const { action, user_address } = body || {};

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return jsonError('Invalid action', 400);
    }

    if (!user_address) {
      return jsonError('Missing user_address', 400);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);
    
    // Fetch agent and verify ownership
    const agents = await supabase.request<any[]>(
      `hosted_agents?select=${AGENT_SELECT}&id=eq.${encodedId}&limit=1`
    );

    if (!agents || agents.length === 0) {
      return jsonError('Agent not found', 404);
    }

    const agent = agents[0];

    // Verify ownership
    if (normalizeAddress(agent.user_address) !== normalizeAddress(user_address)) {
      return jsonError('Not authorized', 403);
    }

    // Handle different actions
    let newStatus: string | null = null;
    let vpsAction: string | null = null;

    switch (action) {
      case 'stop':
        if (agent.status !== 'running') {
          return jsonError('Agent is not running', 400);
        }
        newStatus = 'stopped';
        vpsAction = 'stop';
        break;

      case 'restart':
        if (agent.status !== 'stopped' && agent.status !== 'expired') {
          return jsonError('Agent cannot be restarted', 400);
        }
        newStatus = 'running';
        vpsAction = 'restart';
        break;

      case 'delete':
        newStatus = null; // Will delete the record
        vpsAction = 'delete';
        break;

      case 'deploy':
        if (agent.status !== 'pending') {
          return jsonError('Agent is not pending', 400);
        }
        // Use existing deploy endpoint
        const deployRes = await fetch(`${request.nextUrl.origin}/api/agents/${id}/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!deployRes.ok) {
          const err = await deployRes.json().catch(() => ({}));
          return jsonError(err.error || 'Deploy failed', 500);
        }
        const deployedAgent = await deployRes.json();
        return NextResponse.json(deployedAgent);
    }

    // Call VPS action endpoint
    if (vpsAction) {
      try {
        const vpsRes = await fetch(`http://${VPS_HOST}:3456/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VPS_DEPLOY_SECRET}`,
          },
          body: JSON.stringify({
            agent_id: id,
            action: vpsAction,
          }),
        });

        if (!vpsRes.ok) {
          const vpsErr = await vpsRes.text();
          console.error('[action] VPS error:', vpsErr);
          // Continue anyway for delete, might be already gone
          if (action !== 'delete') {
            return jsonError('VPS action failed', 500, vpsErr);
          }
        }
      } catch (vpsError) {
        console.error('[action] VPS connection error:', vpsError);
        if (action !== 'delete') {
          return jsonError('Failed to connect to VPS', 500);
        }
      }
    }

    // Update or delete in Supabase
    if (action === 'delete') {
      await supabase.request<any[]>(
        `hosted_agents?id=eq.${encodedId}`,
        { method: 'DELETE' }
      );
      return NextResponse.json({ success: true, deleted: id });
    }

    if (newStatus) {
      const updated = await supabase.request<any[]>(
        `hosted_agents?id=eq.${encodedId}&select=${AGENT_SELECT}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!updated || updated.length === 0) {
        return jsonError('Failed to update agent', 500);
      }

      return NextResponse.json(updated[0]);
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('[agents][id][action][POST] error:', error);
    return jsonError('Action failed', 500, error instanceof Error ? error.message : undefined);
  }
}
