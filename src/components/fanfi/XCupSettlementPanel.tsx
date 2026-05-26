'use client';

import { useI18n } from '@/lib/i18n';

export function XCupSettlementPanel() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  const settlementFlow = isZh
    ? [
        ['Open', 'AI 创建 Arena 后开放预测 receipt，用户提交方向、概率和理由。'],
        ['Lock', '开赛前锁定提交窗口，所有 receipt 进入 X Layer proof 队列。'],
        ['Resolve', '比赛结束后按创建时写入的官方数据源结算。'],
        ['Score', '正确方向、概率接近度、早期提交和理由质量一起进入 reputation。'],
        ['Route', '高热度 Arena 的资产进入 OKX Agent watchlist、quote 和 swap handoff。'],
      ]
    : [
        ['Open', 'After AI creates the arena, users submit direction, probability, and reasoning receipts.'],
        ['Lock', 'The prediction window locks before kickoff and receipts enter the X Layer proof queue.'],
        ['Resolve', 'After the match, the arena resolves against the official source written at creation time.'],
        ['Score', 'Correct direction, probability distance, early receipt, and reasoning quality feed reputation.'],
        ['Route', 'High-heat arenas move into OKX Agent watchlists, quotes, and swap handoff.'],
      ];

  const featuredArena = isZh
    ? [
        ['Arena', 'Brazil vs France · Match Result'],
        ['预测题', '巴西能否在 90 分钟内击败法国？'],
        ['结算源', 'FIFA Official Match Centre 最终比分 + 赛后 match report'],
        ['锁定时间', 'Kickoff 前 30 分钟 · UTC 时间戳写入 receipt'],
        ['胜出规则', '方向正确得基础分；概率越接近最终共识，reputation 越高。'],
        ['链上证明', '真实 X Layer txHash 接入后显示 OKLink；receipt hash 单独展示'],
      ]
    : [
        ['Arena', 'Brazil vs France · Match Result'],
        ['Question', 'Can Brazil beat France within 90 minutes?'],
        ['Settlement Source', 'FIFA Official Match Centre final score plus post-match report'],
        ['Lock Time', '30 minutes before kickoff · UTC timestamp written into receipt'],
        ['Winning Rule', 'Correct direction earns base score; closer probability earns higher reputation.'],
        ['Onchain Proof', 'OKLink appears after a real X Layer tx hash is attached; receipt hash is displayed separately'],
      ];

  const scoringRows = isZh
    ? [
        ['方向正确', '+80 REP', '胜负、晋级、比分区间或球员数据方向命中。'],
        ['概率接近', '+0-60 REP', '预测概率越接近结算后共识权重，得分越高。'],
        ['早期提交', '+20 REP', '锁盘前越早提交且未反复修改，权重越好。'],
        ['理由质量', '+0-40 REP', 'AI Agent 标注逻辑、数据引用和赛前假设。'],
      ]
    : [
        ['Correct Direction', '+80 REP', 'Winner, qualification, score band, or player prop direction is correct.'],
        ['Probability Distance', '+0-60 REP', 'Closer probability to the resolved consensus earns higher score.'],
        ['Early Receipt', '+20 REP', 'Earlier locked receipt with fewer edits gets stronger weighting.'],
        ['Reason Quality', '+0-40 REP', 'AI Agent grades logic, data reference, and pre-match assumptions.'],
      ];

  const proofFields = isZh
    ? [
        ['wallet', '提交钱包'],
        ['arenaId', 'Arena / 比赛 ID'],
        ['direction', '预测方向'],
        ['probability', '概率'],
        ['reason', '理由摘要'],
        ['settlementRule', '结算规则'],
        ['receiptHash', '钱包签名 receipt hash'],
        ['txHash', '真实 X Layer 交易哈希'],
      ]
    : [
        ['wallet', 'Submitting wallet'],
        ['arenaId', 'Arena / match ID'],
        ['direction', 'Prediction direction'],
        ['probability', 'Probability'],
        ['reason', 'Reasoning summary'],
        ['settlementRule', 'Settlement rule'],
        ['receiptHash', 'Wallet-signed receipt hash'],
        ['txHash', 'Real X Layer transaction hash'],
      ];

  return (
    <section id="fanfi-settlement-engine" className="border-b border-synth-border">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-synth-green">
              {isZh ? 'Settlement Engine' : 'Settlement Engine'}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-synth-text">
              {isZh ? '预测 Arena 的创建、锁盘、结算和排行规则' : 'Create, Lock, Resolve, And Rank Each Prediction Arena'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-synth-muted">
              {isZh
                ? '每个 Arena 在创建时写入预测题、结算源、锁盘时间和得分规则；用户提交的 receipt 会变成 proof，比赛结束后进入 reputation 和排行榜。'
                : 'Every arena writes the question, settlement source, lock time, and scoring rule at creation. User receipts become proof, then resolve into reputation and leaderboard state after the match.'}
            </p>
          </div>
          <div className="rounded border border-synth-cyan/30 bg-synth-cyan/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-synth-cyan">
            X Layer · Chain 196 · OKB
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {settlementFlow.map(([label, body], index) => (
            <article key={label} className="card min-h-[154px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.2em] text-synth-cyan">{label}</span>
                <span className="text-xs text-synth-muted">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-synth-muted">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="overflow-hidden rounded-lg border border-synth-green/25 bg-synth-green/5">
            {featuredArena.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-1 gap-2 border-b border-synth-border px-4 py-3 last:border-b-0 md:grid-cols-[0.35fr_1fr]"
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-synth-green">{label}</div>
                <div className="break-all text-sm leading-6 text-synth-text">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-synth-border bg-synth-surface p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-synth-cyan">
                {isZh ? 'Receipt Schema' : 'Receipt Schema'}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {proofFields.map(([field, label]) => (
                  <div key={field} className="flex items-center justify-between gap-3 border-b border-synth-border pb-2 last:border-b-0 last:pb-0">
                    <span className="font-mono text-[10px] text-synth-muted">{field}</span>
                    <span className="text-right text-xs text-synth-text">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-synth-border bg-synth-surface p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-synth-cyan">
                {isZh ? 'Reputation Scoring' : 'Reputation Scoring'}
              </div>
              <div className="mt-4 space-y-3">
                {scoringRows.map(([label, score, body]) => (
                  <div key={label} className="border-b border-synth-border pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-synth-text">{label}</span>
                      <span className="font-mono text-xs text-synth-green">{score}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-synth-muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
