'use client';

import Link from 'next/link';
import { CHAIN_CONFIG } from '@/lib/contracts';
import { useI18n } from '@/lib/i18n';

type AuditStatus = 'ready' | 'local' | 'blocked' | 'next';

type AuditItem = {
  label: string;
  status: AuditStatus;
  evidence: string;
  next: string;
};

const statusStyles: Record<AuditStatus, string> = {
  ready: 'border-synth-green/30 bg-synth-green/10 text-synth-green',
  local: 'border-synth-cyan/30 bg-synth-cyan/10 text-synth-cyan',
  next: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
  blocked: 'border-red-400/30 bg-red-400/10 text-red-300',
};

function StatusBadge({ status, isZh }: { status: AuditStatus; isZh: boolean }) {
  const labels: Record<AuditStatus, string> = isZh
    ? { ready: '就绪', local: '已接入', next: '待接入', blocked: '待审批' }
    : { ready: 'Ready', local: 'Wired', next: 'Next', blocked: 'Approval' };

  return (
    <span className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${statusStyles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function XCupAuditPageContent() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  const auditItems: AuditItem[] = isZh
    ? [
        {
          label: 'SportFi Prediction Arena 路由',
          status: 'ready',
          evidence: '/fanfi/xcup 已渲染 X Cup 预测产品面、Prediction Studio、实时 feed、任务和链配置证明。',
          next: '作为 X Cup Season One 主入口展示。',
        },
        {
          label: 'X Cup 预测模板',
          status: 'ready',
          evidence: '比赛结果、球队走势、球员数据、舆情/meme、Trading Scout 五类预测模板已接入流程。',
          next: '只有当演示故事需要时，再补 2-3 个球队/球员预测变体。',
        },
        {
          label: '预测榜同步模式',
          status: 'local',
          evidence: '同步预测榜需要钱包签名 receipt；签名通过后才会创建预测 Arena、Market Proof 和任务完成记录。',
          next: '正式数据源接入后保留同一产品交互，并把 reputation 绑定到结算结果。',
        },
        {
          label: '结算引擎展示层',
          status: 'ready',
          evidence: '主页面已展示 Open、Lock、Resolve、Score、Route 五段结算流程；OKLink 只会在真实 X Layer tx 校验通过后显示。',
          next: '把最终采用的比赛数据源写入每个正式 Arena 的 settlementSource。',
        },
        {
          label: 'X Layer 证明/资产注册表',
          status: 'local',
          evidence: 'Token API 支持 chainId=196，但只会展示能匹配有效签名 Market Proof 的 FanFi proof token；当前没有有效签名 proof 时 feed 为空。',
          next: '接入至少一个真实 X Layer proof 或市场资产记录后，再用于对外演示。',
        },
        {
          label: '预测排行榜',
          status: 'local',
          evidence: '预测积分和 X Layer 资产排行榜可以渲染；任务积分更新现在也需要钱包签名。',
          next: '后续接入真实预测结算、链上活动、手续费事件和资产所有权。',
        },
        {
          label: '钱包连接',
          status: 'ready',
          evidence: '钱包 hydration/runtime 错误已加保护，连接状态会显示在 SportFi 面板中。',
          next: '公开前再用 OKX Wallet 和 MetaMask 各测一轮。',
        },
        {
          label: '真实 X Layer 预测证明',
          status: 'next',
          evidence: '页面已列出 X Layer 链配置；当前仍需至少一个真实 OKLink 可验证 tx 才能形成最终链上证据。',
          next: '保存至少一个真实 X Layer proof 或市场资产 OKLink 链接。',
        },
        {
          label: 'AI 生成深度',
          status: 'local',
          evidence: 'Prediction Agent Copilot 可生成角色、预测题、结算说明、市场草稿、thread 和 OKX 流程说明。',
          next: '后续可把确定性 copilot 扩展为 live model generation。',
        },
        {
          label: 'OKX 交易流程',
          status: 'local',
          evidence: 'Trading Proof 已展示 OKX 资产搜索、钱包余额和报价 probe。',
          next: '配置 OKX 凭证并用真实市场资产测试。',
        },
        {
          label: '资产详情预测证明',
          status: 'local',
          evidence: '资产详情页展示层已接好，但交接里的旧测试 token 不再算有效签名 proof。',
          next: '用钱包签名创建新 proof，并附加真实 X Layer tx 后再作为审计样本。',
        },
        {
          label: '生产持久化',
          status: 'blocked',
          evidence: '活动、任务和证明数据已完成页面闭环，生产数据表待创建。',
          next: '创建 Supabase 表，并启用生产持久化。',
        },
        {
          label: '公开提交材料',
          status: 'local',
          evidence: '提交 brief 已记录产品流程、剩余审批项和演示脚本。',
          next: '转成最终 README、X thread、视频和表单提交材料。',
        },
      ]
    : [
        {
          label: 'SportFi Prediction Arena route',
          status: 'ready',
          evidence: '/fanfi/xcup renders the X Cup prediction surface, Prediction Studio, live feed, missions, and chain proof.',
          next: 'Use it as the X Cup Season One entry surface.',
        },
        {
          label: 'X Cup prediction presets',
          status: 'ready',
          evidence: 'Match result, team path, player prop, sentiment/meme, and Trading Scout templates are wired into the flow.',
          next: 'Add 2-3 custom team/player prediction variants only if the product story needs them.',
        },
        {
          label: 'Prediction board sync mode',
          status: 'local',
          evidence: 'Sync Prediction Board now requires a wallet-signed receipt before it creates a prediction arena, market proof, and mission completions.',
          next: 'Keep the same product interaction when the production data source is attached, then bind reputation to settlement results.',
        },
        {
          label: 'Settlement engine surface',
          status: 'ready',
          evidence: 'The main page shows Open, Lock, Resolve, Score, and Route steps; OKLink only appears after a real X Layer tx passes verification.',
          next: 'Write the final match data source into settlementSource for each production arena.',
        },
        {
          label: 'X Layer proof / asset registry',
          status: 'local',
          evidence: 'Token APIs accept chainId=196, but FanFi proof tokens only appear when they match a valid signed Market Proof; the feed is empty when no valid signed proof exists.',
          next: 'Attach at least one real X Layer proof or market asset record before external review.',
        },
        {
          label: 'Prediction leaderboard',
          status: 'local',
          evidence: 'Prediction points and X Layer asset leaderboard surfaces render; mission point updates now require wallet signatures.',
          next: 'Bind ranking to real prediction settlement, chain activity, fee events, and asset ownership.',
        },
        {
          label: 'Wallet connection',
          status: 'ready',
          evidence: 'Hydration/runtime wallet errors are guarded, and connected wallet state displays in SportFi panels.',
          next: 'Test with OKX Wallet and MetaMask before public release.',
        },
        {
          label: 'Real X Layer prediction proof',
          status: 'next',
          evidence: 'The page lists X Layer chain configuration; final evidence still needs at least one real OKLink-verifiable tx.',
          next: 'Capture at least one real X Layer proof or market asset OKLink link.',
        },
        {
          label: 'AI generation depth',
          status: 'local',
          evidence: 'Prediction Agent Copilot now generates a persona, prediction question, settlement note, market draft, tweet thread, and OKX flow notes.',
          next: 'Expand the deterministic copilot into live model generation when ready.',
        },
        {
          label: 'OKX trading loop',
          status: 'local',
          evidence: 'Trading Proof now exposes OKX asset search, wallet balance, and quote probes on the X Cup surface.',
          next: 'Configure OKX credentials and test against a real market asset.',
        },
        {
          label: 'Asset detail prediction proof',
          status: 'local',
          evidence: 'The asset detail display layer is wired, but old handoff test tokens no longer count as valid signed proof.',
          next: 'Create a fresh wallet-signed proof and attach a real X Layer tx before using it as the audit sample.',
        },
        {
          label: 'Production persistence',
          status: 'blocked',
          evidence: 'Campaign, mission, and proof surfaces are complete; production tables remain to be created.',
          next: 'Create Supabase tables and enable production persistence.',
        },
        {
          label: 'Public submission package',
          status: 'local',
          evidence: 'A submission brief now documents product flow, remaining approvals, and video script.',
          next: 'Turn the brief into final README copy, X thread, video, and Google Form package.',
        },
      ];

  const readiness = isZh
    ? [
        { value: '75%', label: '提交准备度', detail: '预测 Arena、结算、排行榜和 OKX 承接已成型；真实链上 proof 和持久化仍是主要缺口。' },
        { value: '90%', label: '产品演示准备度', detail: 'Copilot、结算引擎、签名预测榜同步、proof 面板和 OKX 检查已形成本地演示路径。' },
        { value: '1', label: 'Season One 主入口', detail: 'SportFi Prediction Arena 聚焦世界杯 X Cup 场景。' },
        { value: '1+', label: '需要真实 Proof', detail: '至少需要一个可由 OKLink 验证的 X Layer proof 或市场资产。' },
      ]
    : [
        { value: '75%', label: 'Submission Readiness', detail: 'Prediction arenas, settlement, ranking, and OKX handoff are in place; real chain proof and persistence remain the main gaps.' },
        { value: '90%', label: 'Product Showcase Readiness', detail: 'Copilot, settlement engine, signed board sync, proof panel, and OKX checks now form a local showcase path.' },
        { value: '1', label: 'Season One Entry', detail: 'SportFi Prediction Arena focuses the product on the World Cup X Cup scene.' },
        { value: '1+', label: 'Real Proof Needed', detail: 'At least one OKLink-verifiable X Layer proof or market asset is required.' },
      ];

  const proofRows = isZh
    ? [
        ['路由', '/fanfi/xcup'],
        ['准备看板', '/fanfi/xcup/audit'],
        ['提交 brief', 'docs/FANFI_XCUP_LOCAL_AUDIT.md'],
        ['主链', 'X Layer 主网 · chain 196'],
        ['原生代币', 'OKB'],
        ['Flap 入口', CHAIN_CONFIG[196].flapAddress],
        ['托管合约', CHAIN_CONFIG[196].custodyAddress],
        ['标准代币实现', CHAIN_CONFIG[196].tokenImpl.standard],
        ['税费代币实现', CHAIN_CONFIG[196].tokenImpl.tax],
        ['浏览器', CHAIN_CONFIG[196].explorer],
      ]
    : [
        ['Route', '/fanfi/xcup'],
        ['Readiness route', '/fanfi/xcup/audit'],
        ['Submission brief', 'docs/FANFI_XCUP_LOCAL_AUDIT.md'],
        ['Primary chain', 'X Layer mainnet · chain 196'],
        ['Native token', 'OKB'],
        ['Flap portal', CHAIN_CONFIG[196].flapAddress],
        ['Custody', CHAIN_CONFIG[196].custodyAddress],
        ['Standard token implementation', CHAIN_CONFIG[196].tokenImpl.standard],
        ['Tax token implementation', CHAIN_CONFIG[196].tokenImpl.tax],
        ['Explorer', CHAIN_CONFIG[196].explorer],
      ];

  const nextActions = isZh
    ? [
        '用最终要展示的 Fan ID 跑一遍干净的预测榜同步。',
        '生成 Prediction Agent Copilot Pack，并在审计前保存 Arena。',
        '内部批准后创建一个真实 X Layer proof 或市场资产，并保存 OKLink 证明。',
        '用 OKX 凭证和真实目标资产测试 Trading Proof 面板。',
        '整理提交 README，并录制一段短产品视频。',
      ]
    : [
        'Run a clean board sync with the final Fan ID that will be shown in the product walkthrough.',
        'Generate a Prediction Agent Copilot Pack and save the arena before the review.',
        'Create one real X Layer proof or market asset after internal approval and save the OKLink proof.',
        'Test the Trading Proof panel with OKX credentials and a real target asset.',
        'Write the submission README section and record a short product video.',
      ];

  return (
    <div className="relative left-1/2 min-h-screen w-screen -translate-x-1/2 bg-synth-bg">
      <section className="border-b border-synth-border bg-synth-surface/20">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
                {isZh ? '提交准备看板' : 'Submission Readiness'}
              </div>
              <h1 className="mt-3 text-3xl font-bold text-synth-text md:text-5xl">
                {isZh ? 'SportFi Prediction Arena 最终版检查' : 'SportFi Prediction Arena Final Checklist'}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-synth-muted md:text-base">
                {isZh
                  ? 'Synth SportFi Prediction Arena 面向 X Cup 提交、产品演示、X/Twitter 发文和内部确认的最终版准备看板。'
                  : 'A final readiness board for Synth SportFi Prediction Arena across X Cup submission, product walkthrough, X/Twitter launch, and internal approval.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/fanfi/xcup" className="btn-secondary">
                {isZh ? '返回 Arena' : 'Back To Arena'}
              </Link>
              <span className="cursor-not-allowed rounded border border-synth-border bg-synth-surface px-4 py-2 font-mono text-sm text-synth-muted opacity-70">
                {isZh ? 'Proof Sync Ready' : 'Proof Sync Ready'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-synth-border">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-4 py-8 md:grid-cols-4">
          {readiness.map((item) => (
            <article key={item.label} className="card min-h-[150px]">
              <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">
                {item.label}
              </div>
              <div className="mt-4 text-3xl font-bold text-synth-green">{item.value}</div>
              <p className="mt-3 text-xs leading-5 text-synth-muted">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-b border-synth-border">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-synth-cyan">
                {isZh ? '证据矩阵' : 'Evidence Matrix'}
              </div>
              <h2 className="mt-3 text-2xl font-bold text-synth-text">
                {isZh ? '哪些已就绪或待接入' : 'What Is Ready Or Still Missing'}
              </h2>
            </div>
            <div className="text-xs text-synth-muted">
              {isZh ? '产品闭环、证明层、排行榜与 OKX 承接集中检查。' : 'Product loop, proof layer, leaderboard, and OKX handoff in one review.'}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-synth-border">
            <div className="hidden grid-cols-[0.8fr_0.34fr_1.2fr_1fr] gap-0 border-b border-synth-border bg-synth-surface px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-synth-muted md:grid">
              <div>{isZh ? '模块' : 'Area'}</div>
              <div>{isZh ? '状态' : 'Status'}</div>
              <div>{isZh ? '证据' : 'Evidence'}</div>
              <div>{isZh ? '下一步' : 'Next Step'}</div>
            </div>
            <div className="divide-y divide-synth-border">
              {auditItems.map((item) => (
                <article
                  key={item.label}
                  className="grid grid-cols-1 gap-3 bg-synth-bg px-4 py-4 md:grid-cols-[0.8fr_0.34fr_1.2fr_1fr] md:items-start"
                >
                  <div className="text-sm font-bold text-synth-text">{item.label}</div>
                  <div>
                    <StatusBadge status={item.status} isZh={isZh} />
                  </div>
                  <p className="text-sm leading-6 text-synth-muted">{item.evidence}</p>
                  <p className="text-sm leading-6 text-synth-text">{item.next}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {isZh ? '必需证明' : 'Required Proof'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? 'X Layer 提交信息面板' : 'X Layer Submission Surface'}
            </h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-synth-border">
            {proofRows.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[0.45fr_1fr] gap-4 border-b border-synth-border px-4 py-3 last:border-b-0"
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-synth-muted">
                  {label}
                </div>
                <div className="break-all text-sm text-synth-text">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-cyan">
              {isZh ? '下一步动作' : 'Next Actions'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? '建议建设顺序' : 'Recommended Build Order'}
            </h2>
          </div>
          <div className="space-y-3">
            {nextActions.map((action, index) => (
              <article key={action} className="flex gap-4 rounded-lg border border-synth-border bg-synth-surface p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-synth-green/30 bg-synth-green/10 text-xs font-bold text-synth-green">
                  {index + 1}
                </div>
                <p className="text-sm leading-6 text-synth-muted">{action}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
