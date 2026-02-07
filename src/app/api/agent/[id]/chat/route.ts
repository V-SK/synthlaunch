import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, type Address } from 'viem';
import { bsc } from 'viem/chains';
import { NFALITE_ABI, ZERO_ADDRESS } from '@/lib/nfaLite';
import { ERC20_ABI } from '@/lib/erc20';
import { verifySignature, isTimestampValid } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const NFALITE_CONTRACT = (process.env.NFALITE_CONTRACT || process.env.NEXT_PUBLIC_NFALITE_CONTRACT || ZERO_ADDRESS) as Address;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org', { batch: true }),
});

function buildChatMessage(agentId: number, message: string, timestamp?: number) {
  if (timestamp) {
    return `SynthLaunch Agent Chat\n\nAgent ID: ${agentId}\nMessage: ${message}\nTimestamp: ${timestamp}`;
  }
  return `SynthLaunch Agent Chat\n\nAgent ID: ${agentId}\nMessage: ${message}`;
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

async function fetchAgentConfig(agentId: number) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/agents?nfa_id=eq.${agentId}&select=name,avatar_url,persona_prompt,tone,language,chat_threshold,token_address`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: 'no-store',
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

async function hasTokenBalance(token: Address, wallet: Address, threshold: number) {
  const [balance, decimals] = await Promise.all([
    client.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [wallet] }) as Promise<bigint>,
    client.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18) as Promise<number | bigint>,
  ]);
  const decimalsNum = typeof decimals === 'bigint' ? Number(decimals) : (typeof decimals === 'number' ? decimals : 18);
  const required = BigInt(threshold) * 10n ** BigInt(decimalsNum);
  return { ok: balance >= required, required, balance, decimals: decimalsNum };
}

/**
 * POST /api/agent/[id]/chat
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
    const { message, wallet, signature, timestamp } = body as {
      message: string;
      wallet: `0x${string}`;
      signature: `0x${string}`;
      timestamp?: number;
    };

    if (!message || !wallet || !signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let signer: string;
    if (timestamp) {
      if (!isTimestampValid(timestamp)) {
        return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
      }
      const signedMessage = buildChatMessage(agentId, message, timestamp);
      signer = await verifySignature(signedMessage, signature);
    } else {
      const signedMessage = buildChatMessage(agentId, message);
      signer = await verifySignature(signedMessage, signature);
    }

    if (signer.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 401 });
    }

    const agentOnChain = await fetchAgentOnChain(agentId);
    if (!agentOnChain.token || agentOnChain.token === ZERO_ADDRESS) {
      return NextResponse.json({ error: 'Agent token not configured' }, { status: 400 });
    }

    const config = await fetchAgentConfig(agentId);
    const threshold = Number(config?.chat_threshold ?? 1000);

    const balanceCheck = await hasTokenBalance(agentOnChain.token, wallet as Address, threshold);
    if (!balanceCheck.ok) {
      return NextResponse.json(
        { error: `Insufficient balance. Need at least ${threshold} tokens.` },
        { status: 403 }
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const persona = config?.persona_prompt || 'You are a friendly AI agent.';
    const tone = config?.tone || 'friendly';
    const language = config?.language || 'zh';
    const agentName = config?.name || agentOnChain.name || `Agent #${agentId}`;

    const systemPrompt = [
      `You are ${agentName}.`,
      `Persona: ${persona}`,
      `Tone: ${tone}`,
      `Language: ${language}`,
      'Reply concisely and stay in character.',
    ].join('\n');

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.8,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return NextResponse.json({ error: text || 'AI request failed' }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const reply = aiData?.choices?.[0]?.message?.content?.trim() || '...';

    return NextResponse.json({
      reply,
      agent: {
        name: agentName,
        avatar: config?.avatar_url || agentOnChain.avatarURI || '',
      },
    }, { status: 200 });
  } catch (error) {
    console.error('POST /api/agent/[id]/chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
