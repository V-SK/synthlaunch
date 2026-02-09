import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@/lib/supabase';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { xorDecrypt } from '@/lib/agentEncryption';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const AGENT_SELECT = 'id,user_address,name,description,plan,payment_method,payment_amount,status,created_at,expires_at,tx_hash,container_id';
const execFileAsync = promisify(execFile);

function jsonError(message: string, status: number = 400, details?: string) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const ip = getClientIP(request);
    const rl = rateLimit(`agents:id:deploy:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const id = context.params?.id;
    if (!id) {
      return jsonError('Missing id', 400);
    }

    const supabase = createClient();
    const encodedId = encodeURIComponent(id);
    const agentRows = await supabase.request<any[]>(
      `hosted_agents?select=id,name,bot_token_encrypted,container_id&` +
        `id=eq.${encodedId}&limit=1`
    );

    if (!agentRows || agentRows.length === 0) {
      return jsonError('Agent not found', 404);
    }

    const agent = agentRows[0];
    if (!agent.bot_token_encrypted) {
      return jsonError('Missing bot token', 400);
    }

    const botToken = xorDecrypt(String(agent.bot_token_encrypted));
    const scriptPath = path.join(process.cwd(), 'scripts', 'deploy-agent.sh');

    const { stdout } = await execFileAsync(scriptPath, [id, botToken, String(agent.name ?? '')], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });

    const containerId = stdout.trim().split('\n').pop()?.trim();
    if (!containerId) {
      return jsonError('Failed to deploy agent', 500);
    }

    const updated = await supabase.request<any[]>(
      `hosted_agents?id=eq.${encodedId}&select=${AGENT_SELECT}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ container_id: containerId }),
      }
    );

    if (!updated || updated.length === 0) {
      return jsonError('Failed to update agent', 500);
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('[agents][id][deploy][POST] error:', error);
    return jsonError('Failed to deploy agent', 500);
  }
}
