import { NextRequest, NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/crypto';
import { verifySignature, isNFALiteOwner, createConfigMessage, isTimestampValid } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const NFALITE_CONTRACT = process.env.NFALITE_CONTRACT as `0x${string}` || '0x0000000000000000000000000000000000000000';

interface AgentConfig {
  nfa_id: number;
  token_address: string;
  vault_address: string;
  agent_wallet: string;
  ai_provider?: string;
  ai_api_key?: string;  // Will be encrypted before storage
  ai_model?: string;
  strategy?: string;
  auto_notify?: boolean;
  notify_threshold?: number;
  telegram_bot_token?: string;  // Will be encrypted
  telegram_chat_id?: string;
  owner_address: string;
}

/**
 * GET /api/agent/config?nfaId=X
 * Get agent configuration (requires signature verification)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nfaId = searchParams.get('nfaId');
    const signature = request.headers.get('x-signature') as `0x${string}` | null;
    const timestamp = parseInt(request.headers.get('x-timestamp') || '0');

    if (!nfaId) {
      return NextResponse.json({ error: 'nfaId is required' }, { status: 400 });
    }

    // Verify signature for sensitive data
    if (signature && timestamp) {
      if (!isTimestampValid(timestamp)) {
        return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
      }

      const message = createConfigMessage(parseInt(nfaId), 'read', timestamp);
      const signer = await verifySignature(message, signature);
      
      // Check ownership
      const isOwner = await isNFALiteOwner(NFALITE_CONTRACT, parseInt(nfaId), signer);
      if (!isOwner) {
        return NextResponse.json({ error: 'Not the owner of this NFA' }, { status: 403 });
      }
    }

    // Fetch from Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_configs?nfa_id=eq.${nfaId}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch config');
    }

    const configs = await response.json();
    
    if (configs.length === 0) {
      return NextResponse.json({ config: null }, { status: 200 });
    }

    const config = configs[0];
    
    // Don't return encrypted keys in response (mask them)
    const safeConfig = {
      ...config,
      ai_api_key_encrypted: config.ai_api_key_encrypted ? '***encrypted***' : null,
      telegram_bot_token_encrypted: config.telegram_bot_token_encrypted ? '***encrypted***' : null,
      has_ai_key: !!config.ai_api_key_encrypted,
      has_telegram: !!config.telegram_bot_token_encrypted,
    };

    return NextResponse.json({ config: safeConfig }, { status: 200 });

  } catch (error) {
    console.error('GET /api/agent/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/agent/config
 * Create or update agent configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config, signature, timestamp } = body as {
      config: AgentConfig;
      signature: `0x${string}`;
      timestamp: number;
    };

    // Validate required fields
    if (!config.nfa_id || !config.token_address || !config.vault_address || !config.agent_wallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify timestamp
    if (!isTimestampValid(timestamp)) {
      return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
    }

    // Verify signature
    const message = createConfigMessage(config.nfa_id, 'write', timestamp);
    const signer = await verifySignature(message, signature);

    // Check ownership
    const isOwner = await isNFALiteOwner(NFALITE_CONTRACT, config.nfa_id, signer);
    if (!isOwner) {
      return NextResponse.json({ error: 'Not the owner of this NFA' }, { status: 403 });
    }

    // Prepare data for storage
    const dbConfig: Record<string, unknown> = {
      nfa_id: config.nfa_id,
      token_address: config.token_address.toLowerCase(),
      vault_address: config.vault_address.toLowerCase(),
      agent_wallet: config.agent_wallet.toLowerCase(),
      owner_address: signer.toLowerCase(),
      ai_provider: config.ai_provider || 'openai',
      ai_model: config.ai_model || 'gpt-4o-mini',
      strategy: config.strategy || 'hodl',
      auto_notify: config.auto_notify ?? true,
      notify_threshold: config.notify_threshold || 0.1,
      telegram_chat_id: config.telegram_chat_id || null,
      updated_at: new Date().toISOString(),
      is_active: true,
    };

    // Encrypt sensitive fields
    if (config.ai_api_key) {
      dbConfig.ai_api_key_encrypted = encrypt(config.ai_api_key);
    }
    if (config.telegram_bot_token) {
      dbConfig.telegram_bot_token_encrypted = encrypt(config.telegram_bot_token);
    }

    // Upsert to Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_configs`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',  // Upsert
        },
        body: JSON.stringify(dbConfig),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase error:', error);
      throw new Error('Failed to save config');
    }

    return NextResponse.json({ success: true, message: 'Configuration saved' }, { status: 200 });

  } catch (error) {
    console.error('POST /api/agent/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/agent/config?nfaId=X
 * Deactivate agent configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nfaId = searchParams.get('nfaId');
    const signature = request.headers.get('x-signature') as `0x${string}` | null;
    const timestamp = parseInt(request.headers.get('x-timestamp') || '0');

    if (!nfaId || !signature) {
      return NextResponse.json({ error: 'nfaId and signature required' }, { status: 400 });
    }

    // Verify timestamp
    if (!isTimestampValid(timestamp)) {
      return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
    }

    // Verify signature
    const message = createConfigMessage(parseInt(nfaId), 'delete', timestamp);
    const signer = await verifySignature(message, signature);

    // Check ownership
    const isOwner = await isNFALiteOwner(NFALITE_CONTRACT, parseInt(nfaId), signer);
    if (!isOwner) {
      return NextResponse.json({ error: 'Not the owner of this NFA' }, { status: 403 });
    }

    // Soft delete (set is_active = false)
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_configs?nfa_id=eq.${nfaId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete config');
    }

    return NextResponse.json({ success: true, message: 'Configuration deactivated' }, { status: 200 });

  } catch (error) {
    console.error('DELETE /api/agent/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
