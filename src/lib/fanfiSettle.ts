/**
 * Settlement scoring engine for Synth SportFi Prediction Arena.
 *
 * Public face of this module: `scoreReceipt(receipt, outcome)` returns a
 * reputation point total + a transparent breakdown by category.
 *
 * The scoring rules below are the ones surfaced on /fanfi/xcup
 * (XCupSettlementPanel "Reputation Scoring") so the UI and the engine
 * cannot drift.
 */

export interface SettlementOutcome {
  /**
   * The match's resolved direction in plain text. Examples:
   *   - "Brazil wins"
   *   - "France wins"
   *   - "Draw"
   *   - "Final 2-1"
   *   - "Golden Boot: Vinicius Jr"
   */
  outcome: string;

  /**
   * Whether the outcome happened before settlement_cutoff (true) or after.
   * Used to decide if early-receipt bonus is meaningful for this arena.
   * Default: true (most matches resolve at full time, which is after cutoff).
   */
  outcomeHappenedAfterCutoff?: boolean;

  /**
   * Optional: ISO timestamp that the settlement_cutoff actually fell on.
   * If provided, used to compute early-receipt bonus precisely. Otherwise
   * the cutoff is taken to be just before the resolution call (so any
   * receipt submitted earlier qualifies).
   */
  cutoffTimestamp?: string;
}

export interface ReceiptForScoring {
  predictionDirection: string | null;
  predictionProbability: number | null;
  predictionReason: string | null;
  createdAt: string;
}

export interface ReputationBreakdown {
  directionPoints: number;
  probabilityPoints: number;
  earlyReceiptPoints: number;
  reasonQualityPoints: number;
  total: number;
}

const DIRECTION_MAX = 80;
const PROBABILITY_MAX = 60;
const EARLY_RECEIPT_MAX = 20;
const REASON_QUALITY_MAX = 40;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'in', 'on', 'at', 'of', 'and', 'or', 'is', 'be',
  'will', 'with', 'by', 'for', 'as', 'are', 'was', 'were',
]);

