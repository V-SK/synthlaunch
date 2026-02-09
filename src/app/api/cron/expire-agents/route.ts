import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const VPS_HOST = '45.76.180.239';
const VPS_DEPLOY_SECRET = process.env.VPS_DEPLOY_SECRET || 'synth-deploy-2026';

async function stopOnVps(agentId: string) {
  const response = await fetch(`http://${VPS_HOST}:3456/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VPS_DEPLOY_SECRET}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      action: 'stop',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'VPS stop failed');
  }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const encodedNow = encodeURIComponent(nowIso);

    const agents = await supabase.request<any[]>(
      `hosted_agents?select=id,expires_at,status&status=eq.running&expires_at=lt.${encodedNow}`
    );

    let expired = 0;
    const failures: { id: string; error: string }[] = [];

    for (const agent of agents || []) {
      let stopError: string | null = null;
      try {
        await stopOnVps(agent.id);
      } catch (error) {
        stopError = error instanceof Error ? error.message : 'Unknown error';
      }

      try {
        const encodedId = encodeURIComponent(agent.id);
        await supabase.request<any[]>(
          `hosted_agents?id=eq.${encodedId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'expired' }),
          }
        );
        expired += 1;
      } catch (error) {
        failures.push({
          id: agent.id,
          error: error instanceof Error ? error.message : 'Failed to update status',
        });
        continue;
      }

      if (stopError) {
        failures.push({
          id: agent.id,
          error: stopError,
        });
      }
    }

    return NextResponse.json(
      {
        checked: agents?.length ?? 0,
        expired,
        failed: failures.length,
        failures,
        ran_at: nowIso,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[cron][expire-agents] error:', error);
    return NextResponse.json(
      { error: 'Failed to expire agents', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
