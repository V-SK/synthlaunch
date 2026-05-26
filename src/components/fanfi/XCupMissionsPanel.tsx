'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { buildFanFiMissionMessage } from '@/lib/fanfiProofSignature';
import { useI18n } from '@/lib/i18n';

type FanFiMission = {
  id: string;
  category: 'setup' | 'content' | 'prediction' | 'trading' | 'proof';
  title: string;
  points: number;
  description: string;
  proofLabel: string;
  proofPlaceholder: string;
  draft?: string;
};

type FanFiCompletion = {
  missionId: string;
  proof: string;
  points: number;
  completedAt: string;
};

type FanFiProfile = {
  fanId: string;
  handle: string;
  wallet: string;
  completions: FanFiCompletion[];
};

type FanFiLeaderboardEntry = FanFiProfile & {
  rank: number;
  totalPoints: number;
};

const FANFI_FAN_ID_KEY = 'synthlaunch:fanfi-fan-id';
const DEFAULT_FAN_ID = 'fanfi-captain';

const MISSION_ZH: Record<string, Partial<FanFiMission>> = {
  'choose-campaign': {
    title: '选择预测市场',
    description: '选择这个 Arena 要代表的世界杯比赛和客观结算规则。',
    proofLabel: '市场角度',
    proofPlaceholder: '例如：巴西 vs 法国比赛结果，用官方最终比分结算',
  },
  'write-launch-draft': {
    title: '撰写市场简介',
    description: '为 Season One 准备预测题、市场简介、结算说明和 X 账号 hook。',
    proofLabel: '市场文案',
    proofPlaceholder: '把预测题、结算说明、thread hook 或 X 账号文案贴在这里。',
    draft: 'Synth SportFi Arena 把世界杯注意力转化成 X Layer 上的 AI 预测 Arena。创建巴西 vs 法国，提交方向 + 概率 + 理由，按规则结算，冲击排行榜。',
  },
  'submit-prediction': {
    title: '提交预测 Receipt',
    description: '提交方向、概率和理由，后续可根据结算说明进入排行榜。',
    proofLabel: 'Receipt',
    proofPlaceholder: '例如：巴西胜 / 58% / 转换速度和定位球压迫更强',
  },
  'create-fan-content': {
    title: '创建预测观点',
    description: '写一个支持某个预测方向的观点、meme 点子或比赛日论点。',
    proofLabel: '预测观点',
    proofPlaceholder: '例如：预测 thread、meme 标题或比赛日论点',
  },
  'launch-or-attach-token': {
    title: '附加 X Layer 证明',
    description: '附加市场证明、结算证明、prediction receipt hash、市场资产地址或 tx hash。',
    proofLabel: '证明、地址或 tx hash',
    proofPlaceholder: '结算说明、0x... 地址或 X Layer 交易哈希',
  },
  'review-trading-flow': {
    title: '连接 OKX 流程',
    description: '记录热门预测 Arena 计划使用的 watchlist、token 搜索、报价或 swap handoff 路径。',
    proofLabel: '流程备注',
    proofPlaceholder: '例如：检查 OKB 余额，搜索市场资产，再通过 OKX swap UI 生成报价',
  },
};

function getCategoryClasses(category: FanFiMission['category']): string {
  switch (category) {
    case 'setup':
      return 'border-synth-green/30 bg-synth-green/10 text-synth-green';
    case 'content':
      return 'border-synth-cyan/30 bg-synth-cyan/10 text-synth-cyan';
    case 'prediction':
      return 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300';
    case 'trading':
      return 'border-synth-purple/30 bg-synth-purple/10 text-synth-purple';
    case 'proof':
    default:
      return 'border-synth-border bg-synth-surface text-synth-muted';
  }
}

