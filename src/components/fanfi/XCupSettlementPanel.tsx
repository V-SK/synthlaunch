'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

type SettlementStatus = 'open' | 'locked' | 'resolved';

type FanFiMarketProofRecord = {
  id: string;
  fanId: string;
  templateId: string;
  name: string;
  symbol: string;
  predictionDirection: string | null;
  predictionProbability: number | null;
  settlementStatus: SettlementStatus;
  resolvedOutcome: string | null;
  reputationPoints: number;
  createdAt: string;
};

const REFRESH_EVENT = 'fanfi-market-proof-created';

export function XCupSettlementPanel() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const [proofs, setProofs] = useState<FanFiMarketProofRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/fanfi/market-proofs', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(
            isZh ? '加载 Settlement 数据失败' : 'Failed to load settlement data',
          );
        }
        const data = await res.json();
        if (!cancelled) {
          setProofs(Array.isArray(data.launches) ? data.launches : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isZh
                ? '加载 Settlement 数据失败'
                : 'Failed to load settlement data',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    const handle = () => void load();
    window.addEventListener(REFRESH_EVENT, handle);
    return () => {
      cancelled = true;
      window.removeEventListener(REFRESH_EVENT, handle);
    };
  }, [isZh]);

  const stats = useMemo(() => {
    const totals = {
      total: proofs.length,
      open: 0,
      locked: 0,
      resolved: 0,
      totalReputation: 0,
    };
    for (const proof of proofs) {
      if (proof.settlementStatus === 'open') totals.open += 1;
      else if (proof.settlementStatus === 'locked') totals.locked += 1;
      else if (proof.settlementStatus === 'resolved') totals.resolved += 1;
      totals.totalReputation += proof.reputationPoints || 0;
    }
    return totals;
  }, [proofs]);

  const latestResolved = useMemo(() => {
    return proofs.find((proof) => proof.settlementStatus === 'resolved') || null;
  }, [proofs]);

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

  const scoringRows = isZh
    ? [
        ['方向正确', '+80 REP', '胜负、晋级、比分区间或球员数据方向命中。'],
        ['概率接近', '+0-60 REP', '预测概率越自信且方向正确，得分越高（线性 50→0、100→60）。'],
        ['早期提交', '+20 REP', '在 settlement_cutoff 之前提交即可获得（v1：所有 cutoff 前提交均奖励）。'],
        ['理由质量', '+0-40 REP', 'v1 启发式：100+ 字符 +40、50+ 字符 +25、10+ 字符 +10。下个阶段接 LLM 评分。'],
      ]
    : [
        ['Correct Direction', '+80 REP', 'Winner, qualification, score band, or player prop direction is correct.'],
        ['Probability Distance', '+0-60 REP', 'Higher confidence on correct direction scores more (linear 50→0, 100→60).'],
        ['Early Receipt', '+20 REP', 'Awarded for any receipt submitted before settlement_cutoff (v1).'],
        ['Reason Quality', '+0-40 REP', 'v1 heuristic: 100+ chars +40, 50+ +25, 10+ +10. LLM grading is next-phase work.'],
      ];

  const proofFields = isZh
    ? [
        ['wallet', '签名钱包地址'],
        ['fanId', 'Fan ID（用户标识）'],
        ['templateId', 'Arena 模板 ID'],
        ['targetMatch', '目标比赛'],
        ['predictionDirection', '预测方向（自由文本）'],
        ['predictionProbability', '预测概率（0-100）'],
        ['predictionReason', '理由摘要'],
        ['receiptHash', 'EIP-191 receipt hash'],
        ['settlementRule', '结算规则'],
        ['settlementSource', '结算数据源'],
        ['txHash', 'X Layer tx（可选，RPC 校验）'],
      ]
    : [
        ['wallet', 'Signing wallet address'],
        ['fanId', 'Fan ID (user identifier)'],
        ['templateId', 'Arena template ID'],
        ['targetMatch', 'Target match'],
        ['predictionDirection', 'Prediction direction (free text)'],
        ['predictionProbability', 'Prediction probability (0-100)'],
        ['predictionReason', 'Reasoning summary'],
        ['receiptHash', 'EIP-191 receipt hash'],
        ['settlementRule', 'Settlement rule'],
        ['settlementSource', 'Settlement data source'],
        ['txHash', 'X Layer tx (optional, RPC-verified)'],
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
              {isZh
                ? '预测 Arena 的创建、锁盘、结算和排行规则'
                : 'Create, Lock, Resolve, And Rank Each Prediction Arena'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-synth-muted">
              {isZh
                ? '每个 Arena 在创建时写入预测题、结算源、锁盘时间和得分规则；用户提交的 receipt 会变成 proof，比赛结束后由 admin settle endpoint 写回 reputation。'
                : 'Every arena writes the question, settlement source, lock time, and scoring rule at creation. User receipts become proof; after the match the admin settle endpoint writes reputation back to each receipt.'}
            </p>
          </div>
          <div className="rounded border border-synth-cyan/30 bg-synth-cyan/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-synth-cyan">
            X Layer · Chain 196 · OKB
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">
              {isZh ? '总 Receipt' : 'Total Receipts'}
            </div>
            <div className="mt-3 text-2xl font-bold text-synth-text">
              {loading ? '...' : stats.total}
            </div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">Open</div>
            <div className="mt-3 text-2xl font-bold text-synth-green">
              {loading ? '...' : stats.open}
            </div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">Locked</div>
            <div className="mt-3 text-2xl font-bold text-yellow-300">
              {loading ? '...' : stats.locked}
            </div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">Resolved</div>
            <div className="mt-3 text-2xl font-bold text-synth-cyan">
              {loading ? '...' : stats.resolved}
            </div>
          </div>
          <div className="card">
            <div className="text-[10px] uppercase tracking-[0.2em] text-synth-muted">
              {isZh ? '已发放 REP' : 'REP Issued'}
            </div>
            <div className="mt-3 text-2xl font-bold text-synth-green">
              {loading ? '...' : stats.totalReputation}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

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
            <div className="border-b border-synth-border bg-synth-surface/30 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-synth-green">
                {isZh ? '最新 Resolved Arena' : 'Latest Resolved Arena'}
              </div>
            </div>
            {latestResolved ? (
              <div className="space-y-2 p-4 text-sm">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {isZh ? 'Arena' : 'Arena'}
                  </span>
                  <div className="mt-1 text-synth-text">
                    {latestResolved.name} (${latestResolved.symbol})
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {isZh ? '预测方向' : 'Predicted'}
                  </span>
                  <div className="mt-1 text-synth-text">
                    {latestResolved.predictionDirection || '—'}
                    {latestResolved.predictionProbability != null
                      ? ` · ${latestResolved.predictionProbability}%`
                      : ''}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {isZh ? '结算结果' : 'Outcome'}
                  </span>
                  <div className="mt-1 text-synth-text">{latestResolved.resolvedOutcome || '—'}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-synth-muted">
                    {isZh ? '获得 REP' : 'REP earned'}
                  </span>
                  <div className="mt-1 font-mono text-synth-green">{latestResolved.reputationPoints}</div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm leading-6 text-synth-muted">
                {isZh
                  ? '还没有 resolved Arena。在比赛结束后，admin 调用 /api/admin/fanfi-settle 即可把 reputation 写回所有 open receipts。'
                  : 'No resolved arenas yet. After a match concludes, admin calls /api/admin/fanfi-settle to write reputation back to all open receipts.'}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-synth-border bg-synth-surface p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-synth-cyan">
                {isZh ? 'Receipt Schema' : 'Receipt Schema'}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {proofFields.map(([field, label]) => (
                  <div
                    key={field}
                    className="flex items-center justify-between gap-3 border-b border-synth-border pb-2 last:border-b-0 last:pb-0"
                  >
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
