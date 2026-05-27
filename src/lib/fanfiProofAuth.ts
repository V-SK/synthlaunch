import { getAddress, isAddress, verifyMessage } from 'viem';
import {
  buildFanFiCampaignMessage,
  buildFanFiMissionMessage,
  buildFanFiReceiptMessage,
} from '@/lib/fanfiProofSignature';
import { normalizeFanId } from '@/lib/localFanfiStore';

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const REPLAY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function normalizeOptionalTxHash(value?: string): string {
  const text = value?.trim() || '';
  if (!text) return '';
  if (!TX_HASH_RE.test(text)) {
    throw new Error('Invalid X Layer tx hash format');
  }
  return text;
}

function assertSignaturePreamble(params: {
  wallet?: string;
  signature?: string;
  timestamp?: string;
  context: string;
}): { wallet: `0x${string}`; timestampMs: number } {
  if (!params.wallet || !isAddress(params.wallet)) {
    throw new Error(`A connected wallet is required to ${params.context}`);
  }

  if (!params.signature || !/^0x[0-9a-fA-F]+$/.test(params.signature)) {
    throw new Error(`Missing wallet signature for ${params.context}`);
  }

  if (!params.timestamp) {
    throw new Error(`Missing ${params.context} timestamp`);
  }

  const timestampMs = new Date(params.timestamp).getTime();
  if (!Number.isFinite(timestampMs)) {
    throw new Error(`Invalid ${params.context} timestamp`);
  }

  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > REPLAY_WINDOW_MS) {
    throw new Error(`${params.context} signature expired`);
  }

  return { wallet: getAddress(params.wallet), timestampMs };
}

export async function verifyFanFiReceiptSignature(params: {
  fanId: string;
  templateId: string;
  objective: string;
  targetMatch: string;
  tone: string;
  wallet?: string;
  xLayerTxHash?: string;
  timestamp?: string;
  signature?: string;
  signatureMessage?: string;
}): Promise<{
  wallet: `0x${string}`;
  signature: `0x${string}`;
  signatureMessage: string;
  xLayerTxHash: string;
}> {
  const { wallet } = assertSignaturePreamble({
    wallet: params.wallet,
    signature: params.signature,
    timestamp: params.timestamp,
    context: 'submit receipt proof',
  });

  const xLayerTxHash = normalizeOptionalTxHash(params.xLayerTxHash);
  const signatureMessage = buildFanFiReceiptMessage({
    fanId: normalizeFanId(params.fanId),
    templateId: params.templateId,
    objective: params.objective,
    targetMatch: params.targetMatch,
    tone: params.tone,
    wallet,
    xLayerTxHash,
    timestamp: params.timestamp!,
  });

  if (params.signatureMessage !== signatureMessage) {
    throw new Error('Receipt proof message mismatch');
  }

  const valid = await verifyMessage({
    address: wallet,
    message: signatureMessage,
    signature: params.signature as `0x${string}`,
  });

  if (!valid) {
    throw new Error('Invalid receipt proof wallet signature');
  }

  return {
    wallet,
    signature: params.signature as `0x${string}`,
    signatureMessage,
    xLayerTxHash,
  };
}

export async function verifyFanFiMissionSignature(params: {
  fanId: string;
  missionId: string;
  proof: string;
  wallet?: string;
  timestamp?: string;
  signature?: string;
  signatureMessage?: string;
}): Promise<{ wallet: `0x${string}`; signature: `0x${string}`; signatureMessage: string }> {
  const { wallet } = assertSignaturePreamble({
    wallet: params.wallet,
    signature: params.signature,
    timestamp: params.timestamp,
    context: 'update prediction missions',
  });

  const signatureMessage = buildFanFiMissionMessage({
    fanId: normalizeFanId(params.fanId),
    missionId: params.missionId,
    proof: params.proof,
    wallet,
    timestamp: params.timestamp!,
  });

  if (params.signatureMessage !== signatureMessage) {
    throw new Error('Mission proof message mismatch');
  }

  const valid = await verifyMessage({
    address: wallet,
    message: signatureMessage,
    signature: params.signature as `0x${string}`,
  });

  if (!valid) {
    throw new Error('Invalid mission proof wallet signature');
  }

  return {
    wallet,
    signature: params.signature as `0x${string}`,
    signatureMessage,
  };
}

export async function verifyFanFiCampaignSignature(params: {
  fanId: string;
  templateId: string;
  objective: string;
  targetMatch: string;
  tone: string;
  wallet?: string;
  timestamp?: string;
  signature?: string;
  signatureMessage?: string;
}): Promise<{ wallet: `0x${string}`; signature: `0x${string}`; signatureMessage: string }> {
  const { wallet } = assertSignaturePreamble({
    wallet: params.wallet,
    signature: params.signature,
    timestamp: params.timestamp,
    context: 'save prediction campaign',
  });

  const signatureMessage = buildFanFiCampaignMessage({
    fanId: normalizeFanId(params.fanId),
    templateId: params.templateId,
    objective: params.objective,
    targetMatch: params.targetMatch,
    tone: params.tone,
    wallet,
    timestamp: params.timestamp!,
  });

  if (params.signatureMessage !== signatureMessage) {
    throw new Error('Campaign save message mismatch');
  }

  const valid = await verifyMessage({
    address: wallet,
    message: signatureMessage,
    signature: params.signature as `0x${string}`,
  });

  if (!valid) {
    throw new Error('Invalid campaign save wallet signature');
  }

  return {
    wallet,
    signature: params.signature as `0x${string}`,
    signatureMessage,
  };
}
