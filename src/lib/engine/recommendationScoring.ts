import { sampleConfidence, smoothedWinrate } from './statisticalScoring.js';

export interface RecommendationEvidence {
  pickrate?: number;
  winrate?: number;
  games?: number;
}

export interface ScoreBreakdown {
  score: number;
  confidence: number;
  evidence: number;
  components: Record<string, number>;
}

export interface PickScoreContext {
  matchupFit?: number;
  compositionFit?: number;
  synergyFit?: number;
  scalingFit?: number;
  masteryFit?: number;
  phase?: 'pick1' | 'pick3' | 'pick5';
}

export interface BuildScoreContext {
  matchupFit?: number;
  compositionFit?: number;
  coherence?: number;
  scalingFit?: number;
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

function asPercent(value: unknown, fallback = 50): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
}

function pickrateScore(value: unknown, reference = 10): number {
  const pickrate = Math.max(0, asPercent(value, 0));
  return clamp((1 - Math.exp(-pickrate / reference)) * 100);
}

function confidenceScore(games: unknown, pickrate: unknown): number {
  if (games !== undefined && games !== null) {
    return clamp(sampleConfidence(Number(games)) * 100);
  }
  // Si la fuente no entrega partidas, reducimos la confianza sin descartar
  // automáticamente la opción: algunas vistas agregadas sólo exponen PR/WR.
  return clamp(Math.max(25, Math.min(65, asPercent(pickrate, 0) * 4)));
}

/**
 * Score estadístico común para cualquier entidad de recomendación.
 * Devuelve 0..100 y evita que un WR extremo con pocas partidas domine.
 */
export function scoreEvidence100(evidence: RecommendationEvidence): ScoreBreakdown {
  const pickrate = Math.max(0, asPercent(evidence.pickrate, 0));
  const smoothed = smoothedWinrate({
    winrate: evidence.winrate,
    games: evidence.games
  });
  const wrComponent = clamp(50 + (smoothed - 50) * 4);
  const prComponent = pickrateScore(pickrate);
  const confidence = confidenceScore(evidence.games, pickrate);
  const evidenceScore = (wrComponent * 0.45) + (prComponent * 0.30) + (confidence * 0.25);

  return {
    score: Number(evidenceScore.toFixed(3)),
    confidence: Number((confidence / 100).toFixed(3)),
    evidence: Number(evidenceScore.toFixed(3)),
    components: {
      winrate: Number(wrComponent.toFixed(3)),
      pickrate: Number(prComponent.toFixed(3)),
      confidence: Number(confidence.toFixed(3))
    }
  };
}

function normalizedDelta(value: unknown, multiplier = 5): number {
  const delta = Number(value || 0);
  return clamp(50 + delta * multiplier);
}

/** Score para elegir campeón dentro del draft. */
export function scorePickRecommendation(
  evidence: RecommendationEvidence,
  context: PickScoreContext = {}
): ScoreBreakdown {
  const base = scoreEvidence100(evidence);
  const phase = context.phase || 'pick3';
  const components = {
    meta: base.score,
    matchup: clamp(context.matchupFit ?? 50),
    composition: clamp(context.compositionFit ?? 50),
    synergy: clamp(context.synergyFit ?? 50),
    scaling: clamp(context.scalingFit ?? 50),
    mastery: clamp(context.masteryFit ?? 50)
  };

  const weights = phase === 'pick1'
    ? { meta: 0.35, matchup: 0.15, composition: 0.15, synergy: 0.10, scaling: 0.15, mastery: 0.10 }
    : phase === 'pick5'
      ? { meta: 0.20, matchup: 0.30, composition: 0.20, synergy: 0.15, scaling: 0.10, mastery: 0.05 }
      : { meta: 0.25, matchup: 0.25, composition: 0.20, synergy: 0.15, scaling: 0.10, mastery: 0.05 };

  const score = Object.entries(weights)
    .reduce((total, [key, weight]) => total + components[key as keyof typeof components] * weight, 0);

  return {
    score: Number(clamp(score).toFixed(3)),
    confidence: base.confidence,
    evidence: base.evidence,
    components
  };
}

/** Score contextual para un arquetipo/core de build. */
export function scoreBuildVariant(
  evidence: RecommendationEvidence,
  context: BuildScoreContext = {}
): ScoreBreakdown {
  const base = scoreEvidence100(evidence);
  const components = {
    evidence: base.score,
    matchup: clamp(context.matchupFit ?? 50),
    composition: clamp(context.compositionFit ?? 50),
    coherence: clamp(context.coherence ?? 100),
    scaling: clamp(context.scalingFit ?? 50)
  };
  const score = (components.evidence * 0.40)
    + (components.matchup * 0.25)
    + (components.composition * 0.20)
    + (components.coherence * 0.10)
    + (components.scaling * 0.05);

  return {
    score: Number(clamp(score).toFixed(3)),
    confidence: base.confidence,
    evidence: base.evidence,
    components
  };
}

/** Score contextual para objetos fuera del core, como slots 4/5/6. */
export function scoreItemOption(
  evidence: RecommendationEvidence,
  context: Pick<BuildScoreContext, 'matchupFit' | 'compositionFit' | 'coherence'> = {}
): ScoreBreakdown {
  const base = scoreEvidence100(evidence);
  const components = {
    evidence: base.score,
    matchup: clamp(context.matchupFit ?? 50),
    composition: clamp(context.compositionFit ?? 50),
    coherence: clamp(context.coherence ?? 100)
  };
  const score = (components.evidence * 0.45)
    + (components.matchup * 0.30)
    + (components.composition * 0.15)
    + (components.coherence * 0.10);

  return {
    score: Number(clamp(score).toFixed(3)),
    confidence: base.confidence,
    evidence: base.evidence,
    components
  };
}

/** Las páginas completas tienen prioridad sobre la suma de runas marginales. */
export function scoreRunePage(page: RecommendationEvidence): ScoreBreakdown {
  const base = scoreEvidence100(page);
  return {
    ...base,
    score: Number((base.score * 1.05).toFixed(3))
  };
}

export function deltaToFit(delta: unknown, positiveIsGood = true): number {
  const normalized = Number(delta || 0) * (positiveIsGood ? 1 : -1);
  return normalizedDelta(normalized);
}

