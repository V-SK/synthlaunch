'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccount, useSignMessage } from 'wagmi';
import { buildFanFiReceiptMessage } from '@/lib/fanfiProofSignature';
import { useI18n } from '@/lib/i18n';

type FanFiCampaignTemplate = {
  id: string;
  team: string;
  agentType: string;
  name: string;
  symbol: string;
  description: string;
  mission: string;
  launchTweet: string;
  twitterHandle: string;
};

type FanFiCampaignRecord = {
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
  updatedAt: string;
};

type FanFiMarketProofRecord = {
  id: string;
  fanId: string;
  campaignId: string;
  templateId: string;
  name: string;
  symbol: string;
  tokenAddress: string;
  txHash: string;
  marketCapUsd: number;
  revenueOkb: number;
  createdAt: string;
};

type FanFiCopilotPack = {
  templateId: string;
  agentName: string;
  symbol: string;
  persona: string;
  voice: string;
  campaignMission: string;
  tokenDescription: string;
  launchDraft: string;
  tweetThread: string[];
  okxFlow: string;
  auditNotes: string[];
  generatedAt: string;
  source: 'local-copilot';
};

const FANFI_FAN_ID_KEY = 'synthlaunch:fanfi-fan-id';
const DEFAULT_FAN_ID = 'fanfi-captain';
const DEFAULT_OBJECTIVE_EN = 'Create a World Cup Season One arena with predefined settlement rules.';
const DEFAULT_OBJECTIVE_ZH = '创建一个带预设结算规则的世界杯 Season One Arena。';
const DEFAULT_MATCH_EN = 'Brazil vs France';
const DEFAULT_MATCH_ZH = '巴西 vs 法国';
const DEFAULT_TONE_EN = 'sharp, playful, prediction-first';
const DEFAULT_TONE_ZH = '犀利、有梗、预测优先';
const DEFAULT_DIRECTION_EN = 'Brazil wins';
const DEFAULT_DIRECTION_ZH = '巴西胜';
const DEFAULT_PROBABILITY = '58';
const DEFAULT_REASON_EN = 'Brazil has stronger transition speed and set-piece pressure.';
const DEFAULT_REASON_ZH = '巴西转换速度更强，定位球压迫更有优势。';
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

const TEMPLATE_ZH: Record<string, Partial<FanFiCampaignTemplate>> = {
  brazil: {
    team: '巴西',
    agentType: '球队走势预测',
    name: '巴西晋级 Arena',
    mission: '围绕巴西 vs 法国收集方向、概率和理由，生成可提交、可结算、可排名的预测 receipt。',
  },
  final: {
    team: '决赛',
    agentType: '比赛结果预测',
    name: '决赛胜负 Arena',
    mission: '围绕决赛胜负、比分、加时、点球大战和关键进球生成 AI 预测题、receipt 和结算说明。',
  },
  player: {
    team: '金靴球星',
    agentType: '球员数据预测',
    name: '金靴 Prop Arena',
    mission: '围绕射手榜、助攻、最佳球员、扑救和红黄牌创建球员数据预测挑战。',
  },
  var: {
    team: 'VAR',
    agentType: '舆情预测',
    name: 'VAR Meme Market',
    mission: '把比赛争议转成预测市场：VAR、点球、红牌和 meme 热度都能进入排行榜。',
  },
  scout: {
    team: '射手榜',
    agentType: '交易侦察员',
    name: 'OKX Momentum Scout',
    mission: '追踪预测热度、市场资产、OKX 报价、钱包余额和排行榜动量。',
  },
};

function formatTime(value: string): string {
  const time = new Date(value).getTime();
  if (!time) return 'Unknown';
  return new Date(time).toLocaleString();
}

function getDisplayTemplate(template: FanFiCampaignTemplate, isZh: boolean): FanFiCampaignTemplate {
  if (!isZh) return template;
  return { ...template, ...TEMPLATE_ZH[template.id] };
}

