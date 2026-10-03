// src/lib/engine/bans/metaThreatEvaluator.ts
import { normalizeRole } from '../core/constants.js';
import type { EnrichedChampion } from '../core/types.js';
import type { ThreatEvaluationResult } from './types.js';
import { isChampionInLane } from './laneThreatEvaluator.js';
import { getTopPickRank } from '../../meta/probuildstatsTopPicks.js';

/**
 * Bloque Meta Global (20% del Threat Score total).
 * Usa exclusivamente la posición del campeón en el top 20 de Probuildstats.
 */
export function evaluateMetaThreat(
  candidate: EnrichedChampion,
  targetLane: string
): ThreatEvaluationResult {
  const reasons: string[] = [];
  let score = 0.0;

  const normalizedTargetLane = normalizeRole(targetLane, 'MIDDLE');

  // Filtro estricto: Si no pertenece al carril, no evaluar meta en esa línea
  if (!isChampionInLane(candidate, normalizedTargetLane)) {
    return { score: 0.0, reasons: [] };
  }

  const rank = getTopPickRank(candidate.id, normalizedTargetLane);
  if (rank !== null) {
    score = 2.5 - ((rank - 1) / 19) * 1.5;
    reasons.push(`Top Probuildstats ${normalizedTargetLane} #${rank}`);
  }

  return {
    score: Math.max(0, score),
    reasons
  };
}
