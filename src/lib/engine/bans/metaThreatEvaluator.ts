// src/lib/engine/bans/metaThreatEvaluator.ts
import { normalizeRole } from '../core/constants.js';
import type { EnrichedChampion } from '../core/types.js';
import type { ThreatEvaluationResult } from './types.js';
import { isChampionInLane } from './laneThreatEvaluator.js';

/**
 * Bloque Meta Global (20% del Threat Score total).
 * Evalúa la fuerza estadística bruta en el meta del parche actual.
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

  const targetLaneStats = candidate.lanesStats?.[normalizedTargetLane];
  const tier = targetLaneStats?.tier ?? candidate.meta?.tier ?? 5;
  const winRate = targetLaneStats?.winRate ?? candidate.meta?.winRate ?? 50.0;

  // 1. Escala por Tier
  if (tier <= 1) {
    if (winRate >= 52.0) {
      score += 2.5;
      reasons.push(`Meta OP: Tier ${tier} dominante con ${winRate.toFixed(1)}% Win Rate`);
    } else {
      score += 1.8;
      reasons.push(`Meta Tier 1: Prioridad alta global en el parche actual`);
    }
  } else if (tier === 2) {
    score += 1.2;
    reasons.push(`Meta Sólido: Tier 2 con rendimiento consistente (${winRate.toFixed(1)}% WR)`);
  } else if (tier === 3) {
    score += 0.4;
  } else if (tier >= 4) {
    score -= 1.5; // Penaliza score sin emitir texto negativo
  }

  // 2. Desviación directa del Win Rate (50.0% como pivote neutro)
  const wrDelta = winRate - 50.0;
  if (wrDelta > 0) {
    score += wrDelta * 0.45;
  } else {
    score += wrDelta * 0.25;
  }

  return {
    score: Math.max(0, score),
    reasons
  };
}