export function XCupCampaignStudio() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isMounted, setIsMounted] = useState(false);
  const [templates, setTemplates] = useState<FanFiCampaignTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<FanFiCampaignRecord[]>([]);
  const [marketProofs, setMarketProofs] = useState<FanFiMarketProofRecord[]>([]);
  const [fanId, setFanId] = useState(DEFAULT_FAN_ID);
  const [activeCampaignId, setActiveCampaignId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('brazil');
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE_EN);
  const [targetMatch, setTargetMatch] = useState(DEFAULT_MATCH_EN);
  const [tone, setTone] = useState(DEFAULT_TONE_EN);
  const [predictionDirection, setPredictionDirection] = useState(DEFAULT_DIRECTION_EN);
  const [predictionProbability, setPredictionProbability] = useState(DEFAULT_PROBABILITY);
  const [predictionReason, setPredictionReason] = useState(DEFAULT_REASON_EN);
  const [tokenAddress, setTokenAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proofCreating, setProofCreating] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [copilotRunning, setCopilotRunning] = useState(false);
  const [copilotPack, setCopilotPack] = useState<FanFiCopilotPack | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || templates[0],
    [selectedTemplateId, templates]
  );
  const walletAddress = isMounted && isConnected ? address : undefined;
  const copy = isZh
    ? {
        unknown: '未知',
        loadCampaignError: '预测 Arena 不可用',
        loadLaunchError: 'Receipt Proof 记录不可用',
        loadFailed: '加载预测 Arena 失败',
        saveFailed: '保存活动失败',
        campaignSaved: '活动已保存',
        copilotFailed: '生成预测 Copilot Pack 失败',
        proofFailed: '提交 Receipt Proof 失败',
        syncFailed: '同步预测排行榜失败',
        copiedDraft: '活动草稿已复制',
        copiedPack: 'Copilot Pack 已复制',
        copyFailed: '复制失败',
        loaded: '活动已载入工作台',
        wallet: '钱包',
        walletMissing: '钱包未连接',
        walletSignRequired: '请先连接钱包，Receipt Proof 需要钱包签名。',
        signing: '等待钱包签名...',
        headingLabel: 'Prediction Arena Studio',
        heading: '创建 X Cup 预测 Arena',
        intro: '选择比赛、球队、球员、meme 或交易模板，AI 生成预测题、结算规则、Agent persona、社媒文案和排行榜任务；市场资产用于承接高热度 Arena 的交易路径。',
        fanId: 'Fan ID',
        matchAngle: '比赛',
        matchPlaceholder: '巴西 vs 法国',
        objective: '规则与结算',
        objectivePlaceholder: '预测什么？结算来源是什么？',
        predictionDirection: '预测方向',
        directionPlaceholder: '巴西胜 / 法国胜 / 2-1 / 加时...',
        predictionProbability: '概率 %',
        probabilityPlaceholder: '58',
        predictionReason: '理由',
        reasonPlaceholder: '为什么这样判断？',
        tone: 'Agent 语气',
        tonePlaceholder: '犀利、分析型、meme 密集...',
        tokenProof: 'Receipt / 链上证明 / 市场资产',
        tokenPlaceholder: '可填写 receipt hash、market proof、token address 或 tx hash',
        packLabel: '预测 Agent Copilot Pack',
        copyPack: '复制 Pack',
        persona: '角色设定',
        okxFlow: 'OKX/结算流程',
        draft: '市场草稿',
        generating: '生成中...',
        generatePack: '生成预测 Agent',
        saving: '保存中...',
        saveCampaign: '保存 Arena',
        creating: '创建中...',
        createProof: '提交 Receipt Proof',
        preparing: '准备中...',
        runAudit: '同步预测榜',
        launchLocked: '附加市场资产',
        localCampaigns: '预测 Arena',
        proofCount: 'Proof Records',
        refresh: '刷新',
        proofLabel: 'Proof',
        edit: '编辑',
        copyDraft: '复制草稿',
        campaignLaunchLocked: '附加资产',
        token: 'Token',
        emptyTitle: '还没有预测 Arena',
        emptyBody: '选择一个 X Cup 模板，填写预测玩法，然后创建第一个 Arena。',
      }
    : {
        unknown: 'Unknown',
        loadCampaignError: 'Prediction arenas unavailable',
        loadLaunchError: 'Receipt proof records unavailable',
        loadFailed: 'Failed to load prediction arenas',
        saveFailed: 'Failed to save campaign',
        campaignSaved: 'Campaign saved',
        copilotFailed: 'Failed to generate prediction copilot pack',
        proofFailed: 'Failed to submit receipt proof',
        syncFailed: 'Failed to sync prediction leaderboard',
        copiedDraft: 'Campaign draft copied',
        copiedPack: 'Copilot pack copied',
        copyFailed: 'Copy failed',
        loaded: 'Campaign loaded into studio',
        wallet: 'Wallet',
        walletMissing: 'Wallet not connected',
        walletSignRequired: 'Connect a wallet first. Receipt proof requires wallet signature.',
        signing: 'Waiting for wallet signature...',
        headingLabel: 'Prediction Arena Studio',
        heading: 'Create An X Cup Prediction Arena',
        intro: 'Choose a match, team, player, meme, or trading template, then let AI generate prediction questions, settlement rules, agent persona, social copy, and leaderboard missions. Market assets route trading demand from high-heat arenas.',
        fanId: 'Fan ID',
        matchAngle: 'Match',
        matchPlaceholder: 'Brazil vs France',
        objective: 'Rules And Settlement',
        objectivePlaceholder: 'What is predicted, and what source settles it?',
        predictionDirection: 'Direction',
        directionPlaceholder: 'Brazil wins / France wins / 2-1 / overtime...',
        predictionProbability: 'Probability %',
        probabilityPlaceholder: '58',
        predictionReason: 'Reasoning',
        reasonPlaceholder: 'Why this call?',
        tone: 'Agent Tone',
        tonePlaceholder: 'sharp, analytical, meme-heavy...',
        tokenProof: 'Receipt / Proof / Market Asset',
        tokenPlaceholder: 'Receipt hash, market proof, token address, or tx hash',
        packLabel: 'Prediction Agent Copilot Pack',
        copyPack: 'Copy Pack',
        persona: 'Persona',
        okxFlow: 'OKX / Settlement Flow',
        draft: 'Market Draft',
        generating: 'Generating...',
        generatePack: 'Generate Prediction Agent',
        saving: 'Saving...',
        saveCampaign: 'Save Arena',
        creating: 'Creating...',
        createProof: 'Submit Receipt Proof',
        preparing: 'Preparing...',
        runAudit: 'Sync Prediction Board',
        launchLocked: 'Attach Market Asset',
        localCampaigns: 'Prediction Arenas',
        proofCount: 'Proof Records',
        refresh: 'Refresh',
        proofLabel: 'Proof',
        edit: 'Edit',
        copyDraft: 'Copy Draft',
        campaignLaunchLocked: 'Attach Asset',
        token: 'Token',
        emptyTitle: 'No prediction arenas yet',
        emptyBody: 'Pick an X Cup template, define the prediction format, and create the first arena.',
      };

  const loadCampaigns = useCallback(async (nextFanId: string) => {
    setLoading(true);
    setError('');

    try {
      const [campaignsRes, launchesRes] = await Promise.all([
        fetch(`/api/fanfi/campaigns?fanId=${encodeURIComponent(nextFanId)}`, { cache: 'no-store' }),
        fetch(`/api/fanfi/market-proofs?fanId=${encodeURIComponent(nextFanId)}`, { cache: 'no-store' }),
      ]);

      if (!campaignsRes.ok) throw new Error(copy.loadCampaignError);
      if (!launchesRes.ok) throw new Error(copy.loadLaunchError);

      const [data, launchesData] = await Promise.all([
        campaignsRes.json(),
        launchesRes.json(),
      ]);
      const nextTemplates = Array.isArray(data.templates) ? data.templates : [];
      setTemplates(nextTemplates);
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setMarketProofs(Array.isArray(launchesData.launches) ? launchesData.launches : []);
      if (nextTemplates.length > 0 && !nextTemplates.some((template: FanFiCampaignTemplate) => template.id === selectedTemplateId)) {
        setSelectedTemplateId(nextTemplates[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadCampaignError, copy.loadFailed, copy.loadLaunchError, selectedTemplateId]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setObjective((current) => {
      if (isZh && current === DEFAULT_OBJECTIVE_EN) return DEFAULT_OBJECTIVE_ZH;
      if (!isZh && current === DEFAULT_OBJECTIVE_ZH) return DEFAULT_OBJECTIVE_EN;
      return current;
    });
    setTargetMatch((current) => {
      if (isZh && current === DEFAULT_MATCH_EN) return DEFAULT_MATCH_ZH;
      if (!isZh && current === DEFAULT_MATCH_ZH) return DEFAULT_MATCH_EN;
      return current;
    });
    setTone((current) => {
      if (isZh && current === DEFAULT_TONE_EN) return DEFAULT_TONE_ZH;
      if (!isZh && current === DEFAULT_TONE_ZH) return DEFAULT_TONE_EN;
      return current;
    });
    setPredictionDirection((current) => {
      if (isZh && current === DEFAULT_DIRECTION_EN) return DEFAULT_DIRECTION_ZH;
      if (!isZh && current === DEFAULT_DIRECTION_ZH) return DEFAULT_DIRECTION_EN;
      return current;
    });
    setPredictionReason((current) => {
      if (isZh && current === DEFAULT_REASON_EN) return DEFAULT_REASON_ZH;
      if (!isZh && current === DEFAULT_REASON_ZH) return DEFAULT_REASON_EN;
      return current;
    });
  }, [isZh]);

  const buildArenaObjective = () => {
    const parts = [objective.trim()];
    if (predictionDirection.trim()) {
      parts.push(`${isZh ? '预测方向' : 'Direction'}: ${predictionDirection.trim()}`);
    }
    if (predictionProbability.trim()) {
      parts.push(`${isZh ? '概率' : 'Probability'}: ${predictionProbability.trim()}%`);
    }
    if (predictionReason.trim()) {
      parts.push(`${isZh ? '理由' : 'Reasoning'}: ${predictionReason.trim()}`);
    }
    return parts.filter(Boolean).join('\n');
  };

  const buildSignedProofPayload = async () => {
    if (!walletAddress) {
      throw new Error(copy.walletSignRequired);
    }

    const proofObjective = buildArenaObjective();
    const timestamp = new Date().toISOString();
    const xLayerTxHash = TX_HASH_RE.test(tokenAddress.trim()) ? tokenAddress.trim() : '';
    const signatureMessage = buildFanFiReceiptMessage({
      fanId,
      templateId: selectedTemplateId,
      objective: proofObjective,
      targetMatch,
      tone,
      wallet: walletAddress,
      xLayerTxHash,
      timestamp,
    });
    const signature = await signMessageAsync({ message: signatureMessage });

    return {
      fanId,
      campaignId: activeCampaignId || undefined,
      templateId: selectedTemplateId,
      objective: proofObjective,
      targetMatch,
      tone,
      wallet: walletAddress,
      xLayerTxHash,
      timestamp,
      signatureMessage,
      signature,
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedFanId = window.localStorage.getItem(FANFI_FAN_ID_KEY);
    if (storedFanId && storedFanId !== 'local-reviewer') {
      setFanId(storedFanId);
    }
  }, []);

  useEffect(() => {
    loadCampaigns(fanId);
  }, [fanId, loadCampaigns]);

  const saveCampaign = async () => {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/fanfi/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeCampaignId || undefined,
          fanId,
          templateId: selectedTemplateId,
          objective: buildArenaObjective(),
          targetMatch,
          tone,
          tokenAddress,
          launchDraft: copilotPack?.templateId === selectedTemplateId ? copilotPack.launchDraft : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || copy.saveFailed);
      }

      const data = await res.json();
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setActiveCampaignId(data.campaign?.id || activeCampaignId);
      setTokenAddress(data.campaign?.tokenAddress || tokenAddress);
      setNotice(copy.campaignSaved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const generateCopilotPack = async () => {
    setCopilotRunning(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/fanfi/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fanId,
          templateId: selectedTemplateId,
          objective: buildArenaObjective(),
          targetMatch,
          tone,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || copy.copilotFailed);
      }

      const pack = data.pack as FanFiCopilotPack;
      setCopilotPack(pack);
      setObjective(pack.campaignMission);
      setTone(pack.voice);
      setNotice(isZh ? `${pack.agentName} 的预测 Pack 已准备好` : `Prediction pack ready for ${pack.agentName}`);
    } catch (copilotError) {
      setError(copilotError instanceof Error ? copilotError.message : copy.copilotFailed);
    } finally {
      setCopilotRunning(false);
    }
  };

  const createMarketProof = async () => {
    setProofCreating(true);
    setError('');
    setNotice('');

    try {
      setNotice(copy.signing);
      const proofPayload = await buildSignedProofPayload();
      const res = await fetch('/api/fanfi/market-proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proofPayload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || copy.proofFailed);
      }

      const data = await res.json();
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setMarketProofs(Array.isArray(data.launches) ? data.launches : []);
      setActiveCampaignId(data.campaign?.id || '');
      setTokenAddress(data.launch?.tokenAddress || '');
      setNotice(isZh ? `${data.launch?.symbol || ''} Receipt Proof 已提交` : `${data.launch?.symbol || ''} receipt proof submitted`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fanfi-market-proof-created'));
      }
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : copy.proofFailed);
    } finally {
      setProofCreating(false);
    }
  };

  const syncPredictionBoard = async () => {
    setAuditRunning(true);
    setError('');
    setNotice('');

    try {
      setNotice(copy.signing);
      const proofPayload = await buildSignedProofPayload();
      const res = await fetch('/api/fanfi/sync-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proofPayload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || copy.syncFailed);
      }

      const data = await res.json();
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setMarketProofs(Array.isArray(data.launches) ? data.launches : []);
      setActiveCampaignId(data.campaign?.id || '');
      setTokenAddress(data.launch?.tokenAddress || '');
      setNotice(isZh ? `预测排行榜已同步：${data.launch?.symbol || selectedTemplate?.symbol || 'proof'}` : `Prediction leaderboard synced: ${data.launch?.symbol || selectedTemplate?.symbol || 'proof'}`);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(FANFI_FAN_ID_KEY, fanId);
        window.dispatchEvent(new CustomEvent('fanfi-market-proof-created'));
        window.dispatchEvent(new CustomEvent('fanfi-progress-updated', { detail: { fanId } }));
      }
    } catch (auditError) {
      setError(auditError instanceof Error ? auditError.message : copy.syncFailed);
    } finally {
      setAuditRunning(false);
    }
  };

  const copyDraft = async (campaign: FanFiCampaignRecord) => {
    try {
      await navigator.clipboard?.writeText(campaign.launchDraft);
      setNotice(copy.copiedDraft);
    } catch {
      setNotice(copy.copyFailed);
    }
  };

  const copyCopilotPack = async () => {
    if (!copilotPack) return;

    try {
      await navigator.clipboard?.writeText([
        copilotPack.persona,
        '',
        copilotPack.launchDraft,
        '',
        isZh ? '推文 thread：' : 'Tweet thread:',
        ...copilotPack.tweetThread.map((item, index) => `${index + 1}. ${item}`),
      ].join('\n'));
      setNotice(copy.copiedPack);
    } catch {
      setNotice(copy.copyFailed);
    }
  };

  const importCampaign = (campaign: FanFiCampaignRecord) => {
    setActiveCampaignId(campaign.id);
    setSelectedTemplateId(campaign.templateId);
    setObjective(campaign.objective);
    setTargetMatch(campaign.targetMatch);
    setTone(campaign.tone);
    setTokenAddress(campaign.tokenAddress);
    setCopilotPack(null);
    setNotice(copy.loaded);
  };

  return (
    <section id="fanfi-campaign-studio" className="border-b border-synth-border">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {copy.headingLabel}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {copy.heading}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-synth-muted">
              {copy.intro}
            </p>
          </div>
          <div className="text-[10px] text-synth-muted">
            {walletAddress ? `${copy.wallet} ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : copy.walletMissing}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {templates.map((template) => {
                const active = selectedTemplateId === template.id;
                const displayTemplate = getDisplayTemplate(template, isZh);
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setActiveCampaignId('');
                      setSelectedTemplateId(template.id);
                      setTargetMatch(displayTemplate.team);
                      setObjective(displayTemplate.mission);
                      setTokenAddress('');
                      setCopilotPack(null);
                    }}
                    className={`rounded-lg border p-4 text-left transition-all duration-200 ${
                      active
                        ? 'border-synth-green bg-synth-green/10'
                        : 'border-synth-border bg-synth-surface hover:border-synth-green/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-synth-text">{displayTemplate.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                          {displayTemplate.team} / {displayTemplate.agentType}
                        </div>
                      </div>
                      <span className="rounded border border-synth-cyan/30 bg-synth-cyan/10 px-2 py-1 text-xs text-synth-cyan">
                        ${template.symbol}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-synth-muted">{displayTemplate.mission}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.fanId}</span>
                <input
                  value={fanId}
                  onChange={(event) => {
                    setFanId(event.target.value);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(FANFI_FAN_ID_KEY, event.target.value);
                    }
                  }}
                  className="input-field w-full"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.matchAngle}</span>
                <input
                  value={targetMatch}
                  onChange={(event) => setTargetMatch(event.target.value)}
                  className="input-field w-full"
                  placeholder={copy.matchPlaceholder}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.objective}</span>
              <textarea
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                className="input-field min-h-[92px] w-full resize-none"
                placeholder={copy.objectivePlaceholder}
              />
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_0.45fr_1.35fr]">
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.predictionDirection}</span>
                <input
                  value={predictionDirection}
                  onChange={(event) => setPredictionDirection(event.target.value)}
                  className="input-field w-full"
                  placeholder={copy.directionPlaceholder}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.predictionProbability}</span>
                <input
                  value={predictionProbability}
                  onChange={(event) => setPredictionProbability(event.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
                  className="input-field w-full"
                  inputMode="decimal"
                  placeholder={copy.probabilityPlaceholder}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.predictionReason}</span>
                <input
                  value={predictionReason}
                  onChange={(event) => setPredictionReason(event.target.value)}
                  className="input-field w-full"
                  placeholder={copy.reasonPlaceholder}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.tone}</span>
                <input
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                  className="input-field w-full"
                  placeholder={copy.tonePlaceholder}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-synth-muted">{copy.tokenProof}</span>
                <input
                  value={tokenAddress}
                  onChange={(event) => setTokenAddress(event.target.value)}
                  className="input-field w-full"
                  placeholder={copy.tokenPlaceholder}
                />
              </label>
            </div>

            {(error || notice) && (
              <div className={`rounded border px-4 py-3 text-sm ${
                error
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-synth-green/30 bg-synth-green/10 text-synth-green'
              }`}>
                {error || notice}
              </div>
            )}

            {copilotPack && (
              <div className="rounded-lg border border-synth-cyan/30 bg-synth-cyan/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-synth-cyan">
                      {copy.packLabel}
                    </div>
                    <h3 className="mt-2 text-base font-bold text-synth-text">
                      {copilotPack.agentName} · ${copilotPack.symbol}
                    </h3>
                  </div>
                  <button type="button" onClick={copyCopilotPack} className="btn-secondary text-xs">
                    {copy.copyPack}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                      {copy.persona}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-synth-text">{copilotPack.persona}</p>
                  </div>
                  <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                      {copy.okxFlow}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-synth-text">{copilotPack.okxFlow}</p>
                  </div>
                </div>
                <div className="mt-3 rounded border border-synth-border bg-synth-bg px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {copy.draft}
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-synth-muted">
                    {copilotPack.launchDraft}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={generateCopilotPack} disabled={copilotRunning || saving || loading} className="btn-secondary">
                {copilotRunning ? copy.generating : copy.generatePack}
              </button>
              <button type="button" onClick={saveCampaign} disabled={saving || loading} className="btn-primary">
                {saving ? copy.saving : copy.saveCampaign}
              </button>
              <button type="button" onClick={createMarketProof} disabled={!walletAddress || proofCreating || saving || loading || auditRunning} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50">
                {proofCreating ? copy.creating : copy.createProof}
              </button>
              <button type="button" onClick={syncPredictionBoard} disabled={!walletAddress || auditRunning || proofCreating || saving || loading} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                {auditRunning ? copy.preparing : copy.runAudit}
              </button>
              <Link
                href={`/launch?chainId=196&xcupPreset=${selectedTemplateId}`}
                className="btn-secondary"
              >
                {copy.launchLocked}
              </Link>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-synth-text">{copy.localCampaigns}</h3>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-synth-muted">{copy.proofCount} {marketProofs.length}</span>
                <button type="button" onClick={() => loadCampaigns(fanId)} className="text-[10px] text-synth-cyan hover:text-synth-green">
                  {copy.refresh}
                </button>
              </div>
            </div>

            {campaigns.length > 0 ? (
              <div className="space-y-3">
                {campaigns.slice(0, 5).map((campaign) => {
                  const displayTemplate = templates.find((template) => template.id === campaign.templateId);
                  const displayTitle = displayTemplate ? getDisplayTemplate(displayTemplate, isZh).name : campaign.title;

                  return (
                    <div key={campaign.id} className="rounded-lg border border-synth-border bg-synth-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-synth-text">{displayTitle}</div>
                          <div className="mt-1 text-xs text-synth-muted">${campaign.symbol} / {campaign.status}</div>
                        </div>
                        <span className="text-[10px] text-synth-muted">{formatTime(campaign.updatedAt)}</span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-synth-muted">{campaign.objective}</p>
                      {campaign.tokenAddress && (
                        <div className="mt-3 break-all rounded border border-synth-green/20 bg-synth-green/5 px-3 py-2 text-[10px] text-synth-green">
                          {copy.proofLabel} {campaign.tokenAddress}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => importCampaign(campaign)} className="btn-secondary text-xs">
                          {copy.edit}
                        </button>
                        <button type="button" onClick={() => copyDraft(campaign)} className="btn-secondary text-xs">
                          {copy.copyDraft}
                        </button>
                        <Link
                          href={`/launch?chainId=196&xcupPreset=${campaign.templateId}`}
                          className="btn-secondary text-xs"
                        >
                          {copy.campaignLaunchLocked}
                        </Link>
                        {campaign.tokenAddress && (
                          <Link href={`/token/${campaign.tokenAddress}?chainId=196`} className="btn-secondary text-xs">
                            {copy.token}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-synth-border bg-synth-surface p-4">
                <h3 className="text-sm font-bold text-synth-text">{copy.emptyTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-synth-muted">
                  {copy.emptyBody}
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
