import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { createPublicClient, getAddress, http, isAddress } from 'viem';
import { getFanFiCampaignTemplate } from '@/lib/fanfiCampaigns';
import { getFanFiCampaigns, upsertFanFiCampaign, type FanFiCampaignRecord } from '@/lib/localFanfiCampaignStore';
import { normalizeFanId } from '@/lib/localFanfiStore';
import { CHAIN_CONFIG } from '@/lib/contracts';
import { upsertLocalToken } from '@/lib/localTokenStore';

export interface FanFiMarketProofRecord {
  id: string;
  fanId: string;
  campaignId: string;
  templateId: string;
  name: string;
  symbol: string;
  tokenAddress: string;
  txHash: string;
  receiptHash: string;
  walletSignature: string;
  signatureMessage: string;
  wallet: string;
  objective: string;
  targetMatch: string;
  tone: string;
  settlementRule: string;
  settlementSource: string;
  settlementCutoff: string;
  settlementStatus: 'open' | 'locked' | 'resolved';
  marketCapUsd: number;
  revenueOkb: number;
  createdAt: string;
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const X_LAYER_PROOF_TARGETS = new Set([
  CHAIN_CONFIG[196].flapAddress,
  CHAIN_CONFIG[196].custodyAddress,
  CHAIN_CONFIG[196].tokenImpl.standard,
  CHAIN_CONFIG[196].tokenImpl.tax,
].map((address) => address.toLowerCase()));
const xLayerProofClient = createPublicClient({
  transport: http(CHAIN_CONFIG[196].rpc),
});

const STORE_DIR = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'synthlaunch')
  : path.join(process.cwd(), '.local-data');
const STORE_PATH = path.join(STORE_DIR, 'fanfi-market-proofs.json');

export function isFanFiMarketProofStoreEnabled(): boolean {
  return process.env.DISABLE_LOCAL_FANFI_STORE !== '1';
}