function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function XCupMissionsPanel() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isMounted, setIsMounted] = useState(false);
  const [missions, setMissions] = useState<FanFiMission[]>([]);
  const [profile, setProfile] = useState<FanFiProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<FanFiLeaderboardEntry[]>([]);
  const [fanId, setFanId] = useState(DEFAULT_FAN_ID);
  const [fanIdDraft, setFanIdDraft] = useState(DEFAULT_FAN_ID);
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingMissionId, setSavingMissionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const completedIds = useMemo(
    () => new Set((profile?.completions || []).map((completion) => completion.missionId)),
    [profile]
  );

  const totalPoints = useMemo(
    () => (profile?.completions || []).reduce((sum, completion) => sum + completion.points, 0),
    [profile]
  );

  const currentRank = useMemo(
    () => leaderboard.find((entry) => entry.fanId === profile?.fanId)?.rank || 0,
    [leaderboard, profile?.fanId]
  );
  const walletAddress = isMounted && isConnected ? address : undefined;
  const getDisplayHandle = (entry: FanFiLeaderboardEntry) => {
    const handle = entry.handle || entry.fanId;
    if (handle === 'local-reviewer') return '@SynthFanFi';
    return handle;
  };
  const copy = isZh
    ? {
        loadMissionsError: 'FanFi 任务不可用',
        loadProgressError: 'FanFi 进度不可用',
        loadFailed: '加载 FanFi 任务失败',
        draftCopied: '草稿已复制',
        copyFailed: '复制失败',
        proofRequired: '完成任务前请先添加一条简短证明备注。',
        walletSignRequired: '连接钱包并签名后才能更新预测积分。',
        saveFailed: '保存任务失败',
        saved: '已保存',
        signing: '等待钱包签名...',
        sectionLabel: '预测任务',
        title: '预测积分与任务',
        intro: '提交预测、观点、OKX 路径和链上 proof，让 SportFi Arena 进入公开排行榜竞争。',
        fanId: 'Fan ID',
        load: '载入',
        points: '积分',
        completed: '已完成',
        localRank: '排名',
        wallet: '钱包',
        notConnected: '未连接',
        saving: '保存中...',
        updateProof: '更新证明',
        complete: '完成',
        copyDraft: '复制草稿',
        completedLabel: '已完成',
        board: '预测排行榜',
        refresh: '刷新',
        missions: '个任务',
        pts: '分',
        category: {
          setup: '设置',
          content: '内容',
          prediction: '预测',
          trading: '交易',
          proof: '证明',
        } as Record<FanFiMission['category'], string>,
      }
    : {
        loadMissionsError: 'FanFi missions unavailable',
        loadProgressError: 'FanFi progress unavailable',
        loadFailed: 'Failed to load FanFi missions',
        draftCopied: 'Draft copied',
        copyFailed: 'Copy failed',
        proofRequired: 'Add a short proof note before completing this mission.',
        walletSignRequired: 'Connect a wallet and sign before updating prediction points.',
        saveFailed: 'Failed to save mission',
        saved: 'saved',
        signing: 'Waiting for wallet signature...',
        sectionLabel: 'Prediction Missions',
        title: 'Prediction Points And Missions',
        intro: 'Submit forecasts, arguments, OKX routes, and onchain proof, then compete on the public SportFi leaderboard.',
        fanId: 'Fan ID',
        load: 'Load',
        points: 'Points',
        completed: 'Completed',
        localRank: 'Rank',
        wallet: 'Wallet',
        notConnected: 'Not connected',
        saving: 'Saving...',
        updateProof: 'Update Proof',
        complete: 'Complete',
        copyDraft: 'Copy Draft',
        completedLabel: 'Completed',
        board: 'Prediction Leaderboard',
        refresh: 'Refresh',
        missions: 'missions',
        pts: 'pts',
        category: {
          setup: 'setup',
          content: 'content',
          prediction: 'prediction',
          trading: 'trading',
          proof: 'proof',
        } as Record<FanFiMission['category'], string>,
      };

  const loadProgress = useCallback(async (nextFanId: string) => {
    setLoading(true);
    setError('');

    try {
      const [missionsRes, progressRes] = await Promise.all([
        fetch('/api/fanfi/missions', { cache: 'no-store' }),
        fetch(`/api/fanfi/progress?fanId=${encodeURIComponent(nextFanId)}`, { cache: 'no-store' }),
      ]);

      if (!missionsRes.ok) throw new Error(copy.loadMissionsError);
      if (!progressRes.ok) throw new Error(copy.loadProgressError);

      const missionsData = await missionsRes.json();
      const progressData = await progressRes.json();
      const nextProfile = progressData.profile as FanFiProfile;

      setMissions(Array.isArray(missionsData.missions) ? missionsData.missions : []);
      setProfile(nextProfile);
      setLeaderboard(Array.isArray(progressData.leaderboard) ? progressData.leaderboard : []);
      setProofs((current) => {
        const next = { ...current };
        for (const completion of nextProfile.completions || []) {
          next[completion.missionId] = completion.proof;
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, copy.loadMissionsError, copy.loadProgressError]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedFanId = window.localStorage.getItem(FANFI_FAN_ID_KEY);
    if (storedFanId && storedFanId !== 'local-reviewer') {
      setFanId(storedFanId);
      setFanIdDraft(storedFanId);
    }
  }, []);

  useEffect(() => {
    loadProgress(fanId);
  }, [fanId, loadProgress]);

  useEffect(() => {
    const handleProgressUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ fanId?: string }>).detail;
      const nextFanId = detail?.fanId || fanId;
      setFanId(nextFanId);
      setFanIdDraft(nextFanId);
      void loadProgress(nextFanId);
    };

    window.addEventListener('fanfi-progress-updated', handleProgressUpdated);
    return () => {
      window.removeEventListener('fanfi-progress-updated', handleProgressUpdated);
    };
  }, [fanId, loadProgress]);

  const applyFanId = () => {
    const normalized = fanIdDraft.trim() || DEFAULT_FAN_ID;
    setFanId(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FANFI_FAN_ID_KEY, normalized);
    }
  };

  const copyDraft = async (mission: FanFiMission) => {
    const draft = isZh && MISSION_ZH[mission.id]?.draft ? MISSION_ZH[mission.id]?.draft : mission.draft;
    if (!draft) return;
    try {
      await navigator.clipboard?.writeText(draft);
      setNotice(copy.draftCopied);
    } catch {
      setNotice(copy.copyFailed);
    }
  };

  const completeMission = async (mission: FanFiMission) => {
    const proof = (proofs[mission.id] || '').trim();
    if (proof.length < 4) {
      setError(copy.proofRequired);
      return;
    }
    if (!walletAddress) {
      setError(copy.walletSignRequired);
      return;
    }

    setSavingMissionId(mission.id);
    setError('');
    setNotice(copy.signing);

    try {
      const timestamp = new Date().toISOString();
      const signatureMessage = buildFanFiMissionMessage({
        fanId,
        missionId: mission.id,
        proof,
        wallet: walletAddress,
        timestamp,
      });
      const signature = await signMessageAsync({ message: signatureMessage });
      const res = await fetch('/api/fanfi/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fanId,
          handle: fanIdDraft,
          wallet: walletAddress,
          missionId: mission.id,
          proof,
          timestamp,
          signatureMessage,
          signature,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || copy.saveFailed);
      }

      const data = await res.json();
      setProfile(data.profile);
      setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
      setNotice(`${isZh && MISSION_ZH[mission.id]?.title ? MISSION_ZH[mission.id].title : mission.title} ${copy.saved}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setSavingMissionId('');
    }
  };

  return (
    <section className="border-b border-synth-border">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-cyan">
              {copy.sectionLabel}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {copy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-synth-muted">
              {copy.intro}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.fanId}</span>
              <input
                type="text"
                value={fanIdDraft}
                onChange={(event) => setFanIdDraft(event.target.value)}
                className="input-field w-full sm:w-64"
                placeholder={DEFAULT_FAN_ID}
              />
            </label>
            <button type="button" onClick={applyFanId} className="btn-secondary h-10">
              {copy.load}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.points}</div>
            <div className="mt-3 text-2xl font-bold text-synth-green">{loading ? '...' : totalPoints}</div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.completed}</div>
            <div className="mt-3 text-2xl font-bold text-synth-cyan">
              {loading ? '...' : `${completedIds.size}/${missions.length}`}
            </div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.localRank}</div>
            <div className="mt-3 text-2xl font-bold text-synth-text">{loading ? '...' : currentRank || '-'}</div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">{copy.wallet}</div>
            <div className="mt-3 text-base font-bold text-synth-text">
              {walletAddress ? formatAddress(walletAddress) : copy.notConnected}
            </div>
          </div>
        </div>

        {(error || notice) && (
          <div className={`mt-5 rounded border px-4 py-3 text-sm ${
            error
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : 'border-synth-green/30 bg-synth-green/10 text-synth-green'
          }`}>
            {error || notice}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {missions.map((mission) => {
              const completed = completedIds.has(mission.id);
              const displayMission = isZh ? { ...mission, ...MISSION_ZH[mission.id] } : mission;
              return (
                <article key={mission.id} className="card flex min-h-[270px] flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${getCategoryClasses(mission.category)}`}>
                        {copy.category[mission.category]}
                      </span>
                      <h3 className="mt-4 text-base font-bold text-synth-text">{displayMission.title}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-synth-green">+{mission.points}</div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.pts}</div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-synth-muted">{displayMission.description}</p>

                  <label className="mt-4 block flex-1">
                    <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                      {displayMission.proofLabel}
                    </span>
                    <textarea
                      value={proofs[mission.id] || ''}
                      onChange={(event) => setProofs((current) => ({ ...current, [mission.id]: event.target.value }))}
                      className="input-field min-h-[86px] w-full resize-none"
                      placeholder={displayMission.proofPlaceholder}
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => completeMission(mission)}
                      disabled={!walletAddress || savingMissionId === mission.id}
                      className={`${completed ? 'btn-secondary' : 'btn-primary'} text-xs disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {savingMissionId === mission.id ? copy.saving : completed ? copy.updateProof : copy.complete}
                    </button>
                    {mission.draft && (
                      <button
                        type="button"
                        onClick={() => copyDraft(mission)}
                        className="btn-secondary text-xs"
                      >
                        {copy.copyDraft}
                      </button>
                    )}
                    {completed && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-synth-green">
                        {copy.completedLabel}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-synth-text">{copy.board}</h3>
              <button type="button" onClick={() => loadProgress(fanId)} className="text-[10px] text-synth-cyan hover:text-synth-green">
                {copy.refresh}
              </button>
            </div>
            <div className="space-y-3">
              {leaderboard.slice(0, 6).map((entry) => {
                const active = entry.fanId === profile?.fanId;
                return (
                  <div
                    key={entry.fanId}
                    className={`rounded-lg border p-3 ${
                      active
                        ? 'border-synth-green/40 bg-synth-green/10'
                        : 'border-synth-border bg-synth-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-synth-text">
                          #{entry.rank} {getDisplayHandle(entry)}
                        </div>
                        <div className="mt-1 text-[10px] text-synth-muted">
                          {entry.completions.length} {copy.missions}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-synth-green">{entry.totalPoints}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.pts}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
