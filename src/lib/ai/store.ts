import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase';
import type {
  AiActionLogEntry,
  AiMessage,
  AiMessageMetadata,
  AiSession,
  AiUserPreferences,
  AiUserProfile,
  AiWatchToken,
} from '@/lib/ai/types';

const DEFAULT_PREFERENCES: AiUserPreferences = {
  riskBias: 'balanced',
  preferredQuoteToken: 'USDT',
};

type SupabaseLike = ReturnType<typeof createClient>;

type AiUserRow = {
  wallet_address: string;
  risk_bias?: AiUserPreferences['riskBias'];
  preferred_quote_token?: AiUserPreferences['preferredQuoteToken'];
  watchlist?: AiWatchToken[] | null;
  last_session_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AiSessionRow = {
  id: string;
  wallet_address: string;
  chain_id: number;
  title?: string | null;
  created_at?: string;
  last_message_at?: string;
};

type AiMessageRow = {
  id: string;
  session_id: string;
  wallet_address: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: AiMessageMetadata | null;
  created_at?: string;
};

type AiActionRow = {
  id: string;
  session_id: string;
  wallet_address: string;
  action_type: string;
  status: string;
  tx_hash?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string;
};

type AiAuthNonceRow = {
  nonce: string;
  wallet_address: string;
  message: string;
  expires_at: string;
  consumed_at?: string | null;
  created_at?: string;
};

const inMemoryAuthNonces = new Map<
  string,
  { walletAddress: string; message: string; expiresAt: string; consumedAt?: string | null }
>();

function getSupabaseClient(): SupabaseLike | null {
  try {
    return createClient();
  } catch {
    return null;
  }
}

function normalizeWallet(walletAddress: string): string {
  return walletAddress.trim().toLowerCase();
}

function mapUserRow(row: AiUserRow | null, walletAddress: string, persistenceEnabled: boolean): AiUserProfile {
  return {
    walletAddress,
    riskBias: row?.risk_bias ?? DEFAULT_PREFERENCES.riskBias,
    preferredQuoteToken:
      row?.preferred_quote_token ?? DEFAULT_PREFERENCES.preferredQuoteToken,
    watchlist: Array.isArray(row?.watchlist) ? row!.watchlist : [],
    lastSessionId: row?.last_session_id ?? null,
    persistenceEnabled,
  };
}

function mapSessionRow(row: AiSessionRow, walletAddress: string): AiSession {
  return {
    id: row.id,
    walletAddress,
    chainId: row.chain_id ?? 196,
    title: row.title ?? 'OKX AI Session',
    createdAt: row.created_at ?? new Date().toISOString(),
    lastMessageAt: row.last_message_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function mapMessageRow(row: AiMessageRow): AiMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    walletAddress: row.wallet_address,
    role: row.role,
    content: row.content,
    createdAt: row.created_at ?? new Date().toISOString(),
    metadata: row.metadata ?? null,
  };
}

function mapActionRow(row: AiActionRow): AiActionLogEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    walletAddress: row.wallet_address,
    actionType: row.action_type,
    status: row.status,
    txHash: row.tx_hash ?? null,
    payload: row.payload ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export async function ensureAiUser(walletAddress: string): Promise<AiUserProfile> {
  const wallet = normalizeWallet(walletAddress);
  const client = getSupabaseClient();
  if (!client) {
    return mapUserRow(null, wallet, false);
  }

  const existing = await client
    .request<AiUserRow[]>(
      `ai_users?wallet_address=eq.${wallet}&select=wallet_address,risk_bias,preferred_quote_token,watchlist,last_session_id&limit=1`,
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });

  if (existing.length > 0) {
    return mapUserRow(existing[0] ?? null, wallet, true);
  }

  const created = await client
    .request<AiUserRow[]>(
      'ai_users?on_conflict=wallet_address',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          wallet_address: wallet,
          risk_bias: DEFAULT_PREFERENCES.riskBias,
          preferred_quote_token: DEFAULT_PREFERENCES.preferredQuoteToken,
          watchlist: [],
        }),
      },
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });

  return mapUserRow(created[0] ?? null, wallet, true);
}

export async function updateAiUser(
  walletAddress: string,
  patch: Partial<AiUserPreferences> & {
    watchlist?: AiWatchToken[];
    lastSessionId?: string;
  },
): Promise<AiUserProfile> {
  const wallet = normalizeWallet(walletAddress);
  const current = await ensureAiUser(wallet);
  const client = getSupabaseClient();
  if (!client) {
    return {
      ...current,
      ...patch,
      watchlist: patch.watchlist ?? current.watchlist,
      lastSessionId: patch.lastSessionId ?? current.lastSessionId ?? null,
      persistenceEnabled: false,
    };
  }

  const rows = await client.request<AiUserRow[]>(
    'ai_users?on_conflict=wallet_address',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        wallet_address: wallet,
        risk_bias: patch.riskBias ?? current.riskBias,
        preferred_quote_token:
          patch.preferredQuoteToken ?? current.preferredQuoteToken,
        watchlist: patch.watchlist ?? current.watchlist,
        last_session_id: patch.lastSessionId ?? current.lastSessionId ?? null,
      }),
    },
  );

  return mapUserRow(rows[0] ?? null, wallet, true);
}

