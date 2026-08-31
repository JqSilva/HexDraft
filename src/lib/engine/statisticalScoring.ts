export interface StatisticalEvidence {
  pickrate?: number;
  winrate?: number;
  games?: number;
}

const DEFAULT_PRIOR_GAMES = 250;

function asPercent(value: number | undefined, fallback = 50): number {
  if (!Number.isFinite(value)) return fallback;
  const numeric = Number(value);
  return numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
}

/**
 * Shrinks very small samples toward the global 50% prior. This prevents a
 * 1-game/100% variant from outranking a well-established build.
 */
export function smoothedWinrate(
  evidence: StatisticalEvidence,
  priorGames = DEFAULT_PRIOR_GAMES
): number {
  const games = Math.max(0, Number(evidence.games || 0));
  const winrate = asPercent(evidence.winrate);
  if (games <= 0) return winrate;
  return ((winrate * games) + (50 * priorGames)) / (games + priorGames);
}

/** Confidence rises with sample size but never becomes an unbounded bonus. */
export function sampleConfidence(games?: number, targetGames = 1000): number {
  const n = Math.max(0, Number(games || 0));
  if (n <= 0) return 0;
  return Math.min(1, Math.sqrt(n / targetGames));
}

/**
 * Meta evidence score. Pickrate is still important, but winrate is smoothed
 * and confidence is used to penalize sparse variants.
 */
export function evidenceScore(evidence: StatisticalEvidence): number {
  const pickrate = Math.max(0, Number(evidence.pickrate || 0));
  const wr = smoothedWinrate(evidence);
  const confidence = sampleConfidence(evidence.games);
  const sparsePenalty = evidence.games === undefined ? 0 : (1 - confidence) * 1.5;
  return (pickrate * 0.70) + ((wr - 50) * 0.45) + (confidence * 0.35) - sparsePenalty;
}

export function isReliableVariant(
  evidence: StatisticalEvidence,
  minimumGames = 100
): boolean {
  if (evidence.games === undefined) return Number(evidence.pickrate || 0) >= 1;
  return Number(evidence.games || 0) >= minimumGames;
}
