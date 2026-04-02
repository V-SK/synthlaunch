import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { AiHealthStatus, AiLlmSource } from '@/lib/ai/types';

type SupportedProvider = 'openai' | 'openai-codex';

type LlmConfig = {
  provider: SupportedProvider;
  baseUrl: string;
  apiKey?: string;
  model: string;
  authFile?: string;
  authProfile?: string;
  accountId?: string;
};

type AuthProfileRecord = {
  access?: string;
  token?: string;
  accountId?: string;
};

export type LlmResponse = {
  content: string;
  source: Exclude<AiLlmSource, 'heuristic'>;
  provider: SupportedProvider;
};

type LlmProbeResult = AiHealthStatus & {
  provider: SupportedProvider;
  source?: AiLlmSource | null;
};

const DEFAULT_CODEX_AUTH_FILE =
  '~/.openclaw/agents/main/agent/auth-profiles.json';
const DEFAULT_PROBE_RESULT: LlmProbeResult = {
  status: 'unconfigured',
  provider: 'openai',
  source: null,
  detail: 'Provider probe has not run yet.',
  checkedAt: null,
  latencyMs: null,
};
let lastProbeResult: LlmProbeResult = DEFAULT_PROBE_RESULT;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized.padEnd(normalized.length + (4 - (normalized.length % 4)), '=');

  return Buffer.from(padded, 'base64').toString('utf8');
}

function extractAccountId(token: string): string | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const parsed = JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>;
    const auth = parsed['https://api.openai.com/auth'] as
      | Record<string, unknown>
      | undefined;
    const accountId = auth?.chatgpt_account_id;
    return typeof accountId === 'string' && accountId.length > 0
      ? accountId
      : undefined;
  } catch {
    return undefined;
  }
}

function resolveCodexUrl(baseUrl?: string): string {
  const raw = baseUrl?.trim() || 'https://chatgpt.com/backend-api';
  const normalized = raw.replace(/\/+$/, '');
  if (normalized.endsWith('/codex/responses')) return normalized;
  if (normalized.endsWith('/codex')) return `${normalized}/responses`;
  return `${normalized}/codex/responses`;
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `codex_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildInput(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: [
        {
          type: message.role === 'assistant' ? 'output_text' : 'input_text',
          text: message.content,
        },
      ],
    }));
}

function buildInstructions(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
) {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

async function resolveCodexAuth(config: LlmConfig): Promise<{
  apiKey: string;
  accountId?: string;
}> {
  if (config.apiKey) {
    return {
      apiKey: config.apiKey,
      accountId: config.accountId ?? extractAccountId(config.apiKey),
    };
  }

  const authFile = (config.authFile?.trim() || DEFAULT_CODEX_AUTH_FILE).replace(
    /^~(?=$|\/)/,
    homedir(),
  );
  const raw = await readFile(authFile, 'utf8');
  const parsed = JSON.parse(raw) as {
    profiles?: Record<string, AuthProfileRecord>;
  };

  const profileName = config.authProfile?.trim();
  const candidateNames = [
    profileName,
    'openai-codex:default',
    'openai:codex',
    'openai-codex',
    'default',
  ].filter(Boolean) as string[];

  let profile: AuthProfileRecord | undefined;
  for (const candidate of candidateNames) {
    profile = parsed.profiles?.[candidate];
    if (profile) break;
  }

  if (!profile && parsed.profiles) {
    const fallback = Object.entries(parsed.profiles).find(([key]) =>
      key.includes('codex') || key.includes('openai'),
    );
    profile = fallback?.[1];
  }

  const apiKey = profile?.access ?? profile?.token;
  if (!apiKey) {
    throw new Error('Codex auth profile did not contain an access token');
  }

  return {
    apiKey,
    accountId:
      config.accountId ?? profile?.accountId ?? extractAccountId(apiKey),
  };
}

async function callOpenAiChat(
  config: LlmConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<LlmResponse> {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('No OpenAI API key configured');
  }

  const response = await fetch(
    `${config.baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages,
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'OpenAI request failed');
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return {
    content: data.choices?.[0]?.message?.content?.trim() ?? '',
    source: 'openai',
    provider: 'openai',
  };
}

