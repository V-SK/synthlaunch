import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { xorDecrypt } from '@/lib/agentEncryption';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const AGENT_SELECT = 'id,user_address,name,description,plan,payment_method,payment_amount,status,created_at,expires_at,tx_hash,container_id';

const VPS_HOST = '45.76.180.239';
const VPS_USER = 'root';
const VPS_PASSWORD = process.env.VPS_PASSWORD || '';

function jsonError(message: string, status: number = 400, details?: string) {
  return NextResponse.json({ error: message, details }, { status });
}

async function deployToVPS(agentId: string, botToken: string, agentName: string): Promise<string> {
  // Use a simple HTTP endpoint on VPS instead of SSH
  // The VPS runs a small deploy server
  const response = await fetch(`http://${VPS_HOST}:3456/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VPS_DEPLOY_SECRET || 'synth-deploy-2026'}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      bot_token: botToken,
      agent_name: agentName,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VPS deploy failed: ${error}`);
  }

  const result = await response.json();
  return result.container_id || agentId;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request);
    const rl = rateLimit(`agents:id:deploy:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = await context.params;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);
    const agentRows = await supabase.request<any[]>(
      `hosted_agents?select=id,name,bot_token_encrypted,container_id,status&id=eq.${encodedId}&limit=1`
    );

    if (!agentRows || agentRows.length === 0) {
      return jsonError('Agent not found', 404);
    }

    const agent = agentRows[0];
    if (!agent.bot_token_encrypted) {
      return jsonError('Missing bot token', 400);
    }

    // Update status to deploying
    await supabase.request<any[]>(
      `hosted_agents?id=eq.${encodedId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deploying' }),
      }
    );

    const botToken = xorDecrypt(String(agent.bot_token_encrypted));
    
    try {
      const containerId = await deployToVPS(id, botToken, String(agent.name ?? 'SynthAgent'));

      const updated = await supabase.request<any[]>(
        `hosted_agents?id=eq.${encodedId}&select=${AGENT_SELECT}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ 
            container_id: containerId,
            status: 'running',
          }),
        }
      );

      if (!updated || updated.length === 0) {
        return jsonError('Failed to update agent', 500);
      }

      return NextResponse.json(updated[0]);
    } catch (deployError) {
      // Revert status on failure
      await supabase.request<any[]>(
        `hosted_agents?id=eq.${encodedId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending' }),
        }
      );
      throw deployError;
    }
  } catch (error) {
    console.error('[agents][id][deploy][POST] error:', error);
    return jsonError('Failed to deploy agent', 500, error instanceof Error ? error.message : undefined);
  }
}
