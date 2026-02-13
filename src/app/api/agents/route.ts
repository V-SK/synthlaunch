import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, decodeEventLog, http, parseAbi, recoverMessageAddress } from 'viem';
import { bsc } from 'viem/chains';
import { createClient } from '@/lib/supabase';
import { xorEncrypt } from '@/lib/agentEncryption';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { isTimestampValid } from '@/lib/auth';
import { SYNTH_TOKEN_ADDRESS } from '@/lib/contracts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AGENT_SELECT = 'id,user_address,name,description,plan,payment_method,payment_amount,status,created_at,expires_at,tx_hash,container_id';
const ALLOWED_PLANS = new Set(['7d', '14d', '30d']);
const ALLOWED_PAYMENT_METHODS = new Set(['synth', 'usdt', 'bnb']);
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const TREASURY_ADDRESS = '0x8028227C43947F41bB431571002D512815D77C4F';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const TRANSFER_EVENT_ABI = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const publicClient = createPublicClient({ chain: bsc, transport: http() });

type TxVerification =
  | { ok: true }
  | { ok: false; status: number; error: string };

function jsonError(message: string, status: number = 400, details?: string) {
  return NextResponse.json({ error: message, details }, { status });
}

function extractTimestamp(message: string): number | null {
  const match = message.match(/timestamp:\s*(\d{10,})/i);
  if (!match) {
    return null;
  }
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) {
    return null;
  }
  return raw < 1_000_000_000_000 ? raw * 1000 : raw;
}

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function getPaymentConfig(paymentMethod: string): { tokenAddress?: string; recipient: string } | null {
  if (paymentMethod === 'bnb') {
    return { recipient: TREASURY_ADDRESS };
  }
  if (paymentMethod === 'usdt') {
    return { tokenAddress: USDT_ADDRESS, recipient: TREASURY_ADDRESS };
  }
  if (paymentMethod === 'synth') {
    return { tokenAddress: SYNTH_TOKEN_ADDRESS, recipient: DEAD_ADDRESS };
  }
  return null;
}