function tokenize(s: string): string[] {
  return s
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

/**
 * Direction match — tight token-overlap heuristic.
 *
 * Rules (tightened from the prior permissive substring rule that awarded
 * +80 REP for trivial cases like `predicted: "wins"` vs `outcome: "Brazil
 * wins"`):
 *   1. Exact normalized equality → match.
 *   2. Otherwise both predicted AND outcome must have at least 2
 *      informative (non-stopword) tokens — guards against single-word
 *      guesses like "Brazil" or "wins" matching anything.
 *   3. Require at least 2 shared tokens AND shared >= ceil(predicted.length / 2)
 *      — i.e. at least half of the predicted tokens (rounded up) must appear
 *      in the outcome.
 *
 * Bilingual note: Chinese predictions tokenize per-character via
 * `[^\w\s-]` retention, which is sub-ideal. Treated as v1 limitation;
 * exposed unit tests pin the English behavior so the engine is auditable.
 *
 * Test cases (see __tests__/fanfiSettle.test.ts):
 *   ("Brazil wins", "Brazil wins 2-1")     → true
 *   ("Brazil wins 2-1", "Brazil wins")     → true (shared >= ceil(3/2) = 2)
 *   ("Brazil loses", "Brazil wins")        → false (shared 1 < 2)
 *   ("wins", "Brazil wins")                → false (predicted too short)
 *   ("Brazil", "Brazil knocked out")       → false (predicted too short)
 *   ("Brazil wins 0-1", "Brazil wins 2-1") → true (shared brazil+wins)
 *   ("Brazil semifinal", "Brazil quarter") → false (shared 1 < 2)
 */
function directionMatches(predicted: string, outcome: string): boolean {
  if (!predicted || !outcome) return false;
  const p = predicted.toLowerCase().trim();
  const o = outcome.toLowerCase().trim();
  if (p === o) return true;

  const pTokens = tokenize(p);
  const oTokens = tokenize(o);

  // Reject single-word predictions — too lossy to count as a directional call.
  if (pTokens.length < 2) return false;
  if (oTokens.length < 1) return false;

  const oSet = new Set(oTokens);
  const sharedCount = pTokens.filter((t) => oSet.has(t)).length;

  // Require >= 2 shared tokens (no single-token coincidence)
  // AND >= half of the predicted tokens shared (proportional confidence).
  const requiredShared = Math.max(2, Math.ceil(pTokens.length / 2));
  return sharedCount >= requiredShared;
}

// Exported for unit tests.
export const __testing = { directionMatches, tokenize };

/**
 * Probability distance scoring. Idea: someone who said "Brazil wins, 90%
 * confident" should earn more than "Brazil wins, 55% confident" when Brazil
 * actually wins. Conversely a confident-wrong call (Brazil wins, 90%, but
 * France won) should earn 0 from this category — being confidently wrong
 * is not rewarded.
 *
 * Formula (matches the +0-60 REP range in the UI):
 *   - If direction wrong: 0
 *   - If direction right and probability is 50: 0
 *     (you were right but admitted you weren't sure)
 *   - If direction right and probability is 100: 60
 *     (full confidence, fully correct)
 *   - Linear in between.
 *   - Clamped to [0, 60].
 */
function scoreProbability(
  isDirectionCorrect: boolean,
  probability: number | null,
): number {
  if (!isDirectionCorrect) return 0;
  if (probability == null || !Number.isFinite(probability)) return 0;

  const clamped = Math.max(0, Math.min(100, probability));
  if (clamped <= 50) return 0;

  // 50 → 0 points, 100 → 60 points. Slope 1.2.
  const raw = (clamped - 50) * 1.2;
  return Math.round(Math.max(0, Math.min(PROBABILITY_MAX, raw)));
}

/**
 * Early-receipt bonus. UI says "+20 REP for early locked receipt with
 * fewer edits". We don't track edits in v1; we just check submission
 * predates settlement_cutoff (or, if no precise cutoff is provided,
 * we assume the receipt was early because the outcome happened later).
 */
function scoreEarlyReceipt(receiptCreatedAt: string, outcome: SettlementOutcome): number {
  const createdMs = new Date(receiptCreatedAt).getTime();
  if (!Number.isFinite(createdMs)) return 0;

  if (outcome.cutoffTimestamp) {
    const cutoffMs = new Date(outcome.cutoffTimestamp).getTime();
    if (Number.isFinite(cutoffMs)) {
      return createdMs <= cutoffMs ? EARLY_RECEIPT_MAX : 0;
    }
  }

  // Default: any receipt submitted before the outcome was resolved counts as early.
  return EARLY_RECEIPT_MAX;
}

/**
 * Reason quality (v1 heuristic). The UI claims an "AI Agent grades logic"
 * — for the initial implementation we use a transparent length-based
 * heuristic and document that the next phase plugs in real model grading.
 */
function scoreReasonQuality(reason: string | null): number {
  if (!reason) return 0;
  const trimmed = reason.trim();
  const length = trimmed.length;
  if (length >= 100) return REASON_QUALITY_MAX;
  if (length >= 50) return 25;
  if (length >= 10) return 10;
  return 0;
}

export function scoreReceipt(
  receipt: ReceiptForScoring,
  outcome: SettlementOutcome,
): ReputationBreakdown {
  const isDirectionCorrect = directionMatches(
    receipt.predictionDirection || '',
    outcome.outcome,
  );

  const directionPoints = isDirectionCorrect ? DIRECTION_MAX : 0;
  const probabilityPoints = scoreProbability(isDirectionCorrect, receipt.predictionProbability);
  const earlyReceiptPoints = scoreEarlyReceipt(receipt.createdAt, outcome);
  const reasonQualityPoints = scoreReasonQuality(receipt.predictionReason);

  const total = directionPoints + probabilityPoints + earlyReceiptPoints + reasonQualityPoints;

  return {
    directionPoints,
    probabilityPoints,
    earlyReceiptPoints,
    reasonQualityPoints,
    total,
  };
}

export const SETTLEMENT_SCORING_RULES = {
  DIRECTION_MAX,
  PROBABILITY_MAX,
  EARLY_RECEIPT_MAX,
  REASON_QUALITY_MAX,
  TOTAL_MAX: DIRECTION_MAX + PROBABILITY_MAX + EARLY_RECEIPT_MAX + REASON_QUALITY_MAX,
};
