/**
 * Unit tests for the Settlement Engine.
 *
 * Pins the behaviour of the heuristics so future changes (eg. plugging in
 * an LLM reason-quality grader, switching to a closed direction vocabulary)
 * are documented diffs, not silent regressions.
 *
 * Run: `npx tsc --noEmit` for type-check; assertions throw at run time so a
 * simple `npx ts-node src/lib/__tests__/fanfiSettle.test.ts` (or any node-
 * runner harness) executes them.
 */
import { SETTLEMENT_SCORING_RULES, scoreReceipt, __testing } from '../fanfiSettle';

type Case<T> = { name: string; got: T; expected: T };
const failures: string[] = [];

function check<T>(name: string, got: T, expected: T) {
  const equal =
    typeof got === 'object' && got !== null
      ? JSON.stringify(got) === JSON.stringify(expected)
      : got === expected;
  if (!equal) failures.push(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
}

// ---------------- directionMatches ----------------
const { directionMatches } = __testing;

// Positive cases.
check('exact match', directionMatches('Brazil wins', 'Brazil wins'), true);
check('predicted is subset of outcome', directionMatches('Brazil wins', 'Brazil wins 2-1'), true);
check('outcome is subset of predicted (>= half shared)', directionMatches('Brazil wins 2-1', 'Brazil wins'), true);
check('scoreline mismatch but direction shared', directionMatches('Brazil wins 0-1', 'Brazil wins 2-1'), true);

// Negative cases (would have falsely matched under the prior rule).
check('single-word predicted "wins"', directionMatches('wins', 'Brazil wins'), false);
check('single-word predicted "Brazil"', directionMatches('Brazil', 'Brazil knocked out'), false);
check('opposite direction', directionMatches('Brazil loses', 'Brazil wins'), false);
check('different brackets', directionMatches('Brazil semifinal', 'Brazil quarter'), false);

// Edge cases.
check('empty predicted', directionMatches('', 'Brazil wins'), false);
check('empty outcome', directionMatches('Brazil wins', ''), false);
check('whitespace only', directionMatches('   ', 'Brazil wins'), false);

// ---------------- scoreReceipt ----------------
const baseOutcome = { outcome: 'Brazil wins 2-1' };
const now = new Date().toISOString();

// Correct direction + perfect confidence + early + good reason.
let breakdown = scoreReceipt(
  {
    predictionDirection: 'Brazil wins',
    predictionProbability: 100,
    predictionReason: 'a'.repeat(120),
    createdAt: now,
  },
  baseOutcome,
);
check('full correct: direction', breakdown.directionPoints, 80);
check('full correct: probability (100)', breakdown.probabilityPoints, 60);
check('full correct: early', breakdown.earlyReceiptPoints, 20);
check('full correct: reason 100+ chars', breakdown.reasonQualityPoints, 40);
check('full correct: total', breakdown.total, 200);
check('total matches max', SETTLEMENT_SCORING_RULES.TOTAL_MAX, 200);

// Wrong direction earns nothing (and zeroes probability).
breakdown = scoreReceipt(
  {
    predictionDirection: 'Brazil loses',
    predictionProbability: 100,
    predictionReason: 'a'.repeat(120),
    createdAt: now,
  },
  baseOutcome,
);
check('wrong direction: direction', breakdown.directionPoints, 0);
check('wrong direction: probability zeroed', breakdown.probabilityPoints, 0);
check('wrong direction: still gets reason quality', breakdown.reasonQualityPoints, 40);

// 50% probability earns 0 from probability category.
breakdown = scoreReceipt(
  {
    predictionDirection: 'Brazil wins',
    predictionProbability: 50,
    predictionReason: 'short',
    createdAt: now,
  },
  baseOutcome,
);
check('50% probability', breakdown.probabilityPoints, 0);
check('reason length 5 chars', breakdown.reasonQualityPoints, 0);

// Reason quality thresholds.
check(
  'reason 49 chars',
  scoreReceipt({ predictionDirection: 'x', predictionProbability: null, predictionReason: 'a'.repeat(49), createdAt: now }, baseOutcome).reasonQualityPoints,
  10,
);
check(
  'reason 50 chars',
  scoreReceipt({ predictionDirection: 'x', predictionProbability: null, predictionReason: 'a'.repeat(50), createdAt: now }, baseOutcome).reasonQualityPoints,
  25,
);
check(
  'reason 99 chars',
  scoreReceipt({ predictionDirection: 'x', predictionProbability: null, predictionReason: 'a'.repeat(99), createdAt: now }, baseOutcome).reasonQualityPoints,
  25,
);
check(
  'reason 100 chars',
  scoreReceipt({ predictionDirection: 'x', predictionProbability: null, predictionReason: 'a'.repeat(100), createdAt: now }, baseOutcome).reasonQualityPoints,
  40,
);

// Cutoff-based early bonus.
const past = new Date(Date.now() - 60_000).toISOString();
const future = new Date(Date.now() + 60_000).toISOString();
const cutoffNow = { outcome: 'Brazil wins', cutoffTimestamp: new Date().toISOString() };
check(
  'submitted before cutoff: full 20',
  scoreReceipt({ predictionDirection: 'a a', predictionProbability: null, predictionReason: null, createdAt: past }, cutoffNow).earlyReceiptPoints,
  20,
);
check(
  'submitted after cutoff: 0',
  scoreReceipt({ predictionDirection: 'a a', predictionProbability: null, predictionReason: null, createdAt: future }, cutoffNow).earlyReceiptPoints,
  0,
);

// ---------------- summary ----------------
if (failures.length > 0) {
  console.error('\n' + failures.join('\n'));
  console.error(`\n${failures.length} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('All fanfiSettle tests passed.');
}