async function callCodexChat(
  config: LlmConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<LlmResponse> {
  const auth = await resolveCodexAuth(config);
  const response = await fetch(resolveCodexUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.apiKey}`,
      ...(auth.accountId ? { 'chatgpt-account-id': auth.accountId } : {}),
      'content-type': 'application/json',
      accept: 'text/event-stream',
      'OpenAI-Beta': 'responses=experimental',
      originator: 'pi',
      session_id: createRequestId(),
      'user-agent': 'synthlaunch-ai',
    },
    body: JSON.stringify({
      model: config.model,
      store: false,
      stream: true,
      instructions: buildInstructions(messages),
      input: buildInput(messages),
    }),
    cache: 'no-store',
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Codex request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')
        .trim();

      if (!data || data === '[DONE]') continue;

      const event = JSON.parse(data) as Record<string, unknown>;
      if (
        event.type === 'response.output_text.delta' &&
        typeof event.delta === 'string'
      ) {
        content += event.delta;
      }
      if (event.type === 'response.completed' || event.type === 'response.done') {
        return {
          content: content.trim(),
          source: 'codex',
          provider: 'openai-codex',
        };
      }
      if (event.type === 'response.failed') {
        const message = (event.response as { error?: { message?: string } } | undefined)
          ?.error?.message;
        throw new Error(message || 'Codex response failed');
      }
    }
  }

  return {
    content: content.trim(),
    source: 'codex',
    provider: 'openai-codex',
  };
}

export function getLlmConfig(): LlmConfig {
  const provider =
    (process.env.SYNTH_AI_PROVIDER as SupportedProvider | undefined) ??
    (process.env.COCO_LLM_PROVIDER as SupportedProvider | undefined) ??
    'openai';

  if (provider === 'openai-codex') {
    return {
      provider,
      baseUrl:
        process.env.SYNTH_AI_BASE_URL ??
        process.env.COCO_LLM_BASE_URL ?? 'https://chatgpt.com/backend-api',
      apiKey: process.env.SYNTH_AI_API_KEY ?? process.env.COCO_LLM_API_KEY,
      model: process.env.SYNTH_AI_MODEL ?? process.env.COCO_LLM_MODEL ?? 'gpt-5.4',
      authFile: process.env.SYNTH_AI_AUTH_FILE ?? process.env.COCO_LLM_AUTH_FILE,
      authProfile:
        process.env.SYNTH_AI_AUTH_PROFILE ?? process.env.COCO_LLM_AUTH_PROFILE,
      accountId:
        process.env.SYNTH_AI_ACCOUNT_ID ?? process.env.COCO_LLM_ACCOUNT_ID,
    };
  }

  return {
    provider: 'openai',
    baseUrl:
      process.env.SYNTH_AI_BASE_URL ??
      process.env.COCO_LLM_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      'https://api.openai.com/v1',
    apiKey:
      process.env.SYNTH_AI_API_KEY ??
      process.env.COCO_LLM_API_KEY ??
      process.env.OPENAI_API_KEY,
    model:
      process.env.SYNTH_AI_MODEL ??
      process.env.COCO_LLM_MODEL ??
      process.env.OPENAI_MODEL ??
      'gpt-4o-mini',
  };
}

export async function llmJsonResponse(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<LlmResponse> {
  const config = getLlmConfig();
  if (config.provider === 'openai-codex') {
    return await callCodexChat(config, messages);
  }
  return await callOpenAiChat(config, messages);
}

function setProbeResult(result: LlmProbeResult) {
  lastProbeResult = {
    ...result,
    checkedAt: result.checkedAt ?? new Date().toISOString(),
  };
}

export function getLastLlmProbeResult(): LlmProbeResult {
  return lastProbeResult;
}

export function getLlmProviderStatus(): LlmProbeResult {
  const config = getLlmConfig();
  const configured =
    config.provider === 'openai-codex'
      ? Boolean(config.apiKey || config.authFile || DEFAULT_CODEX_AUTH_FILE)
      : Boolean(config.apiKey ?? process.env.OPENAI_API_KEY);

  if (!configured) {
    return {
      status: 'unconfigured',
      provider: config.provider,
      source: null,
      detail: 'LLM credentials are not configured.',
      checkedAt: lastProbeResult.checkedAt ?? null,
      latencyMs: lastProbeResult.latencyMs ?? null,
    };
  }

  return {
    ...lastProbeResult,
    provider: config.provider,
  };
}

export async function probeLlmProvider(): Promise<LlmProbeResult> {
  const startedAt = Date.now();
  try {
    const response = await llmJsonResponse([
      {
        role: 'system',
        content: 'Return JSON with key ping and exact value pong.',
      },
      {
        role: 'user',
        content: 'Return exactly {"ping":"pong"} and nothing else.',
      },
    ]);

    const valid = response.content.trim() === '{"ping":"pong"}';
    const result: LlmProbeResult = valid
      ? {
          status: 'live',
          provider: response.provider,
          source: response.source,
          detail: 'LLM provider responded with the expected JSON payload.',
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
        }
      : {
          status: 'degraded',
          provider: response.provider,
          source: response.source,
          detail: `Unexpected probe payload: ${response.content.slice(0, 120)}`,
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
        };

    setProbeResult(result);
    return result;
  } catch (error) {
    const result: LlmProbeResult = {
      status: 'degraded',
      provider: getLlmConfig().provider,
      source: null,
      detail: error instanceof Error ? error.message : 'LLM probe failed',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
    setProbeResult(result);
    throw error;
  }
}
