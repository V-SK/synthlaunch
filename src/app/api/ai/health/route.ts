import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAiAuthState } from '@/lib/ai/auth';
import { getLastLlmProbeResult, getLlmProviderStatus, probeLlmProvider } from '@/lib/llm';
import { isOkxConfigured, okxTokenSearch } from '@/lib/okx';
import type { AiHealthResponse } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

async function checkSupabase() {
  try {
    const client = createClient();
    await client.request<Array<{ wallet_address: string }>>(
      'ai_users?select=wallet_address&limit=1',
    );
    return {
      status: 'live' as const,
      detail: 'Supabase AI tables reachable.',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
    };
  } catch (error) {
    return {
      status: 'degraded' as const,
      detail: error instanceof Error ? error.message : 'Supabase unavailable',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
    };
  }
}

async function checkOkx() {
  if (!isOkxConfigured()) {
    return {
      status: 'unconfigured' as const,
      detail: 'OKX credentials are not configured.',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
    };
  }

  const startedAt = Date.now();
  try {
    await okxTokenSearch('OKB');
    return {
      status: 'live' as const,
      detail: 'OKX search probe succeeded.',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      status: 'degraded' as const,
      detail: error instanceof Error ? error.message : 'OKX probe failed',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function GET() {
  const auth = getAiAuthState();
  const [supabase, okx] = await Promise.all([checkSupabase(), checkOkx()]);

  let llm = getLlmProviderStatus();
  try {
    llm = await probeLlmProvider();
  } catch {
    llm = getLastLlmProbeResult();
  }

  const payload: AiHealthResponse = {
    auth,
    llm,
    okx,
    supabase,
  };

  return NextResponse.json(payload);
}