async function verifyPaymentTx(
  txHash: string,
  userAddress: string,
  paymentMethod: string
): Promise<TxVerification> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, status: 400, error: 'Invalid tx_hash' };
  }

  const config = getPaymentConfig(paymentMethod);
  if (!config) {
    return { ok: false, status: 400, error: 'Invalid payment_method' };
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch (error) {
    console.error('[agents][POST] tx receipt error:', error);
    return { ok: false, status: 400, error: 'Transaction not found or not confirmed' };
  }

  if (!receipt || receipt.status !== 'success') {
    return { ok: false, status: 400, error: 'Transaction not confirmed' };
  }

  const sender = normalizeAddress(receipt.from);
  if (!sender || sender !== normalizeAddress(userAddress)) {
    return { ok: false, status: 400, error: 'Transaction sender mismatch' };
  }

  if (!config.tokenAddress) {
    const to = normalizeAddress(receipt.to);
    if (!to || to !== normalizeAddress(config.recipient)) {
      return { ok: false, status: 400, error: 'Transaction recipient mismatch' };
    }
    return { ok: true };
  }

  const tokenAddress = normalizeAddress(config.tokenAddress);
  const txTo = normalizeAddress(receipt.to);
  if (!txTo || txTo !== tokenAddress) {
    return { ok: false, status: 400, error: 'Token contract mismatch' };
  }

  const expectedRecipient = normalizeAddress(config.recipient);
  let transferFound = false;
  for (const log of receipt.logs) {
    if (normalizeAddress(log.address) !== tokenAddress) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: TRANSFER_EVENT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== 'Transfer') {
        continue;
      }
      const { from, to } = decoded.args as { from: string; to: string; value: bigint };
      if (normalizeAddress(from) === sender && normalizeAddress(to) === expectedRecipient) {
        transferFound = true;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!transferFound) {
    return { ok: false, status: 400, error: 'Transfer not found for payment' };
  }

  return { ok: true };
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const rl = rateLimit(`agents:get:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('user_address');

    if (!userAddress) {
      return jsonError('Missing user_address', 400);
    }

    const supabase = createClient();
    const encodedAddress = encodeURIComponent(userAddress);
    const data = await supabase.request<any[]>(
      `hosted_agents?select=${AGENT_SELECT}&user_address=eq.${encodedAddress}&order=created_at.desc`
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error('[agents][GET] error:', error);
    return jsonError('Failed to fetch agents', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const rl = rateLimit(`agents:post:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const {
      user_address,
      name,
      bot_token,
      description,
      plan,
      payment_method,
      payment_amount,
      expires_at,
      tx_hash,
      signature,
      message,
    } = body || {};

    if (!user_address || !name || !bot_token || !plan || !payment_method || !expires_at || !tx_hash || !signature || !message) {
      return jsonError('Missing required fields', 400);
    }

    if (!ALLOWED_PLANS.has(plan)) {
      return jsonError('Invalid plan', 400);
    }

    if (!ALLOWED_PAYMENT_METHODS.has(payment_method)) {
      return jsonError('Invalid payment_method', 400);
    }

    const expiresAt = new Date(expires_at);
    if (Number.isNaN(expiresAt.getTime())) {
      return jsonError('Invalid expires_at', 400);
    }

    if (typeof message !== 'string' || typeof signature !== 'string') {
      return jsonError('Invalid signature or message', 400);
    }

    const timestamp = extractTimestamp(message);
    if (!timestamp) {
      return jsonError('Missing timestamp in message', 400);
    }
    if (!isTimestampValid(timestamp)) {
      return jsonError('Timestamp expired', 401);
    }

    if (!/^0x[0-9a-fA-F]+$/.test(signature)) {
      return jsonError('Invalid signature', 400);
    }

    let recoveredAddress: string;
    try {
      recoveredAddress = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      });
    } catch (error) {
      return jsonError('Invalid signature', 401);
    }

    if (normalizeAddress(recoveredAddress) !== normalizeAddress(user_address)) {
      return jsonError('Signature does not match user_address', 401);
    }

    const txVerification = await verifyPaymentTx(tx_hash, user_address, payment_method);
    if (!txVerification.ok) {
      return jsonError(txVerification.error, txVerification.status);
    }

    const supabase = createClient();
    const encodedTx = encodeURIComponent(tx_hash);
    const existing = await supabase.request<any[]>(
      `hosted_agents?select=id&tx_hash=eq.${encodedTx}&limit=1`
    );

    if (existing.length > 0) {
      return jsonError('Duplicate tx_hash', 409);
    }

    const bot_token_encrypted = xorEncrypt(String(bot_token));

    const insertPayload: Record<string, unknown> = {
      user_address,
      name,
      bot_token_encrypted,
      description: description ?? null,
      plan,
      payment_method,
      payment_amount: payment_amount ?? null,
      expires_at: expiresAt.toISOString(),
      tx_hash,
    };

    const created = await supabase.request<any[]>(
      `hosted_agents?select=${AGENT_SELECT}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(insertPayload),
      }
    );

    if (!created || created.length === 0) {
      return jsonError('Failed to create agent', 500);
    }

    // 部署到 VPS
    const agentId = created[0].id;
    try {
      const deployRes = await fetch('http://45.76.180.239:3456/deploy', {
        method: 'POST',
        headers: {
          'X-Deploy-Secret': 'synth-deploy-2026',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_token: String(bot_token),
          soul: description || `你是 ${name}，一个友好的 AI 助手。`,
          model: 'gemini3',
        }),
      });

      if (deployRes.ok) {
        const deployData = await deployRes.json();
        if (deployData.success && deployData.agentId) {
          // 更新 container_id
          await supabase.request(
            `hosted_agents?id=eq.${agentId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ container_id: deployData.agentId, status: 'running' }),
            }
          );
          console.log(`[agents][POST] deployed agent ${agentId}, container: ${deployData.agentId}`);
        }
      } else {
        console.error(`[agents][POST] deploy failed for agent ${agentId}:`, await deployRes.text());
      }
    } catch (deployError) {
      console.error(`[agents][POST] deploy error for agent ${agentId}:`, deployError);
      // 不阻塞返回，部署失败但数据库记录已创建
    }

    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error('[agents][POST] error:', error);
    return jsonError('Failed to create agent', 500);
  }
}
