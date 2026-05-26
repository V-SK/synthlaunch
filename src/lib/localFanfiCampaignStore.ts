import { promises as fs } from 'fs';
import path from 'path';
import { getFanFiCampaignTemplate } from '@/lib/fanfiCampaigns';
import { normalizeFanId } from '@/lib/localFanfiStore';

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
  return process.env.DISABLE_LOCAL_FANFI_STORE !== '1';
}

async function readCampaigns(): Promise<FanFiCampaignRecord[]> {
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

async function writeCampaigns(campaigns: FanFiCampaignRecord[]) {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(campaigns, null, 2)}\n`, 'utf8');
}

function createCampaignId(fanId: string, templateId: string): string {
  const stamp = Date.now().toString(36);
  return `${normalizeFanId(fanId)}-${templateId}-${stamp}`;
}

export async function getFanFiCampaigns(fanId?: string): Promise<FanFiCampaignRecord[]> {
  const campaigns = await readCampaigns();
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
    throw new Error('Local FanFi campaign store is disabled');
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
  const campaigns = await readCampaigns();
  const now = new Date().toISOString();
  const existingIndex = campaigns.findIndex((campaign) => campaign.id === params.id);
  const previous = existingIndex >= 0 ? campaigns[existingIndex] : null;

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

  if (existingIndex >= 0) {
    campaigns[existingIndex] = record;
  } else {
    campaigns.unshift(record);
  }

  await writeCampaigns(campaigns);
  return record;
}