export async function getOrCreateAiSession(
  walletAddress: string,
  sessionId?: string | null,
): Promise<{ user: AiUserProfile; session: AiSession }> {
  const wallet = normalizeWallet(walletAddress);
  const user = await ensureAiUser(wallet);
  const client = getSupabaseClient();

  if (!client) {
    const id = sessionId && sessionId.length > 0 ? sessionId : randomUUID();
    return {
      user,
      session: {
        id,
        walletAddress: wallet,
        chainId: 196,
        title: 'OKX AI Session',
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      },
    };
  }

  if (sessionId) {
    const existing = await client
      .request<AiSessionRow[]>(
        `ai_sessions?id=eq.${sessionId}&wallet_address=eq.${wallet}&select=id,wallet_address,chain_id,title,created_at,last_message_at&limit=1`,
      )
      .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });
    if (existing.length > 0) {
      const session = mapSessionRow(existing[0]!, wallet);
      await updateAiUser(wallet, { lastSessionId: session.id });
      return { user, session };
    }
  }

  const latest = await client
    .request<AiSessionRow[]>(
      `ai_sessions?wallet_address=eq.${wallet}&select=id,wallet_address,chain_id,title,created_at,last_message_at&order=last_message_at.desc&limit=1`,
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });

  if (latest.length > 0) {
    const session = mapSessionRow(latest[0]!, wallet);
    await updateAiUser(wallet, { lastSessionId: session.id });
    return { user, session };
  }

  const created = await client.request<AiSessionRow[]>(
    'ai_sessions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        wallet_address: wallet,
        chain_id: 196,
        title: 'OKX AI Session',
      }),
    },
  );

  const session = mapSessionRow(created[0]!, wallet);
  await updateAiUser(wallet, { lastSessionId: session.id });
  return { user, session };
}

export async function getAiHistory(
  walletAddress: string,
  sessionId: string,
): Promise<{ messages: AiMessage[]; actions: AiActionLogEntry[] }> {
  const wallet = normalizeWallet(walletAddress);
  const client = getSupabaseClient();
  if (!client) {
    return { messages: [], actions: [] };
  }

  const [messages, actions] = await Promise.all([
    client
      .request<AiMessageRow[]>(
        `ai_messages?wallet_address=eq.${wallet}&session_id=eq.${sessionId}&select=id,session_id,wallet_address,role,content,metadata,created_at&order=created_at.asc&limit=200`,
      )
      .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; }),
    client
      .request<AiActionRow[]>(
        `ai_actions?wallet_address=eq.${wallet}&session_id=eq.${sessionId}&select=id,session_id,wallet_address,action_type,status,tx_hash,payload,created_at&order=created_at.desc&limit=50`,
      )
      .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; }),
  ]);

  return {
    messages: messages.map(mapMessageRow),
    actions: actions.map(mapActionRow),
  };
}

export async function insertAiMessage(input: {
  sessionId: string;
  walletAddress: string;
  role: AiMessage['role'];
  content: string;
  metadata?: AiMessageMetadata | null;
}): Promise<AiMessage> {
  const wallet = normalizeWallet(input.walletAddress);
  const client = getSupabaseClient();
  const fallback: AiMessage = {
    id: randomUUID(),
    sessionId: input.sessionId,
    walletAddress: wallet,
    role: input.role,
    content: input.content,
    createdAt: new Date().toISOString(),
    metadata: input.metadata ?? null,
  };

  if (!client) {
    return fallback;
  }

  const rows = await client
    .request<AiMessageRow[]>(
      'ai_messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          session_id: input.sessionId,
          wallet_address: wallet,
          role: input.role,
          content: input.content,
          metadata: input.metadata ?? {},
        }),
      },
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });

  await touchAiSession(input.sessionId);
  return rows[0] ? mapMessageRow(rows[0]) : fallback;
}

export async function recordAiAction(input: {
  sessionId: string;
  walletAddress: string;
  actionType: string;
  status: string;
  txHash?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<AiActionLogEntry> {
  const wallet = normalizeWallet(input.walletAddress);
  const client = getSupabaseClient();
  const fallback: AiActionLogEntry = {
    id: randomUUID(),
    sessionId: input.sessionId,
    walletAddress: wallet,
    actionType: input.actionType,
    status: input.status,
    txHash: input.txHash ?? null,
    payload: input.payload ?? null,
    createdAt: new Date().toISOString(),
  };

  if (!client) {
    return fallback;
  }

  const rows = await client
    .request<AiActionRow[]>(
      'ai_actions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          session_id: input.sessionId,
          wallet_address: wallet,
          action_type: input.actionType,
          status: input.status,
          tx_hash: input.txHash ?? null,
          payload: input.payload ?? {},
        }),
      },
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });

  await touchAiSession(input.sessionId);
  return rows[0] ? mapActionRow(rows[0]) : fallback;
}