async function readMarketProofs(): Promise<FanFiMarketProofRecord[]> {
  if (!isFanFiMarketProofStoreEnabled()) return [];

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => Boolean(item.walletSignature && item.signatureMessage && item.receiptHash))
      .map((item) => ({
        ...item,
        txHash: normalizeTxHash(item.txHash),
      }));
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeMarketProofs(launches: FanFiMarketProofRecord[]) {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(launches, null, 2)}\n`, 'utf8');
}

function createMarketProofIdentity(fanId: string, templateId: string, walletSignature: string, signatureMessage: string): {
  id: string;
  tokenAddress: string;
  receiptHash: string;
} {
  const digest = createHash('sha256')
    .update(`${fanId}:${templateId}:${signatureMessage}:${walletSignature}`)
    .digest('hex');
  const receiptDigest = createHash('sha256')
    .update(`receipt:${fanId}:${templateId}:${signatureMessage}:${walletSignature}`)
    .digest('hex');

  return {
    id: `${fanId}-${templateId}-${digest.slice(0, 12)}`,
    tokenAddress: `0x${digest.slice(0, 40)}`,
    receiptHash: `0x${receiptDigest}`,
  };
}

function normalizeTxHash(value?: string): string {
  const text = value?.trim() || '';
  return TX_HASH_RE.test(text) ? text : '';
}

async function verifyXLayerTxHash(params: {
  txHash?: string;
  wallet?: string;
  receiptHash: string;
}): Promise<string> {
  const txHash = normalizeTxHash(params.txHash);
  const providedTxHash = params.txHash?.trim();

  if (!providedTxHash) return '';
  if (!txHash) {
    throw new Error('Invalid X Layer tx hash format');
  }

  if (!params.wallet || !isAddress(params.wallet)) {
    throw new Error('A connected wallet is required to attach X Layer tx proof');
  }

  const wallet = getAddress(params.wallet);

  try {
    const [transaction, receipt] = await Promise.all([
      xLayerProofClient.getTransaction({ hash: txHash as `0x${string}` }),
      xLayerProofClient.getTransactionReceipt({ hash: txHash as `0x${string}` }),
    ]);

    if (receipt.status !== 'success') {
      throw new Error('X Layer tx proof is not successful');
    }

    if (getAddress(transaction.from) !== wallet) {
      throw new Error('X Layer tx proof was not sent by the submitting wallet');
    }

    const txTarget = transaction.to ? getAddress(transaction.to).toLowerCase() : '';
    const receiptMarker = params.receiptHash.slice(2).toLowerCase();
    const calldata = (transaction.input || '0x').toLowerCase();
    const referencesReceipt = calldata.includes(receiptMarker);
    const usesKnownSynthTarget = txTarget ? X_LAYER_PROOF_TARGETS.has(txTarget) : false;

    if (!referencesReceipt && !usesKnownSynthTarget) {
      throw new Error('X Layer tx proof does not reference this receipt or a Synth X Layer contract');
    }

    return txHash;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to verify X Layer tx proof');
  }
}

function createMarketProofMetrics(tokenAddress: string): { marketCapUsd: number; revenueOkb: number } {
  const seed = Number.parseInt(tokenAddress.slice(2, 10), 16) || 0;
  return {
    marketCapUsd: 25000 + (seed % 75000),
    revenueOkb: Number((0.15 + (seed % 650) / 100).toFixed(3)),
  };
}

function createSettlementDetails(templateId: string, targetMatch: string): {
  settlementRule: string;
  settlementSource: string;
  settlementCutoff: string;
  settlementStatus: 'open' | 'locked' | 'resolved';
} {
  const match = targetMatch.trim() || 'World Cup match';

  if (templateId === 'player') {
    return {
      settlementRule: `${match}: resolve against official player statistics, then score direction, probability distance, and receipt timing.`,
      settlementSource: 'Official FIFA match data and tournament stat table',
      settlementCutoff: '30 minutes before the relevant match kickoff',
      settlementStatus: 'open',
    };
  }

  if (templateId === 'var') {
    return {
      settlementRule: `${match}: resolve VAR, penalty, red-card, and meme heat outcomes through match events plus public sentiment scoring.`,
      settlementSource: 'Official match events plus public social momentum index',
      settlementCutoff: 'Kickoff lock for match events; 2 hours after final whistle for sentiment window',
      settlementStatus: 'open',
    };
  }

  if (templateId === 'scout') {
    return {
      settlementRule: `${match}: rank prediction heat, asset watchlist movement, and OKX quote readiness into momentum reputation.`,
      settlementSource: 'Arena receipts, X Layer proof feed, and OKX/X Layer quote surface',
      settlementCutoff: 'Rolling lock per tracked arena',
      settlementStatus: 'open',
    };
  }

  return {
    settlementRule: `${match}: resolve match result through the official final score, then score direction, probability distance, early receipt, and reasoning quality.`,
    settlementSource: 'Official final score and post-match report',
    settlementCutoff: '30 minutes before kickoff',
    settlementStatus: 'open',
  };
}

export async function getFanFiMarketProofs(fanId?: string): Promise<FanFiMarketProofRecord[]> {
  const normalizedFanId = fanId ? normalizeFanId(fanId) : '';
  const launches = await readMarketProofs();
  return launches
    .filter((launch) => !normalizedFanId || launch.fanId === normalizedFanId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createFanFiMarketProof(params: {
  fanId: string;
  campaignId?: string;
  templateId: string;
  objective: string;
  targetMatch: string;
  tone: string;
  wallet?: string;
  walletSignature: string;
  signatureMessage: string;
  xLayerTxHash?: string;
}): Promise<{
  launch: FanFiMarketProofRecord;
  campaign: FanFiCampaignRecord;
  campaigns: FanFiCampaignRecord[];
}> {
  if (!isFanFiMarketProofStoreEnabled()) {
    throw new Error('FanFi market proof store is disabled');
  }

  const template = getFanFiCampaignTemplate(params.templateId);
  if (!template) {
    throw new Error('Unknown FanFi campaign template');
  }

  const fanId = normalizeFanId(params.fanId);
  const launches = await readMarketProofs();
  const existingLaunch = launches.find((launch) =>
    launch.walletSignature.toLowerCase() === params.walletSignature.toLowerCase() ||
    launch.signatureMessage === params.signatureMessage
  );
  if (existingLaunch) {
    const existingCampaigns = await getFanFiCampaigns(fanId);
    const existingCampaign = existingCampaigns.find((campaign) => campaign.id === existingLaunch.campaignId);
    if (existingCampaign) {
      return {
        launch: existingLaunch,
        campaign: existingCampaign,
        campaigns: existingCampaigns,
      };
    }
  }

  const identity = createMarketProofIdentity(fanId, template.id, params.walletSignature, params.signatureMessage);
  const metrics = createMarketProofMetrics(identity.tokenAddress);
  const settlement = createSettlementDetails(template.id, params.targetMatch);
  const txHash = await verifyXLayerTxHash({
    txHash: params.xLayerTxHash,
    wallet: params.wallet,
    receiptHash: identity.receiptHash,
  });
  const campaign = await upsertFanFiCampaign({
    id: params.campaignId,
    fanId,
    templateId: template.id,
    objective: params.objective,
    targetMatch: params.targetMatch,
    tone: params.tone,
    tokenAddress: identity.tokenAddress,
  });

  const launch: FanFiMarketProofRecord = {
    id: identity.id,
    fanId,
    campaignId: campaign.id,
    templateId: template.id,
    name: template.name,
    symbol: template.symbol,
    tokenAddress: identity.tokenAddress,
    txHash,
    receiptHash: identity.receiptHash,
    walletSignature: params.walletSignature,
    signatureMessage: params.signatureMessage,
    wallet: params.wallet?.trim() || '',
    objective: campaign.objective,
    targetMatch: campaign.targetMatch,
    tone: campaign.tone,
    settlementRule: settlement.settlementRule,
    settlementSource: settlement.settlementSource,
    settlementCutoff: settlement.settlementCutoff,
    settlementStatus: settlement.settlementStatus,
    marketCapUsd: metrics.marketCapUsd,
    revenueOkb: metrics.revenueOkb,
    createdAt: new Date().toISOString(),
  };

  launches.unshift(launch);
  await writeMarketProofs(launches);

  await upsertLocalToken({
    address: launch.tokenAddress,
    name: launch.name,
    symbol: launch.symbol,
    meta: `sportfi-prediction-proof:${launch.id}`,
    creator: launch.wallet || fanId,
    agent_name: 'tw:SynthFanFi',
    tax_rate: 200,
    beneficiary: launch.wallet || fanId,
    tx_hash: launch.txHash,
    launch_type: 'fanfi-market-proof',
    chain_id: 196,
    created_at: launch.createdAt,
  });

  const campaigns = await getFanFiCampaigns(fanId);
  return { launch, campaign, campaigns };
}
