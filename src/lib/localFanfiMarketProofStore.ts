import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { createPublicClient, getAddress, http, isAddress } from 'viem';
import { getFanFiCampaignTemplate } from '@/lib/fanfiCampaigns';
import {
  getFanFiCampaigns,
  upsertFanFiCampaign,
  type FanFiCampaignRecord,
} from '@/lib/localFanfiCampaignStore';
import {
  assertFanIdOwnership,
  assertProductionPersistenceReady,
  getSupabase,
  isLocalFanFiStoreEnabled,
  isSupabaseConfigured,
  normalizeFanId,
} from '@/lib/localFanfiStore';
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
  // Structured prediction data (parsed from objective at write time).
  predictionDirection: string | null;
  predictionProbability: number | null;
  predictionReason: string | null;
  // Settlement spec (immutable after creation).
  settlementRule: string;
  settlementSource: string;
  settlementCutoff: string;
  settlementStatus: 'open' | 'locked' | 'resolved';
  // Settlement result (populated by /api/admin/fanfi-settle when match resolves).
  resolvedAt: string | null;
  resolvedOutcome: string | null;
  reputationPoints: number;
  reputationBreakdown: Record<string, number> | null;
  createdAt: string;
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

const X_LAYER_PROOF_TARGETS = new Set(
  [
    CHAIN_CONFIG[196].flapAddress,
    CHAIN_CONFIG[196].custodyAddress,
    CHAIN_CONFIG[196].tokenImpl.standard,
    CHAIN_CONFIG[196].tokenImpl.tax,
  ].map((address) => address.toLowerCase()),
);

const xLayerProofClient = createPublicClient({
  transport: http(CHAIN_CONFIG[196].rpc),
});

const STORE_DIR = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'synthlaunch')
  : path.join(process.cwd(), '.local-data');
const STORE_PATH = path.join(STORE_DIR, 'fanfi-market-proofs.json');

export function isFanFiMarketProofStoreEnabled(): boolean {
  return isLocalFanFiStoreEnabled();
}

// ---------------------------------------------------------------------------
// Identity / Settlement helpers
// ---------------------------------------------------------------------------

function createMarketProofIdentity(
  fanId: string,
  templateId: string,
  walletSignature: string,
  signatureMessage: string,
): { id: string; tokenAddress: string; receiptHash: string } {
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

    // Cryptographic linkage: the tx calldata MUST include the receipt hash.
    // Previously this also accepted any tx hitting a known Synth contract as
    // a fallback, which let a user re-use their own historical tx as "proof"
    // for an unrelated receipt. Drop the fallback — require receipt linkage.
    const receiptMarker = params.receiptHash.slice(2).toLowerCase();
    const calldata = (transaction.input || '0x').toLowerCase();
    const referencesReceipt = calldata.includes(receiptMarker);

    if (!referencesReceipt) {
      throw new Error('X Layer tx proof must reference this receipt hash in calldata');
    }

    // Defense-in-depth: even with receipt linkage, prefer txs that hit a
    // SynthLaunch X Layer contract. This is informational only — failing
    // here would break user flexibility, so we let it pass but log.
    const txTarget = transaction.to ? getAddress(transaction.to).toLowerCase() : '';
    if (txTarget && !X_LAYER_PROOF_TARGETS.has(txTarget)) {
      console.warn(
        '[fanfi] tx proof references receipt but targets unknown contract',
        { tx: txHash, to: txTarget },
      );
    }

    return txHash;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Unable to verify X Layer tx proof');
  }
}

/**
 * Extract direction / probability / reason from the bundled objective text
 * that the studio constructs in `buildArenaObjective()`. Studio outputs lines
 * like "Direction: Brazil wins", "Probability: 58%", "Reasoning: ...".
 * Bilingual (Chinese / English) labels are both recognized.
 */