export async function updateAiAction(
  actionId: string,
  walletAddress: string,
  patch: {
    status?: string;
    txHash?: string | null;
    payload?: Record<string, unknown> | null;
  },
): Promise<AiActionLogEntry | null> {
  const wallet = normalizeWallet(walletAddress);
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const rows = await client
    .request<AiActionRow[]>(
      `ai_actions?id=eq.${actionId}&wallet_address=eq.${wallet}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          ...(patch.status ? { status: patch.status } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, 'txHash')
            ? { tx_hash: patch.txHash ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, 'payload')
            ? { payload: patch.payload ?? {} }
            : {}),
        }),
      },
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });

  return rows[0] ? mapActionRow(rows[0]) : null;
}

export async function touchAiSession(sessionId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  await client
    .request<AiSessionRow[]>(
      `ai_sessions?id=eq.${sessionId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ last_message_at: new Date().toISOString() }),
      },
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return undefined; });
}

export async function createAiAuthNonceRecord(input: {
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: string;
}): Promise<boolean> {
  const wallet = normalizeWallet(input.walletAddress);
  const client = getSupabaseClient();
  if (!client) {
    inMemoryAuthNonces.set(input.nonce, {
      walletAddress: wallet,
      message: input.message,
      expiresAt: input.expiresAt,
      consumedAt: null,
    });
    return true;
  }

  await client
    .request<AiAuthNonceRow[]>(
      `ai_auth_nonces?wallet_address=eq.${normalizeWallet(input.walletAddress)}`,
      {
        method: 'DELETE',
        headers: {
          Prefer: 'return=minimal',
        },
      },
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return undefined; });

  const rows = await client
    .request<AiAuthNonceRow[]>(
      'ai_auth_nonces',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          nonce: input.nonce,
          wallet_address: wallet,
          message: input.message,
          expires_at: input.expiresAt,
        }),
      },
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });

  if (rows.length === 0) {
    inMemoryAuthNonces.set(input.nonce, {
      walletAddress: wallet,
      message: input.message,
      expiresAt: input.expiresAt,
      consumedAt: null,
    });
  }

  return rows.length > 0 || inMemoryAuthNonces.has(input.nonce);
}

export async function consumeAiAuthNonceRecord(input: {
  walletAddress: string;
  nonce: string;
}): Promise<{
  message: string;
  expiresAt: string;
} | null> {
  const client = getSupabaseClient();
  if (!client) {
    const localRecord = inMemoryAuthNonces.get(input.nonce);
    if (
      !localRecord ||
      localRecord.walletAddress !== normalizeWallet(input.walletAddress) ||
      localRecord.consumedAt ||
      Date.parse(localRecord.expiresAt) <= Date.now()
    ) {
      return null;
    }
    localRecord.consumedAt = new Date().toISOString();
    return {
      message: localRecord.message,
      expiresAt: localRecord.expiresAt,
    };
  }

  const wallet = normalizeWallet(input.walletAddress);
  const rows = await client
    .request<AiAuthNonceRow[]>(
      `ai_auth_nonces?nonce=eq.${input.nonce}&wallet_address=eq.${wallet}&select=nonce,wallet_address,message,expires_at,consumed_at,created_at&limit=1`,
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return []; });

  const row = rows[0];
  if (!row || row.consumed_at || Date.parse(row.expires_at) <= Date.now()) {
    const localRecord = inMemoryAuthNonces.get(input.nonce);
    if (
      !localRecord ||
      localRecord.walletAddress !== wallet ||
      localRecord.consumedAt ||
      Date.parse(localRecord.expiresAt) <= Date.now()
    ) {
      return null;
    }
    localRecord.consumedAt = new Date().toISOString();
    return {
      message: localRecord.message,
      expiresAt: localRecord.expiresAt,
    };
  }

  await client
    .request<AiAuthNonceRow[]>(
      `ai_auth_nonces?nonce=eq.${input.nonce}&wallet_address=eq.${wallet}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          consumed_at: new Date().toISOString(),
        }),
      },
    )
    .catch((err) => { console.error('[ai/store] supabase request failed', err); return undefined; });

  return {
    message: row.message,
    expiresAt: row.expires_at,
  };
}

export function mergeWatchTokens(
  current: AiWatchToken[],
  additions: AiWatchToken[],
): AiWatchToken[] {
  const seen = new Map<string, AiWatchToken>();
  for (const item of current) {
    if (item.address) {
      seen.set(item.address.toLowerCase(), item);
    }
  }
  for (const item of additions) {
    if (item.address) {
      seen.set(item.address.toLowerCase(), item);
    }
  }
  return Array.from(seen.values()).slice(0, 24);
}
