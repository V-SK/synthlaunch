import { promises as fs } from 'fs';
import path from 'path';
import { FANFI_MISSIONS, getFanFiMission } from '@/lib/fanfiMissions';

export interface FanFiCompletion {
  missionId: string;
  proof: string;
  points: number;
  completedAt: string;
}

export interface FanFiProfile {
  fanId: string;
  handle: string;
  wallet: string;
  completions: FanFiCompletion[];
  createdAt: string;
  updatedAt: string;
}

const STORE_DIR = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'synthlaunch')
  : path.join(process.cwd(), '.local-data');
const STORE_PATH = path.join(STORE_DIR, 'fanfi-progress.json');
const DEFAULT_FAN_ID = 'fanfi-captain';

export function isLocalFanFiStoreEnabled(): boolean {
  return process.env.DISABLE_LOCAL_FANFI_STORE !== '1';
}

export function normalizeFanId(value: string | null | undefined): string {
  const normalized = (value || DEFAULT_FAN_ID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (!normalized || normalized === 'local-reviewer') return DEFAULT_FAN_ID;
  return normalized;
}

async function readProfiles(): Promise<FanFiProfile[]> {
  if (!isLocalFanFiStoreEnabled()) return [];

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeProfiles(profiles: FanFiProfile[]) {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(profiles, null, 2)}\n`, 'utf8');
}

export function getFanFiTotalPoints(profile: FanFiProfile): number {
  return profile.completions.reduce((sum, completion) => sum + completion.points, 0);
}

export async function getFanFiProgress(fanId: string): Promise<{
  profile: FanFiProfile;
  leaderboard: Array<FanFiProfile & { rank: number; totalPoints: number }>;
}> {
  const normalizedFanId = normalizeFanId(fanId);
  const profiles = (await readProfiles()).filter((item) => item.fanId !== 'local-reviewer');
  const now = new Date().toISOString();
  const profile = profiles.find((item) => item.fanId === normalizedFanId) || {
    fanId: normalizedFanId,
    handle: normalizedFanId,
    wallet: '',
    completions: [],
    createdAt: now,
    updatedAt: now,
  };

  const leaderboard = profiles
    .map((item) => ({ ...item, totalPoints: getFanFiTotalPoints(item), rank: 0 }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.completions.length - a.completions.length)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const existing = leaderboard.find((item) => item.fanId === profile.fanId);
  if (!existing) {
    leaderboard.push({ ...profile, totalPoints: 0, rank: leaderboard.length + 1 });
  }

  return { profile, leaderboard };
}

export async function completeFanFiMission(params: {
  fanId: string;
  handle?: string;
  wallet?: string;
  missionId: string;
  proof: string;
}): Promise<FanFiProfile> {
  if (!isLocalFanFiStoreEnabled()) {
    throw new Error('Local FanFi mission store is disabled');
  }

  const mission = getFanFiMission(params.missionId);
  if (!mission) {
    throw new Error('Unknown mission');
  }

  const proof = params.proof.trim();
  if (proof.length < 4) {
    throw new Error('Mission proof is too short');
  }

  const fanId = normalizeFanId(params.fanId);
  const profiles = await readProfiles();
  const now = new Date().toISOString();
  let profile = profiles.find((item) => item.fanId === fanId);

  if (!profile) {
    profile = {
      fanId,
      handle: params.handle?.trim() || fanId,
      wallet: params.wallet || '',
      completions: [],
      createdAt: now,
      updatedAt: now,
    };
    profiles.push(profile);
  }

  const existingIndex = profile.completions.findIndex((completion) => completion.missionId === mission.id);
  const completion: FanFiCompletion = {
    missionId: mission.id,
    proof,
    points: mission.points,
    completedAt: now,
  };

  if (existingIndex >= 0) {
    profile.completions[existingIndex] = completion;
  } else {
    profile.completions.push(completion);
  }

  profile.handle = params.handle?.trim() || profile.handle || fanId;
  profile.wallet = params.wallet || profile.wallet || '';
  profile.updatedAt = now;

  await writeProfiles(profiles);
  return profile;
}

export { FANFI_MISSIONS };