function parsePredictionFields(objective: string): {
  direction: string | null;
  probability: number | null;
  reason: string | null;
} {
  if (!objective) return { direction: null, probability: null, reason: null };

  const directionMatch = objective.match(/(?:Direction|预测方向)\s*:\s*(.+)/i);
  const probabilityMatch = objective.match(/(?:Probability|概率)\s*:\s*([0-9.]+)/i);
  const reasonMatch = objective.match(/(?:Reasoning|理由)\s*:\s*(.+)/i);

  const probability = probabilityMatch ? Number.parseFloat(probabilityMatch[1]) : null;

  return {
    direction: directionMatch ? directionMatch[1].trim() : null,
    probability: Number.isFinite(probability) ? probability : null,
    reason: reasonMatch ? reasonMatch[1].trim() : null,
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

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface MarketProofRow {
  id: string;
  fan_id: string;
  campaign_id: string | null;
  template_id: string;
  name: string;
  symbol: string;
  token_address: string;
  tx_hash: string;
  receipt_hash: string;
  wallet_signature: string;
  signature_message: string;
  wallet: string;
  objective: string;
  target_match: string;
  tone: string;
  prediction_direction: string | null;
  prediction_probability: number | null;
  prediction_reason: string | null;
  settlement_rule: string;
  settlement_source: string;
  settlement_cutoff: string;
  settlement_status: 'open' | 'locked' | 'resolved';
  resolved_at: string | null;
  resolved_outcome: string | null;
  reputation_points: number;
  reputation_breakdown: Record<string, number> | null;
  created_at: string;
}

function rowToRecord(row: MarketProofRow): FanFiMarketProofRecord {
  return {
    id: row.id,
    fanId: row.fan_id,
    campaignId: row.campaign_id || '',
    templateId: row.template_id,
    name: row.name,
    symbol: row.symbol,
    tokenAddress: row.token_address,
    txHash: row.tx_hash || '',
    receiptHash: row.receipt_hash,
    walletSignature: row.wallet_signature,
    signatureMessage: row.signature_message,
    wallet: row.wallet || '',
    objective: row.objective,
    targetMatch: row.target_match,
    tone: row.tone,
    predictionDirection: row.prediction_direction,
    predictionProbability: row.prediction_probability,
    predictionReason: row.prediction_reason,
    settlementRule: row.settlement_rule,
    settlementSource: row.settlement_source,
    settlementCutoff: row.settlement_cutoff,
    settlementStatus: row.settlement_status,
    resolvedAt: row.resolved_at,
    resolvedOutcome: row.resolved_outcome,
    reputationPoints: row.reputation_points || 0,
    reputationBreakdown: row.reputation_breakdown,
    createdAt: row.created_at,
  };
}

function recordToRow(record: FanFiMarketProofRecord): MarketProofRow {
  return {
    id: record.id,
    fan_id: record.fanId,
    campaign_id: record.campaignId || null,
    template_id: record.templateId,
    name: record.name,
    symbol: record.symbol,
    token_address: record.tokenAddress,
    tx_hash: record.txHash,
    receipt_hash: record.receiptHash,
    wallet_signature: record.walletSignature,
    signature_message: record.signatureMessage,
    wallet: record.wallet,
    objective: record.objective,
    target_match: record.targetMatch,
    tone: record.tone,
    prediction_direction: record.predictionDirection,
    prediction_probability: record.predictionProbability,
    prediction_reason: record.predictionReason,
    settlement_rule: record.settlementRule,
    settlement_source: record.settlementSource,
    settlement_cutoff: record.settlementCutoff,
    settlement_status: record.settlementStatus,
    resolved_at: record.resolvedAt,
    resolved_outcome: record.resolvedOutcome,
    reputation_points: record.reputationPoints,
    reputation_breakdown: record.reputationBreakdown,
    created_at: record.createdAt,
  };
}

// ---------------------------------------------------------------------------
// File-system fallback
// ---------------------------------------------------------------------------

async function readMarketProofsFromFile(): Promise<FanFiMarketProofRecord[]> {
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
        predictionDirection: item.predictionDirection ?? null,
        predictionProbability: item.predictionProbability ?? null,
        predictionReason: item.predictionReason ?? null,
        resolvedAt: item.resolvedAt ?? null,
        resolvedOutcome: item.resolvedOutcome ?? null,
        reputationPoints: item.reputationPoints ?? 0,
        reputationBreakdown: item.reputationBreakdown ?? null,
      }));
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeMarketProofsToFile(launches: FanFiMarketProofRecord[]) {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(launches, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------

async function readMarketProofsFromSupabase(fanId?: string): Promise<FanFiMarketProofRecord[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('fanfi_market_proofs')
    .select('*')
    .order('created_at', { ascending: false });

  if (fanId) {
    query = query.eq('fan_id', fanId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fanfi_market_proofs read: ${error.message}`);

  return (data || []).map(rowToRecord);
}

async function findExistingMarketProofSupabase(walletSignature: string): Promise<FanFiMarketProofRecord | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('fanfi_market_proofs')
    .select('*')
    .eq('wallet_signature', walletSignature)
    .maybeSingle();

  if (error) throw new Error(`fanfi_market_proofs lookup: ${error.message}`);
  return data ? rowToRecord(data) : null;
}

async function insertMarketProofSupabase(record: FanFiMarketProofRecord) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase.from('fanfi_market_proofs').insert(recordToRow(record));
  if (error) throw new Error(`fanfi_market_proofs insert: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Public API (signatures unchanged from previous version)
// ---------------------------------------------------------------------------

export async function getFanFiMarketProofs(fanId?: string): Promise<FanFiMarketProofRecord[]> {
  const normalizedFanId = fanId ? normalizeFanId(fanId) : '';

  if (isSupabaseConfigured()) {
    return readMarketProofsFromSupabase(normalizedFanId || undefined);
  }

  const launches = await readMarketProofsFromFile();
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
  assertProductionPersistenceReady();

  const template = getFanFiCampaignTemplate(params.templateId);
  if (!template) {
    throw new Error('Unknown FanFi campaign template');
  }

  const fanId = normalizeFanId(params.fanId);

  // Ownership enforcement (H-1): the wallet that signed the receipt must own
  // the fan_id, or this is the first claim. The wallet has already been
  // signature-verified upstream in verifyFanFiReceiptSignature.
  if (params.wallet) {
    await assertFanIdOwnership(fanId, params.wallet);
  }

  // Idempotency: if the same signed receipt was already submitted, return existing.
  let existingLaunch: FanFiMarketProofRecord | null = null;
  if (isSupabaseConfigured()) {
    existingLaunch = await findExistingMarketProofSupabase(params.walletSignature);
  } else {
    const launches = await readMarketProofsFromFile();
    existingLaunch =
      launches.find(
        (launch) =>
          launch.walletSignature.toLowerCase() === params.walletSignature.toLowerCase() ||
          launch.signatureMessage === params.signatureMessage,
      ) || null;
  }

  if (existingLaunch) {
    const existingCampaigns = await getFanFiCampaigns(fanId);
    const existingCampaign = existingCampaigns.find((c) => c.id === existingLaunch.campaignId);
    if (existingCampaign) {
      return {
        launch: existingLaunch,
        campaign: existingCampaign,
        campaigns: existingCampaigns,
      };
    }
  }

  const identity = createMarketProofIdentity(
    fanId,
    template.id,
    params.walletSignature,
    params.signatureMessage,
  );
  const settlement = createSettlementDetails(template.id, params.targetMatch);
  const prediction = parsePredictionFields(params.objective);
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
    predictionDirection: prediction.direction,
    predictionProbability: prediction.probability,
    predictionReason: prediction.reason,
    settlementRule: settlement.settlementRule,
    settlementSource: settlement.settlementSource,
    settlementCutoff: settlement.settlementCutoff,
    settlementStatus: settlement.settlementStatus,
    resolvedAt: null,
    resolvedOutcome: null,
    reputationPoints: 0,
    reputationBreakdown: null,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    await insertMarketProofSupabase(launch);
  } else {
    const launches = await readMarketProofsFromFile();
    launches.unshift(launch);
    await writeMarketProofsToFile(launches);
  }

  // Inject into the unified tokens store so /tokens?chainId=196 surfaces it
  // (with the existing filterValidFanFiProofTokens guard in /api/tokens).
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
