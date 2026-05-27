'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { XCupCampaignStudio } from '@/components/fanfi/XCupCampaignStudio';
import { XCupLivePanel } from '@/components/fanfi/XCupLivePanel';
import { XCupMissionsPanel } from '@/components/fanfi/XCupMissionsPanel';
import { XCupSettlementPanel } from '@/components/fanfi/XCupSettlementPanel';
import { XCupTradingProofPanel } from '@/components/fanfi/XCupTradingProofPanel';
import { CHAIN_CONFIG } from '@/lib/contracts';
import { useI18n } from '@/lib/i18n';

type CountdownParts = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

const OPENING_MATCH_AT = Date.UTC(2026, 5, 11, 19, 0, 0);

function getCountdownParts(): CountdownParts {
  const remainingMs = Math.max(0, OPENING_MATCH_AT - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

export function XCupFanFiPageContent() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const [countdownParts, setCountdownParts] = useState<CountdownParts | null>(null);

  useEffect(() => {
    const syncCountdown = () => setCountdownParts(getCountdownParts());
    syncCountdown();
    const timer = window.setInterval(syncCountdown, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const templates = isZh
    ? [
        {
          name: '决赛胜负 Arena',
          symbol: 'FINALX',
          type: '比赛结果预测',
          mission: '围绕巴西 vs 法国这类世界杯比赛生成预测题、规则、receipt proof 和结算说明。',
        },
        {
          name: '巴西晋级 Arena',
          symbol: 'BRZAI',
          type: '球队走势预测',
          mission: '把巴西支持者的方向、概率和理由写成可审计预测 receipt。',
        },
        {
          name: '金靴 Prop Arena',
          symbol: 'SCORER',
          type: '球员数据预测',
          mission: '围绕射手、助攻、最佳球员、扑救和红黄牌创建可客观结算的数据预测。',
        },
        {
          name: 'VAR Meme Market',
          symbol: 'VARDAO',
          type: '舆情与 Meme 预测',
          mission: '只做非现金舆情预测：VAR、点球、红牌和 meme 热度进入积分排行。',
        },
        {
          name: 'OKX Momentum Scout',
          symbol: 'GOALAI',
          type: '交易侦察',
          mission: '热门 Arena 出现后，展示 OKX watchlist、quote 和 swap handoff。',
        },
      ]
    : [
        {
          name: 'Final Result Arena',
          symbol: 'FINALX',
          type: 'Match Result Market',
          mission: 'Generate prediction questions, rules, receipt proof, and settlement notes around World Cup matches like Brazil vs France.',
        },
        {
          name: 'Brazil Bracket Arena',
          symbol: 'BRZAI',
          type: 'Team Path Market',
          mission: 'Turn Brazil supporter direction, probability, and reasoning into an auditable prediction receipt.',
        },
        {
          name: 'Golden Boot Prop Arena',
          symbol: 'SCORER',
          type: 'Player Prop Market',
          mission: 'Create objectively settleable player-data predictions around scorers, assists, best-player calls, saves, and cards.',
        },
        {
          name: 'VAR Meme Market',
          symbol: 'VARDAO',
          type: 'Sentiment Market',
          mission: 'Run non-cash sentiment forecasts around VAR, penalties, red cards, and meme heat for points ranking.',
        },
        {
          name: 'OKX Momentum Scout',
          symbol: 'GOALAI',
          type: 'Trading Scout',
          mission: 'When an arena gets hot, surface OKX watchlists, quotes, and swap handoff.',
        },
      ];

  const productLoop = isZh
    ? [
        {
          label: 'Create',
          title: 'AI 创建 Arena',
          body: '输入巴西 vs 法国，AI 生成预测题、规则、persona、任务和 X 文案。',
        },
        {
          label: 'Predict',
          title: '提交预测 receipt',
          body: '用户填写方向、概率和理由，形成可审计的预测记录。',
        },
        {
          label: 'Proof',
          title: '写入 X Layer',
          body: '钱包确认后，把 prediction receipt / proof 作为 X Layer 行为记录。',
        },
        {
          label: 'Settle',
          title: '结算引擎',
          body: '锁盘、官方数据源、得分规则和 receipt proof 在 Arena 创建时写定，赛后自动进入 reputation。',
        },
        {
          label: 'Rank',
          title: '刷新排行榜',
          body: '按预测准确度、参与度、proof 和任务积分排名。',
        },
        {
          label: 'OKX',
          title: '交易承接',
          body: '热门 Arena 展示 OKX watchlist、quote、balance 和 swap handoff。',
        },
      ]
    : [
        {
          label: 'Create',
          title: 'AI Creates Arena',
          body: 'Enter Brazil vs France; AI generates the question, rules, persona, missions, and X copy.',
        },
        {
          label: 'Predict',
          title: 'Submit Receipt',
          body: 'Users fill direction, probability, and reasoning to create an auditable prediction record.',
        },
        {
          label: 'Proof',
          title: 'Write To X Layer',
          body: 'Wallet confirmation records the prediction receipt / proof as X Layer activity.',
        },
        {
          label: 'Settle',
          title: 'Settlement Engine',
          body: 'Lock time, official source, scoring rules, and receipt proof are written at creation and resolve into reputation.',
        },
        {
          label: 'Rank',
          title: 'Refresh Leaderboard',
          body: 'Rank fans by accuracy, participation, proof, and mission points.',
        },
        {
          label: 'OKX',
          title: 'Route Trading Demand',
          body: 'Hot arenas surface OKX watchlists, quotes, balances, and swap handoff.',
        },
      ];

  const seasonMatches = isZh
    ? [
        {
          label: 'Opening Match',
          title: 'Mexico vs South Africa',
          date: '2026-06-11',
          body: '首场 Arena：胜负方向、上半场进球、首张黄牌和赛前情绪。',
        },
        {
          label: 'Featured Arena',
          title: 'Brazil vs France',
          date: 'Main Route',
          body: '主线 Arena：AI 创建预测题，用户提交方向、概率、理由和 proof。',
        },
        {
          label: 'Final Market',
          title: 'Final Result Arena',
          date: 'Season Close',
          body: '决赛胜负、比分、加时、点球和赛后结算证明。',
        },
      ]
    : [
        {
          label: 'Opening Match',
          title: 'Mexico vs South Africa',
          date: '2026-06-11',
          body: 'First arena: winner, first-half goal, first card, and pre-match sentiment.',
        },
        {
          label: 'Featured Arena',
          title: 'Brazil vs France',
          date: 'Main Route',
          body: 'Primary arena: AI creates the question; users submit direction, probability, reasoning, and proof.',
        },
        {
          label: 'Final Market',
          title: 'Final Result Arena',
          date: 'Season Close',
          body: 'Final winner, scoreline, overtime, penalties, and post-match settlement proof.',
        },
      ];

  // Live Arena Board — pulls real receipts from /api/fanfi/market-proofs.
  // Renders the same visual layout as before but driven by actual signed
  // submissions, with a graceful empty state when no arenas exist yet.
  type LiveLaunch = {
    id: string;
    templateId: string;
    name: string;
    symbol: string;
    targetMatch: string;
    predictionDirection: string | null;
    predictionProbability: number | null;
    settlementSource?: string;
    createdAt: string;
  };
  type ArenaBoardItem = {
    rank: string;
    title: string;
    category: string;
    heat: string;
    receipts: string;
    settlement: string;
    okx: string;
  };
  const [liveLaunches, setLiveLaunches] = useState<LiveLaunch[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);

  const TEMPLATE_DISPLAY: Record<string, { cat: string; okx: string }> = isZh
    ? {
        brazil: { cat: '球队走势预测', okx: 'OKB quote handoff' },
        final: { cat: '比赛结果预测', okx: 'Watchlist handoff' },
        player: { cat: '球员数据预测', okx: 'Target asset review' },
        var: { cat: '舆情与 Meme 预测', okx: 'Momentum scout' },
        scout: { cat: '交易侦察', okx: 'Trade route' },
      }
    : {
        brazil: { cat: 'Team Path Market', okx: 'OKB quote handoff' },
        final: { cat: 'Match Result Market', okx: 'Watchlist handoff' },
        player: { cat: 'Player Prop Market', okx: 'Target asset review' },
        var: { cat: 'Sentiment Market', okx: 'Momentum scout' },
        scout: { cat: 'Trading Scout', okx: 'Trade route' },
      };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/fanfi/market-proofs', { cache: 'no-store' });
        if (!res.ok) throw new Error('not-ok');
        const data = await res.json();
        if (!cancelled) {
          setLiveLaunches(Array.isArray(data.launches) ? (data.launches as LiveLaunch[]) : []);
        }
      } catch {
        if (!cancelled) setLiveLaunches([]);
      } finally {
        if (!cancelled) setLiveLoaded(true);
      }
    };
    void load();
    const handleCreated = () => void load();
    window.addEventListener('fanfi-market-proof-created', handleCreated);
    return () => {
      cancelled = true;
      window.removeEventListener('fanfi-market-proof-created', handleCreated);
    };
  }, []);

  // Count receipts per template (used for the "Receipts" stat on each card).
  const templateCounts = liveLaunches.reduce<Record<string, number>>((acc, L) => {
    acc[L.templateId] = (acc[L.templateId] || 0) + 1;
    return acc;
  }, {});

  const arenaBoard: ArenaBoardItem[] = liveLaunches.slice(0, 4).map((L, i) => {
    const display = TEMPLATE_DISPLAY[L.templateId] || { cat: L.templateId, okx: 'OKX handoff' };
    return {
      rank: String(i + 1).padStart(2, '0'),
      title: L.targetMatch || L.name,
      category: display.cat,
      heat: L.predictionProbability != null ? String(L.predictionProbability) : '—',
      receipts: String(templateCounts[L.templateId] || 1),
      settlement: L.settlementSource || (isZh ? '官方比赛数据' : 'Official match data'),
      okx: display.okx,
    };
  });

  const countdownTiles = [
    [countdownParts?.days || '--', isZh ? '天' : 'Days'],
    [countdownParts?.hours || '--', isZh ? '小时' : 'Hours'],
    [countdownParts?.minutes || '--', isZh ? '分钟' : 'Min'],
    [countdownParts?.seconds || '--', isZh ? '秒' : 'Sec'],
  ];

  const okxAgentPrompt = isZh
    ? '作为 Synth SportFi Arena 的 OKX Agent，请帮我处理 Brazil vs France 预测 Arena：检查我的 X Layer OKB 余额，建立 World Cup watchlist，搜索市场资产，生成 OKB 到目标资产的报价，并输出需要钱包确认的 swap handoff。'
    : 'Act as the OKX Agent for Synth SportFi Arena. For the Brazil vs France prediction arena, check my X Layer OKB balance, build a World Cup watchlist, search market assets, generate an OKB-to-target quote, and return the wallet-confirmed swap handoff.';

  const okxAgentTasks = isZh
    ? [
        ['Balance', '读取 X Layer 钱包余额，确认 OKB 是否足够进入 Arena flow。'],
        ['Watchlist', '把 Brazil vs France、Golden Boot、VAR Heat 等热门 Arena 放入跟踪列表。'],
        ['Quote', '搜索市场资产，生成 OKB 报价和 swap review 路径。'],
        ['Handoff', '把交易执行留给钱包确认，Agent 只做分析、路由和风控说明。'],
      ]
    : [
        ['Balance', 'Read X Layer wallet balances and confirm whether OKB is ready for the arena flow.'],
        ['Watchlist', 'Track hot arenas like Brazil vs France, Golden Boot, and VAR Heat.'],
        ['Quote', 'Search market assets and build OKB quote plus swap review routes.'],
        ['Handoff', 'Leave execution to wallet confirmation while the agent handles analysis, routing, and risk notes.'],
      ];

  const userFlow = isZh
    ? [
        '用户输入 Brazil vs France，AI 创建世界杯 Season One Arena',
        'AI 生成预测题、规则、persona、任务、X 文案和结算说明',
        '用户填写方向、概率和理由，提交 prediction receipt',
        '钱包确认，把 receipt / proof 写到 X Layer',
        '比赛结束后按预设规则结算，排行榜刷新',
        '热门 Arena 展示 OKX watchlist、quote、balance 和 swap handoff',
      ]
    : [
        'User enters Brazil vs France and AI creates a World Cup Season One Arena',
        'AI generates the prediction question, rules, persona, missions, X copy, and settlement note',
        'User fills direction, probability, and reasoning, then submits a prediction receipt',
        'Wallet confirmation writes the receipt / proof to X Layer',
        'After the match, predefined rules settle the result and refresh the leaderboard',
        'Hot arenas surface OKX watchlists, quotes, balances, and swap handoff',
      ];

  const predictionTemplates = isZh
    ? [
        ['Match Result', '胜负、比分、加时、点球大战', 'Final 2-1、90 分钟平局、加时进球'],
        ['Player Props', '射手、助攻、最佳球员、扑救、红黄牌', '金靴、最佳门将、首张黄牌'],
        ['Bracket Path', '晋级路线、爆冷、决赛组合', '巴西进四强、黑马进决赛'],
        ['Sentiment Market', 'VAR、点球、红牌、meme 热度', 'VAR 爆点、点球争议、社媒热度'],
        ['Trading Scout', '预测热度、watchlist、OKX 报价', 'OKB quote、目标资产、动量排行'],
      ]
    : [
        ['Match Result', 'Winner, scoreline, overtime, penalties', 'Final 2-1, draw at 90, overtime goal'],
        ['Player Props', 'Scorers, assists, best player, saves, cards', 'Golden Boot, best keeper, first yellow card'],
        ['Bracket Path', 'Qualification paths, upsets, finalists', 'Brazil semifinal, dark horse finalist'],
        ['Sentiment Market', 'VAR, penalties, red cards, meme heat', 'VAR spike, penalty drama, social heat'],
        ['Trading Scout', 'Prediction heat, watchlists, OKX quotes', 'OKB quote, target asset, momentum rank'],
      ];

  const proofItems = isZh
    ? [
        ['主链', 'X Layer 主网 · chain 196'],
        ['原生代币', 'OKB'],
        ['Flap 入口', CHAIN_CONFIG[196].flapAddress],
        ['托管合约', CHAIN_CONFIG[196].custodyAddress],
        ['标准代币实现', CHAIN_CONFIG[196].tokenImpl.standard],
        ['税费代币实现', CHAIN_CONFIG[196].tokenImpl.tax],
        ['浏览器', CHAIN_CONFIG[196].explorer],
      ]
    : [
        ['Primary chain', 'X Layer mainnet · chain 196'],
        ['Native token', 'OKB'],
        ['Flap portal', CHAIN_CONFIG[196].flapAddress],
        ['Custody', CHAIN_CONFIG[196].custodyAddress],
        ['Standard token implementation', CHAIN_CONFIG[196].tokenImpl.standard],
        ['Tax token implementation', CHAIN_CONFIG[196].tokenImpl.tax],
        ['Explorer', CHAIN_CONFIG[196].explorer],
      ];

  const heroStats = isZh
    ? [
        ['S1', '世界杯 Season One'],
        ['196', 'X Layer Chain'],
        ['OKX', '交易承接'],
      ]
    : [
        ['S1', 'World Cup Season One'],
        ['196', 'X Layer Chain'],
        ['OKX', 'Trading Handoff'],
      ];

  const capabilityStack = isZh
    ? [
        ['AI Arena Creator', '从一场比赛生成预测题、规则、Agent persona、任务、结算说明和 X 文案'],
        ['Prediction Receipt', '用户提交方向、概率、理由，形成 reputation-first 的预测凭证'],
        ['X Layer Proof', '记录 receipt、结算 proof、wallet、X account 和市场资产'],
        ['OKX Handoff', '热门 Arena 承接 watchlist、quote、balance 和 swap review，把交易路径交给 OKX/X Layer'],
      ]
    : [
        ['AI Arena Creator', 'Turns one match into questions, rules, agent persona, missions, settlement notes, and X copy'],
        ['Prediction Receipt', 'Users submit direction, probability, and reasoning as reputation-first receipts'],
        ['X Layer Proof', 'Records receipts, settlement proof, wallet, X account, and market assets'],
        ['OKX Handoff', 'Hot arenas route watchlist, quote, balance, and swap review through OKX/X Layer'],
      ];

  const judgingFit = isZh
    ? [
        ['创新性', 'AI 创建预测 Arena + receipt/proof/reputation，把球迷预测变成可验证链上活动。'],
        ['市场价值', '世界杯用户天然会预测胜负、比分和球员表现，能转成 X Layer 行为和 OKX 流量。'],
        ['完成度', '创建、参与、结算、排行、OKX 承接形成一条完整产品闭环。'],
        ['可验证性', '每个 Arena 都可以绑定钱包、receipt、结算说明、proof 和排行榜记录。'],
      ]
    : [
        ['Innovation', 'AI-created arenas plus receipt/proof/reputation turn fan predictions into verifiable onchain activity.'],
        ['Market Value', 'World Cup users naturally forecast winners, scores, and player performance, becoming X Layer and OKX activity.'],
        ['Completion', 'Create, participate, settle, rank, and OKX handoff form one complete product loop.'],
        ['Verifiability', 'Each arena can bind wallet, receipt, settlement notes, proof, and leaderboard records.'],
      ];

  return (
    <div className="relative left-1/2 min-h-screen w-screen -translate-x-1/2 bg-synth-bg">
      <section className="relative min-h-[560px] overflow-hidden border-b border-synth-border">
        <Image
          src="/fanfi-hero.png"
          alt="Synth SportFi Arena"
          fill
          priority
          className="object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,10,10,0.98),rgba(10,10,10,0.62),rgba(10,10,10,0.9)),linear-gradient(180deg,rgba(10,10,10,0.15),rgba(10,10,10,0.95))]" />
        <div className="relative mx-auto flex min-h-[560px] max-w-7xl flex-col justify-center px-4 py-16">
          <div className="max-w-3xl space-y-7">
            <div className="flex items-center gap-4">
              <Image
                src="/fanfi-logo.png"
                alt="Synth SportFi Arena logo"
                width={76}
                height={76}
                className="rounded border border-synth-green/30 shadow-glow-green"
              />
              <div>
                <div className="text-[10px] uppercase tracking-[0.32em] text-synth-green">
                  {isZh ? 'World Cup Season One · X Layer' : 'World Cup Season One · X Layer'}
                </div>
                <div className="mt-2 text-sm text-synth-muted">
                  {isZh
                    ? '预测 Arena 创建、参与、结算、排行、OKX 承接'
                    : 'Create, predict, settle, rank, and hand off to OKX'}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-bold leading-tight text-synth-text md:text-6xl">
                Synth SportFi Arena
              </h1>
              <p className="max-w-2xl text-base leading-7 text-synth-muted md:text-lg">
                {isZh
                  ? '世界杯 Season One 主线：用户输入 Brazil vs France，AI 生成 Arena；球迷提交方向、概率和理由；钱包确认后写入 X Layer proof；比赛结束按规则结算，排行榜刷新，热门 Arena 交给 OKX watchlist / quote / swap handoff。'
                  : 'World Cup Season One flow: enter Brazil vs France, let AI generate an arena, submit direction, probability, and reasoning, write proof to X Layer, settle by predefined rules, refresh rankings, and hand hot arenas to OKX watchlist / quote / swap flows.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="#fanfi-campaign-studio" className="btn-primary text-center">
                {isZh ? '创建预测 Arena' : 'Create Prediction Arena'}
              </a>
              <a href="#fanfi-settlement-engine" className="btn-secondary text-center">
                {isZh ? '结算引擎' : 'Settlement Engine'}
              </a>
              <a href="#fanfi-trading-proof" className="btn-secondary text-center">
                {isZh ? 'OKX/X Layer 流程' : 'OKX/X Layer Flow'}
              </a>
              <Link href="/leaderboard?chainId=196" className="btn-secondary text-center">
                {isZh ? '预测排行榜' : 'Prediction Leaderboard'}
              </Link>
            </div>
            <div className="grid max-w-2xl grid-cols-3 gap-3">
              {heroStats.map(([value, label]) => (
                <div key={label} className="rounded border border-synth-border bg-synth-bg/70 px-3 py-3">
                  <div className="text-xl font-bold text-synth-green">{value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-synth-muted">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-synth-border bg-synth-surface/30">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-synth-green/20 bg-synth-green/5 p-5">
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {isZh ? 'Season Countdown' : 'Season Countdown'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? '世界杯 Season One 开场' : 'World Cup Season One Kickoff'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-synth-muted">
              {isZh
                ? 'Mexico vs South Africa · 2026-06-11'
                : 'Mexico vs South Africa · 2026-06-11'}
            </p>
            <div className="mt-6 grid grid-cols-4 gap-2">
              {countdownTiles.map(([value, label]) => (
                <div key={label} className="rounded border border-synth-border bg-synth-bg px-3 py-4 text-center">
                  <div className="text-2xl font-bold text-synth-green">{value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-synth-muted">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {seasonMatches.map((match) => (
              <article key={match.title} className="card min-h-[190px]">
                <div className="text-[10px] uppercase tracking-[0.22em] text-synth-cyan">
                  {match.label}
                </div>
                <h3 className="mt-4 text-base font-bold text-synth-text">{match.title}</h3>
                <div className="mt-2 text-xs uppercase tracking-[0.16em] text-synth-green">
                  {match.date}
                </div>
                <p className="mt-4 text-sm leading-6 text-synth-muted">{match.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-synth-border">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-10 md:grid-cols-3 xl:grid-cols-6">
          {productLoop.map((step, index) => (
            <article key={step.title} className="card min-h-[180px]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.22em] text-synth-cyan">
                  {step.label}
                </span>
                <span className="text-xs text-synth-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h2 className="text-base font-bold text-synth-text">{step.title}</h2>
              <p className="mt-3 text-sm leading-6 text-synth-muted">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-b border-synth-border">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
                  {isZh ? 'Arena Board' : 'Arena Board'}
                </span>
                {liveLoaded && liveLaunches.length > 0 && (
                  <span className="rounded border border-synth-green/30 bg-synth-green/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-synth-green">
                    {isZh ? 'Live' : 'Live'}
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-2xl font-bold text-synth-text">
                {isZh ? '像国家队榜一样清楚，但排行对象是预测 Arena' : 'Country-Board Clarity, But Ranked By Prediction Arenas'}
              </h2>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-synth-muted">
                {isZh
                  ? '排行榜数据从 /api/fanfi/market-proofs 实时拉取——每张卡片对应一条签名 receipt。'
                  : 'Live board pulled from /api/fanfi/market-proofs — each card is a wallet-signed receipt.'}
              </p>
            </div>
            <div className="text-xs uppercase tracking-[0.18em] text-synth-muted">
              {isZh ? 'Arena heat · X Layer proof · OKX handoff' : 'Arena heat · X Layer proof · OKX handoff'}
            </div>
          </div>
          {!liveLoaded ? (
            <div className="card text-center text-sm text-synth-muted">
              {isZh ? '加载中...' : 'Loading arena board...'}
            </div>
          ) : arenaBoard.length === 0 ? (
            <div className="card border-synth-green/20 bg-synth-green/5 text-center">
              <h3 className="text-sm font-bold text-synth-green">
                {isZh ? '还没有 Arena — 你来开第一个' : 'No arenas yet — be the first'}
              </h3>
              <p className="mt-3 text-sm leading-6 text-synth-muted">
                {isZh
                  ? '选一个 X Cup 模板，填写预测方向，签名提交 → Arena Board 立刻显示你的 receipt。'
                  : 'Pick an X Cup template, fill in your prediction, sign-and-submit — your receipt appears here instantly.'}
              </p>
              <a href="#fanfi-campaign-studio" className="btn-primary mt-4 inline-block">
                {isZh ? '创建第一个 Arena' : 'Create First Arena'}
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              {arenaBoard.map((arena) => (
                <article key={`${arena.rank}-${arena.title}`} className="card min-h-[230px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-synth-cyan">
                        {arena.category}
                      </div>
                      <h3 className="mt-3 text-base font-bold text-synth-text">{arena.title}</h3>
                    </div>
                    <span className="rounded border border-synth-green/30 bg-synth-green/10 px-2 py-1 text-xs text-synth-green">
                      #{arena.rank}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                        {isZh ? '热度' : 'Heat'}
                      </div>
                      <div className="mt-1 text-lg font-bold text-synth-green">{arena.heat}</div>
                    </div>
                    <div className="rounded border border-synth-border bg-synth-bg px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                        Receipts
                      </div>
                      <div className="mt-1 text-lg font-bold text-synth-text">{arena.receipts}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 text-xs leading-5 text-synth-muted">
                    <div>
                      <span className="text-synth-cyan">{isZh ? '结算' : 'Settlement'}:</span> {arena.settlement}
                    </div>
                    <div>
                      <span className="text-synth-cyan">OKX:</span> {arena.okx}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <XCupSettlementPanel />

      <section id="okx-agent-entry" className="border-b border-synth-border">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {isZh ? 'OKX Agent Entry' : 'OKX Agent Entry'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? '把热门 Arena 交给 OKX Agent 接管' : 'Hand Hot Arenas To The OKX Agent'}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-synth-muted">
              {isZh
                ? '用户不需要自己拆 API：Agent 负责理解预测 Arena、读取余额、搜索资产、生成报价、写 watchlist，并把最终 swap 执行交给钱包确认。'
                : 'Users do not need to wire APIs manually. The agent understands the prediction arena, reads balances, searches assets, builds quotes, writes watchlists, and routes final swap execution to wallet confirmation.'}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={{
                  pathname: '/ai',
                  query: {
                    context: 'fanfi-xcup',
                    prompt: okxAgentPrompt,
                  },
                }}
                className="btn-primary text-center"
              >
                {isZh ? '打开 OKX Agent' : 'Open OKX Agent'}
              </Link>
              <a href="#fanfi-trading-proof" className="btn-secondary text-center">
                {isZh ? '查看 OKX Flow 面板' : 'View OKX Flow Panel'}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {okxAgentTasks.map(([title, body]) => (
              <article key={title} className="card min-h-[132px]">
                <div className="text-sm font-bold text-synth-text">{title}</div>
                <p className="mt-3 text-sm leading-6 text-synth-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-synth-border">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-12 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {isZh ? '产品闭环' : 'Product Loop'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? '一镜到底的产品闭环' : 'The One-Take Product Loop'}
            </h2>
            <div className="mt-6 space-y-3">
              {userFlow.map((item, index) => (
                <div key={item} className="flex gap-3 border-b border-synth-border pb-3 last:border-b-0">
                  <span className="mt-0.5 text-xs text-synth-cyan">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm leading-6 text-synth-muted">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-cyan">
              {isZh ? 'SynthLaunch 能力栈' : 'SynthLaunch Capability Stack'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? 'AI 预测、链上证明、OKX 承接' : 'AI Prediction, Onchain Proof, And OKX Handoff'}
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {capabilityStack.map(([title, body]) => (
                <article key={title} className="card min-h-[132px]">
                  <div className="text-sm font-bold text-synth-text">{title}</div>
                  <p className="mt-3 text-sm leading-6 text-synth-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <XCupCampaignStudio />

      <XCupLivePanel />

      <XCupTradingProofPanel />

      <XCupMissionsPanel />

      <section className="border-b border-synth-border">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="mb-6 max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {isZh ? '评分对齐' : 'Judging Fit'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? '按 X Cup 评分标准组织产品闭环' : 'Built Around X Cup Judging Through A Focused Product Loop'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-synth-muted">
              {isZh
                ? 'X Cup 要求围绕世界杯、X Layer 建设、创新性、市场价值、完成度和链上可验证性。Synth SportFi Arena 把 AI Arena、reputation、proof 和 OKX 承接做成一条可演示闭环。'
                : 'X Cup rewards World Cup focus, X Layer building, innovation, market value, completion, and onchain proof. Synth SportFi Arena turns AI arenas, reputation, proof, and OKX handoff into one showcase-ready product loop.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {judgingFit.map(([title, body]) => (
              <article key={title} className="card min-h-[170px]">
                <h3 className="text-sm font-bold text-synth-text">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-synth-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {isZh ? '预测玩法模板' : 'Prediction Templates'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? '比赛、球员、赛程、舆情、交易五类入口' : 'Match, Player, Bracket, Sentiment, And Trading Entries'}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {predictionTemplates.map(([type, description, examples]) => (
              <article key={type} className="card min-h-[132px]">
                <div className="text-sm font-bold text-synth-text">{type}</div>
                <p className="mt-2 text-sm leading-6 text-synth-muted">{description}</p>
                <p className="mt-3 text-xs leading-5 text-synth-cyan">{examples}</p>
              </article>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {templates.map((template) => (
              <article key={template.symbol} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-synth-text">
                      {template.name}
                    </h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-synth-muted">
                      {template.type}
                    </p>
                  </div>
                  <span className="rounded border border-synth-cyan/30 bg-synth-cyan/10 px-2 py-1 text-xs text-synth-cyan">
                    ${template.symbol}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-synth-muted">
                  {template.mission}
                </p>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-cyan">
              {isZh ? 'X Layer Stack' : 'X Layer Stack'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? '预测、交易、证明的链上基础' : 'Onchain Base For Prediction, Trading, And Proof'}
            </h2>
          </div>
          <div className="card space-y-4">
            {proofItems.map(([label, value]) => (
              <div
                key={label}
                className="border-b border-synth-border pb-4 last:border-b-0 last:pb-0"
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">
                  {label}
                </div>
                <div className="mt-2 break-all text-sm text-synth-text">{value}</div>
              </div>
            ))}
          </div>
          <div className="card border-synth-green/20 bg-synth-green/5">
            <h3 className="text-sm font-bold text-synth-green">
              {isZh ? '钱包确认机制' : 'Wallet Confirmation By Design'}
            </h3>
            <p className="mt-3 text-sm leading-6 text-synth-muted">
              {isZh
                ? '预测证明、市场资产记录和 swap 都走钱包确认流程。页面可以生成模板、quote 和交易路径，但不会绕过用户签名。'
                : 'Prediction proof, market asset records, and swap actions route through wallet confirmation. The page can generate templates, quotes, and trading routes, but it never bypasses user signatures.'}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
