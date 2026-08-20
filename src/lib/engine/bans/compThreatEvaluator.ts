// src/lib/engine/bans/compThreatEvaluator.ts
import { ENRICHED_DB } from '../core/dataProvider.js';
import { normalizeKey } from '../core/constants.js';
import type { EnrichedChampion } from '../core/types.js';
import type { ThreatEvaluationResult } from './types.js';

/**
 * Bloque Composición y Disrupción Táctica (15% del Threat Score total).
 * Evalúa el peligro que representa el campeón para la estructura del equipo.
 */
export function evaluateCompThreat(
  candidate: EnrichedChampion,
  alliedPicks: string[] = [],
  myChampion: string | null = null
): ThreatEvaluationResult {
  const reasons: string[] = [];
  let score = 0.0;

  const candidateName = candidate.name;
  const isLate = candidate.scalingType === 'Late' || candidate.scaling_type === 'Late';
  const isHypercarry = candidate.isHypercarry || candidate.is_hypercarry === 1;

  // 1. Hypercarry de Escalado Incontrolable
  if (isHypercarry && isLate) {
    score += 1.0;
    reasons.push("Win Condition Tardía: Hypercarry con escalado incontrolable a late game");
  }

  // 2. Disrupción Táctica contra Necesidades Aliadas
  const alliesNeedingPeelOrFrontline = alliedPicks.filter(allyName => {
    const ally = ENRICHED_DB[allyName];
    if (!ally) return false;
    const needs = ally.teamNeeds || [];
    return needs.includes('peel') || needs.includes('frontline') || ally.class === 'Marksman' || ally.class === 'Mage';
  });

  const candidateRole = candidate.tacticRole || candidate.tactic_role || 'teamfight';
  const isAssassinOrDive = candidateRole === 'dive' || candidateRole === 'burst' || candidate.class === 'Assassin' || candidate.tags?.includes('Assassin');

  if (alliesNeedingPeelOrFrontline.length >= 2 && isAssassinOrDive) {
    score += 0.8;
    reasons.push("Disrupción Táctica: Explota la vulnerabilidad de la retaguardia aliada");
  }

  // 3. Apoyo a Líneas Aliadas (Counters críticos de otros aliados revelados)
  const otherAllies = alliedPicks.filter(a => !myChampion || normalizeKey(a) !== normalizeKey(myChampion));
  let alliedCounterCount = 0;
  const threatenedAllies: string[] = [];

  otherAllies.forEach(allyName => {
    const allyData = ENRICHED_DB[allyName];
    const isCounter = allyData?.counters?.some(c => normalizeKey(c.name) === normalizeKey(candidateName));
    if (isCounter) {
      alliedCounterCount++;
      threatenedAllies.push(allyName);
    }
  });

  if (alliedCounterCount > 0) {
    const allyBonus = Math.min(alliedCounterCount * 0.7, 1.5);
    score += allyBonus;
    reasons.push(`Apoyo a Aliados: Amenaza crítica directa contra ${threatenedAllies.join(', ')} (+${allyBonus.toFixed(1)})`);
  }

  return {
    score: Math.max(0, score),
    reasons
  };
}
