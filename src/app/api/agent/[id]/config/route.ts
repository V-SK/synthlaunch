import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, type Address } from 'viem';
import { bsc } from '@/lib/chains';
import { NFALITE_ABI, ZERO_ADDRESS } from '@/lib/nfaLite';
import { verifySignature, isNFALiteOwner, isTimestampValid } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const NFALITE_CONTRACT = (process.env.NFALITE_CONTRACT || process.env.NEXT_PUBLIC_NFALITE_CONTRACT || ZERO_ADDRESS) as Address;

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org', { batch: true }),
});

function buildSettingsMessage(agentId: number, timestamp: number) {
  return `SynthLaunch Agent Settings\n\nAgent ID: ${agentId}\nTimestamp: ${timestamp}`;
}

async function fetchAgentOnChain(agentId: number) {
  const data = await client.readContract({
    address: NFALITE_CONTRACT,
    abi: NFALITE_ABI,
    functionName: 'agents',
    args: [BigInt(agentId)],
  });
  const [name, avatarURI, vault, wallet, creator, createdAt, token] = data as [
    string,
    string,
    Address,
    Address,
    Address,
    bigint,
    Address
  ];
  return { name, avatarURI, vault, wallet, creator, createdAt, token };
}

/**
 * GET /api/agent/[id]/config
 * Public agent config
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agentId = Number(params.id);
    if (!Number.isFinite(agentId) || agentId <= 0) {
      return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });
    }

    const agentOnChain = NFALITE_CONTRACT !== ZERO_ADDRESS
      ? await fetchAgentOnChain(agentId)
      : { name: '', avatarURI: '', token: '' as Address };

    let config: any = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/agents?nfa_id=eq.${agentId}&select=token_address,name,avatar_url,persona_prompt,tone,language,chat_threshold,owner_address,tier,total_chats,created_at,updated_at`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          cache: 'no-store',
        }
      );
      if (res.ok) {
        const rows = await res.json();
        config = rows?.[0] || null;
      }
    }

    const publicAgent = {
      name: config?.name || agentOnChain.name || `Agent #${agentId}`,
      avatar_url: config?.avatar_url || agentOnChain.avatarURI || null,
      token_address: config?.token_address || agentOnChain.token || null,
    };

    const safeConfig = config
      ? {
          name: config.name,
          avatar_url: config.avatar_url,
          persona_prompt: config.persona_prompt,
          tone: config.tone,
          language: config.language,
          chat_threshold: config.chat_threshold,
        }
      : {
          name: publicAgent.name,
          avatar_url: publicAgent.avatar_url,
          persona_prompt: 'You are a friendly AI agent.',
          tone: 'friendly',
          language: 'zh',
          chat_threshold: 1000,
        };

    return NextResponse.json({ agent: publicAgent, config: safeConfig }, { status: 200 });
  } catch (error) {
    console.error('GET /api/agent/[id]/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/agent/[id]/config
 * Update agent config (NFALite owner only)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agentId = Number(params.id);
    if (!Number.isFinite(agentId) || agentId <= 0) {
      return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });
    }

    if (NFALITE_CONTRACT === ZERO_ADDRESS) {
      return NextResponse.json({ error: 'NFALite contract not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { config, signature, timestamp } = body as {
      config: {
        name?: string;
        avatar_url?: string;
        persona_prompt?: string;
        tone?: string;
        language?: string;
        chat_threshold?: number;
      };
      signature: `0x${string}`;
      timestamp: number;
    };

    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    if (!isTimestampValid(timestamp)) {
      return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
    }

    const message = buildSettingsMessage(agentId, timestamp);
    const signer = await verifySignature(message, signature);

    const isOwner = await isNFALiteOwner(NFALITE_CONTRACT, agentId, signer);
    if (!isOwner) {
      return NextResponse.json({ error: 'Not the owner of this NFA' }, { status: 403 });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const agentOnChain = await fetchAgentOnChain(agentId);

    const payload = {
      token_address: agentOnChain.token.toLowerCase(),
      nfa_id: agentId,
      name: config?.name || agentOnChain.name || 'Agent',
      avatar_url: config?.avatar_url || agentOnChain.avatarURI || null,
      persona_prompt: config?.persona_prompt || 'You are a friendly AI agent.',
      tone: config?.tone || 'friendly',
      language: config?.language || 'zh',
      chat_threshold: Number(config?.chat_threshold ?? 1000),
      owner_address: signer.toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/agents?on_conflict=token_address`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || 'Supabase error' }, { status: res.status });
    }

    const rows = await res.json();
    return NextResponse.json({ success: true, config: rows?.[0] || payload }, { status: 200 });
  } catch (error) {
    console.error('POST /api/agent/[id]/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
