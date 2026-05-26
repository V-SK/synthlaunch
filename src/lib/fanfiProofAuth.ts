import { getAddress, isAddress, verifyMessage } from 'viem';
import { buildFanFiMissionMessage, buildFanFiReceiptMessage } from '@/lib/fanfiProofSignature';
import { normalizeFanId } from '@/lib/localFanfiStore';

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

function normalizeOptionalTxHash(value?: string): string {
  const text = value?.trim() || '';
  if (!text) return '';
  if (!TX_HASH_RE.test(text)) {
    throw new Error('Invalid X Layer tx hash format');
  }
  return text;
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
}): Promise<{ wallet: `0x${string}`; signature: `0x${string}`; signatureMessage: string; xLayerTxHash: string }> {
  if (!params.wallet || !isAddress(params.wallet)) {
    throw new Error('A connected wallet is required to submit receipt proof');
  }

  if (!params.signature || !/^0x[0-9a-fA-F]+$/.test(params.signature)) {
    throw new Error('Missing wallet signature for receipt proof');
  }

  if (!params.timestamp) {
    throw new Error('Missing receipt proof timestamp');
  }

  const timestampMs = new Date(params.timestamp).getTime();
  if (!Number.isFinite(timestampMs)) {
    throw new Error('Invalid receipt proof timestamp');
  }

  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > 30 * 60 * 1000) {
    throw new Error('Receipt proof signature expired');
  }

  const wallet = getAddress(params.wallet);
  const xLayerTxHash = normalizeOptionalTxHash(params.xLayerTxHash);
  const signatureMessage = buildFanFiReceiptMessage({
    fanId: normalizeFanId(params.fanId),
    templateId: params.templateId,
    objective: params.objective,
    targetMatch: params.targetMatch,
    tone: params.tone,
    wallet,
    xLayerTxHash,
    timestamp: params.timestamp,
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
  if (!params.wallet || !isAddress(params.wallet)) {
    throw new Error('A connected wallet is required to update prediction missions');
  }

  if (!params.signature || !/^0x[0-9a-fA-F]+$/.test(params.signature)) {
    throw new Error('Missing wallet signature for mission proof');
  }

  if (!params.timestamp) {
    throw new Error('Missing mission proof timestamp');
  }

  const timestampMs = new Date(params.timestamp).getTime();
  if (!Number.isFinite(timestampMs)) {
    throw new Error('Invalid mission proof timestamp');
  }

  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > 30 * 60 * 1000) {
    throw new Error('Mission proof signature expired');
  }

  const wallet = getAddress(params.wallet);
  const signatureMessage = buildFanFiMissionMessage({
    fanId: normalizeFanId(params.fanId),
    missionId: params.missionId,
    proof: params.proof,
    wallet,
    timestamp: params.timestamp,
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
