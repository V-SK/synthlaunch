import { promises as fs } from 'fs';
import path from 'path';
import { getFanFiCampaignTemplate } from '@/lib/fanfiCampaigns';
import {
  getSupabase,
  isLocalFanFiStoreEnabled,
  isSupabaseConfigured,
  normalizeFanId,
} from '@/lib/localFanfiStore';

export interface FanFiCampaignRecord {
  id: string;
  fanId: string;
  templateId: string;
  title: string;
  symbol: string;
  objective: string;
  targetMatch: string;
  tone: string;
  launchDraft: string;
  status: 'draft' | 'ready' | 'launched';
  tokenAddress: string;
  createdAt: string;
  updatedAt: string;
}

const STORE_DIR = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'synthlaunch')
  : path.join(process.cwd(), '.local-data');
const STORE_PATH = path.join(STORE_DIR, 'fanfi-campaigns.json');

export function isLocalFanFiCampaignStoreEnabled(): boolean {
  return isLocalFanFiStoreEnabled();
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  fan_id: string;
  template_id: string;
  title: string;
  symbol: string;
  objective: string;
  target_match: string;
  tone: string;
  launch_draft: string;
  status: 'draft' | 'ready' | 'launched';
  token_address: string;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: CampaignRow): FanFiCampaignRecord {
  return {
    id: row.id,
    fanId: row.fan_id,
    templateId: row.template_id,
    title: row.title,
    symbol: row.symbol,
    objective: row.objective,
    targetMatch: row.target_match,
    tone: row.tone,
    launchDraft: row.launch_draft || '',
    status: row.status,
    tokenAddress: row.token_address || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToRow(record: FanFiCampaignRecord): CampaignRow {
  return {
    id: record.id,
    fan_id: record.fanId,
    template_id: record.templateId,
    title: record.title,
    symbol: record.symbol,
    objective: record.objective,
    target_match: record.targetMatch,
    tone: record.tone,
    launch_draft: record.launchDraft,
    status: record.status,
    token_address: record.tokenAddress,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// File-system fallback
// ---------------------------------------------------------------------------

async function readCampaignsFromFile(): Promise<FanFiCampaignRecord[]> {
  if (!isLocalFanFiCampaignStoreEnabled()) return [];
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeCampaignsToFile(campaigns: FanFiCampaignRecord[]) {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(campaigns, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------

async function readCampaignsFromSupabase(fanId?: string): Promise<FanFiCampaignRecord[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('fanfi_campaigns')
    .select('*')
    .order('updated_at', { ascending: false });

  if (fanId) {
    query = query.eq('fan_id', fanId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fanfi_campaigns read: ${error.message}`);

  return (data || []).map(rowToRecord);
}

async function readCampaignByIdSupabase(id: string): Promise<FanFiCampaignRecord | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('fanfi_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`fanfi_campaigns read by id: ${error.message}`);
  return data ? rowToRecord(data) : null;
}

async function upsertCampaignSupabase(record: FanFiCampaignRecord) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('fanfi_campaigns')
    .upsert(recordToRow(record), { onConflict: 'id' });

  if (error) throw new Error(`fanfi_campaigns upsert: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Public API (signatures unchanged from previous version)
// ---------------------------------------------------------------------------

function createCampaignId(fanId: string, templateId: string): string {
  const stamp = Date.now().toString(36);
  return `${normalizeFanId(fanId)}-${templateId}-${stamp}`;
}

export async function getFanFiCampaigns(fanId?: string): Promise<FanFiCampaignRecord[]> {
  if (isSupabaseConfigured()) {
    const normalizedFanId = fanId ? normalizeFanId(fanId) : '';
    return readCampaignsFromSupabase(normalizedFanId || undefined);
  }

  // File fallback.
  const campaigns = await readCampaignsFromFile();
  const normalizedFanId = fanId ? normalizeFanId(fanId) : '';
  return campaigns
    .filter((campaign) => !normalizedFanId || campaign.fanId === normalizedFanId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function upsertFanFiCampaign(params: {
  id?: string;
  fanId: string;
  templateId: string;
  objective: string;
  targetMatch: string;
  tone: string;
  tokenAddress?: string;
  launchDraft?: string;
}): Promise<FanFiCampaignRecord> {
  if (!isLocalFanFiCampaignStoreEnabled()) {
    throw new Error('FanFi campaign store is disabled');
  }

  const template = getFanFiCampaignTemplate(params.templateId);
  if (!template) {
    throw new Error('Unknown FanFi campaign template');
  }

  const objective = params.objective.trim();
  if (objective.length < 4) {
    throw new Error('Campaign objective is too short');
  }

  const fanId = normalizeFanId(params.fanId);
  const now = new Date().toISOString();
  const targetMatch = params.targetMatch.trim() || template.team;
  const tone = params.tone.trim() || 'sharp match-day prediction voice';
  const generatedLaunchDraft = [
    `${template.name} is preparing for Synth SportFi Prediction Arena on X Layer.`,
    `Prediction format: ${objective}`,
    `Market topic: ${targetMatch}.`,
    `Tone: ${tone}.`,
    template.launchTweet,
  ].join('\n');
  const launchDraft = params.launchDraft?.trim() || generatedLaunchDraft;

  // Load existing if id was provided (for created_at preservation).
  let previous: FanFiCampaignRecord | null = null;
  if (params.id) {
    previous = isSupabaseConfigured()
      ? await readCampaignByIdSupabase(params.id)
      : (await readCampaignsFromFile()).find((c) => c.id === params.id) || null;
  }

  const record: FanFiCampaignRecord = {
    id: previous?.id || createCampaignId(fanId, template.id),
    fanId,
    templateId: template.id,
    title: template.name,
    symbol: template.symbol,
    objective,
    targetMatch,
    tone,
    launchDraft,
    status: params.tokenAddress ? 'launched' : 'ready',
    tokenAddress: params.tokenAddress?.trim() || previous?.tokenAddress || '',
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  if (isSupabaseConfigured()) {
    await upsertCampaignSupabase(record);
    return record;
  }

  // File fallback.
  const campaigns = await readCampaignsFromFile();
  const existingIndex = campaigns.findIndex((c) => c.id === record.id);
  if (existingIndex >= 0) {
    campaigns[existingIndex] = record;
  } else {
    campaigns.unshift(record);
  }
  await writeCampaignsToFile(campaigns);
  return record;
}
