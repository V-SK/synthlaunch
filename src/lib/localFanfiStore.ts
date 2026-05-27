import { promises as fs } from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

function getSupabaseKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseKey());
}

let cachedSupabase: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (cachedSupabase) return cachedSupabase;
  if (!isSupabaseConfigured()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getSupabaseKey()!;
  cachedSupabase = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return cachedSupabase;
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

// ---------------------------------------------------------------------------
// File-system fallback (dev / Supabase-not-configured)
// ---------------------------------------------------------------------------

async function readProfilesFromFile(): Promise<FanFiProfile[]> {
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

async function writeProfilesToFile(profiles: FanFiProfile[]) {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(profiles, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------

interface SupabaseProfileRow {
  fan_id: string;
  handle: string;
  wallet: string;
  created_at: string;
  updated_at: string;
}

interface SupabaseCompletionRow {
  fan_id: string;
  mission_id: string;
  proof: string;
  points: number;
  completed_at: string;
}

interface SupabaseReputationRow {
  fan_id: string;
  reputation_points: number;
}

function mapProfileRow(row: SupabaseProfileRow, completions: SupabaseCompletionRow[]): FanFiProfile {
  return {
    fanId: row.fan_id,
    handle: row.handle,
    wallet: row.wallet || '',
    completions: completions
      .filter((c) => c.fan_id === row.fan_id)
      .map((c) => ({
        missionId: c.mission_id,
        proof: c.proof,
        points: c.points,
        completedAt: c.completed_at,
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readProfilesFromSupabase(): Promise<FanFiProfile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const [profilesRes, completionsRes] = await Promise.all([
    supabase.from('fanfi_profiles').select('*'),
    supabase.from('fanfi_completions').select('fan_id, mission_id, proof, points, completed_at'),
  ]);

  if (profilesRes.error) throw new Error(`fanfi_profiles read: ${profilesRes.error.message}`);
  if (completionsRes.error) throw new Error(`fanfi_completions read: ${completionsRes.error.message}`);

  const profiles = profilesRes.data || [];
  const completions = completionsRes.data || [];
  return profiles.map((row) => mapProfileRow(row, completions));
}

async function readProfileFromSupabase(fanId: string): Promise<FanFiProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [profileRes, completionsRes] = await Promise.all([
    supabase.from('fanfi_profiles').select('*').eq('fan_id', fanId).maybeSingle(),
    supabase
      .from('fanfi_completions')
      .select('fan_id, mission_id, proof, points, completed_at')
      .eq('fan_id', fanId),
  ]);

  if (profileRes.error) throw new Error(`fanfi_profiles read: ${profileRes.error.message}`);
  if (completionsRes.error) throw new Error(`fanfi_completions read: ${completionsRes.error.message}`);

  if (!profileRes.data) return null;
  return mapProfileRow(profileRes.data, completionsRes.data || []);
}

async function readAllReputationPoints(): Promise<Map<string, number>> {
  const supabase = getSupabase();
  if (!supabase) return new Map();

  const { data, error } = await supabase
    .from('fanfi_market_proofs')
    .select('fan_id, reputation_points')
    .gt('reputation_points', 0);

  if (error) throw new Error(`fanfi_market_proofs read: ${error.message}`);

  const map = new Map<string, number>();
  for (const row of (data || []) as SupabaseReputationRow[]) {
    map.set(row.fan_id, (map.get(row.fan_id) || 0) + row.reputation_points);
  }
  return map;
}

async function upsertProfileSupabase(profile: FanFiProfile, completion: FanFiCompletion) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  // Upsert profile row.
  const { error: profileError } = await supabase
    .from('fanfi_profiles')
    .upsert(
      {
        fan_id: profile.fanId,
        handle: profile.handle,
        wallet: profile.wallet,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fan_id' }
    );
  if (profileError) throw new Error(`fanfi_profiles upsert: ${profileError.message}`);

  // Upsert completion row.
  const { error: completionError } = await supabase
    .from('fanfi_completions')
    .upsert(
      {
        fan_id: profile.fanId,
        mission_id: completion.missionId,
        proof: completion.proof,
        points: completion.points,
        completed_at: completion.completedAt,
      },
      { onConflict: 'fan_id,mission_id' }
    );
  if (completionError) throw new Error(`fanfi_completions upsert: ${completionError.message}`);
}

// ---------------------------------------------------------------------------
// Unified read/write surface
// ---------------------------------------------------------------------------

async function readProfiles(): Promise<FanFiProfile[]> {
  if (!isLocalFanFiStoreEnabled()) return [];
  if (isSupabaseConfigured()) return readProfilesFromSupabase();
  return readProfilesFromFile();
}

export function getFanFiTotalPoints(profile: FanFiProfile): number {
  return profile.completions.reduce((sum, completion) => sum + completion.points, 0);
}

export async function getFanFiProgress(fanId: string): Promise<{
  profile: FanFiProfile;
  leaderboard: Array<FanFiProfile & { rank: number; totalPoints: number; reputationPoints: number }>;
}> {
  const normalizedFanId = normalizeFanId(fanId);
  const now = new Date().toISOString();

  let profiles: FanFiProfile[];
  let reputationMap: Map<string, number> = new Map();

  if (isSupabaseConfigured()) {
    const [allProfiles, reps] = await Promise.all([
      readProfilesFromSupabase(),
      readAllReputationPoints(),
    ]);
    profiles = allProfiles.filter((item) => item.fanId !== 'local-reviewer');
    reputationMap = reps;
  } else {
    profiles = (await readProfilesFromFile()).filter((item) => item.fanId !== 'local-reviewer');
  }

  const profile = profiles.find((item) => item.fanId === normalizedFanId) || {
    fanId: normalizedFanId,
    handle: normalizedFanId,
    wallet: '',
    completions: [],
    createdAt: now,
    updatedAt: now,
  };

  const leaderboard = profiles
    .map((item) => {
      const missionPoints = getFanFiTotalPoints(item);
      const reputationPoints = reputationMap.get(item.fanId) || 0;
      return {
        ...item,
        totalPoints: missionPoints + reputationPoints,
        reputationPoints,
        rank: 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || b.completions.length - a.completions.length)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const existing = leaderboard.find((item) => item.fanId === profile.fanId);
  if (!existing) {
    leaderboard.push({
      ...profile,
      totalPoints: 0,
      reputationPoints: 0,
      rank: leaderboard.length + 1,
    });
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
  const now = new Date().toISOString();
  const completion: FanFiCompletion = {
    missionId: mission.id,
    proof,
    points: mission.points,
    completedAt: now,
  };

  if (isSupabaseConfigured()) {
    // Read existing profile (if any) to preserve created_at + handle when absent.
    const existing = await readProfileFromSupabase(fanId);
    const profile: FanFiProfile = existing || {
      fanId,
      handle: params.handle?.trim() || fanId,
      wallet: params.wallet || '',
      completions: [],
      createdAt: now,
      updatedAt: now,
    };

    profile.handle = params.handle?.trim() || profile.handle || fanId;
    profile.wallet = params.wallet || profile.wallet || '';
    profile.updatedAt = now;

    await upsertProfileSupabase(profile, completion);

    // Reload to include the new completion in the returned profile.
    const reloaded = await readProfileFromSupabase(fanId);
    return reloaded || profile;
  }

  // File fallback.
  const profiles = await readProfilesFromFile();
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

  const existingIndex = profile.completions.findIndex((c) => c.missionId === mission.id);
  if (existingIndex >= 0) {
    profile.completions[existingIndex] = completion;
  } else {
    profile.completions.push(completion);
  }

  profile.handle = params.handle?.trim() || profile.handle || fanId;
  profile.wallet = params.wallet || profile.wallet || '';
  profile.updatedAt = now;

  await writeProfilesToFile(profiles);
  return profile;
}

export { FANFI_MISSIONS };

// Internal export for the settle endpoint (atomic increment of reputation per fan).
export { readProfiles };
