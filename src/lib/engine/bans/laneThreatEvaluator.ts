// src/lib/engine/bans/laneThreatEvaluator.ts
import { ENRICHED_DB, DATA_BY_LANE } from '../core/dataProvider.js';
import { normalizeKey, normalizeRole, PERSONAL_STATS, getNameFromId } from '../core/constants.js';
import type { EnrichedChampion } from '../core/types.js';
import type { ThreatEvaluationResult } from './types.js';

/**
 * Extrae el pickrate real del carril desde lanesPickrate o lanes_pickrate.
 * Si no existe dato, devuelve 0.0 en lugar del fallback arbitrario.
 */
export function getLanePickrate(candidate: EnrichedChampion, targetLane: string): number {
  const normLane = normalizeRole(targetLane, 'MIDDLE');
  const rates = candidate.lanesPickrate || candidate.lanes_pickrate;
  if (rates && typeof rates === 'object') {
    for (const [key, val] of Object.entries(rates)) {
      if (normalizeRole(key, 'UNKNOWN' as any) === normLane) {
        const num = parseFloat(String(val).replace('%', ''));
        if (!isNaN(num)) return num;
      }
    }
  }
  return 0.0;
}

/**
 * Filtro estricto de posición: verifica si el campeón pertenece al carril asignado.
 */
export function isChampionInLane(candidate: EnrichedChampion, targetLane: string): boolean {
  const normTarget = normalizeRole(targetLane, 'MIDDLE');
  const primaryLane = normalizeRole(candidate.lane, 'UNKNOWN' as any);
  if (primaryLane === normTarget) return true;
  
  const playLanes: string[] = candidate.playLanes || candidate.play_lanes || [];
  const hasSecondaryLane = Array.isArray(playLanes) && playLanes.some(l => normalizeRole(l, 'UNKNOWN' as any) === normTarget);
  
  if (hasSecondaryLane) {
    const lanePr = getLanePickrate(candidate, normTarget);
    return lanePr >= 2.0;
  }
  
  return false;
}

/**
 * Bloque Línea Directa (65% del Threat Score total).
 * Evalúa el peligro de línea tanto en Modo Hover como en Modo Blind Ban.
 */
export function evaluateLaneThreat(
  candidate: EnrichedChampion,
  targetLane: string,
  myChampion: string | null = null
): ThreatEvaluationResult {
  const reasons: string[] = [];
  let score = 0.0;

  const normalizedTargetLane = normalizeRole(targetLane, 'MIDDLE');

  // Filtro estricto: Si el campeón no pertenece al carril asignado, no representa amenaza de línea directa
  if (!isChampionInLane(candidate, normalizedTargetLane)) {
    return { score: 0.0, reasons: [] };
  }

  const candidateName = candidate.name;
  const targetLaneStats = candidate.lanesStats?.[normalizedTargetLane] || candidate.meta;
  const targetLanePickrate = getLanePickrate(candidate, normalizedTargetLane);

  // -------------------------------------------------------------
  // BIFURCACIÓN 1: MODO HOVER (Hay un campeón marcado por el usuario)
  // -------------------------------------------------------------
  if (myChampion) {
    const myData = ENRICHED_DB[myChampion];

    if (myData) {
      // 1. Hard Counter Directo
      const directCounter = myData.counters?.find(c => normalizeKey(c.name) === normalizeKey(candidateName));
      
      if (directCounter) {
        const domScore = Math.abs(directCounter.dominanceScore || 0);
        let counterBase = domScore * 1.3;

        if (directCounter.laneTag === 'Bad Lane') {
          counterBase *= 1.4;
        }

        let wr = 50.0;
        if (directCounter.winrate) {
          wr = typeof directCounter.winrate === 'string' 
            ? parseFloat(directCounter.winrate.replace('%', '')) 
            : Number(directCounter.winrate);
        }

        if (!isNaN(wr) && wr < 47.0) {
          counterBase += 1.5;
        }

        score += counterBase;
        reasons.push(`Hard Counter: Dominancia de ${domScore.toFixed(1)} contra tu ${myChampion} (${wr.toFixed(1)}% WR)`);

        // 2. Asfixia Temprana (Early pressure)
        const goldDiff = parseFloat(String(directCounter.goldDiff || '0'));
        const csDiff = parseFloat(String(directCounter.csDiff || '0'));

        if (goldDiff < -200 && csDiff < -10) {
          score += 1.8;
          reasons.push(`Asfixia Temprana: Desventaja crítica de oro (${goldDiff}) y CS (${csDiff}) al min 15`);
        }
      }

      // Comparación de fase de líneas
      const myLanePhase = myData.lanePhase || myData.lane_phase || 'average';
      const candidateLanePhase = candidate.lanePhase || candidate.lane_phase || 'average';
      const candidateTags = candidate.tags || [];
      const hasEarlyBurst = candidateTags.includes('Burst') || candidateTags.includes('EarlyPressure') || candidateTags.includes('EarlyGame');

      if (myLanePhase === 'weak' && candidateLanePhase === 'strong' && hasEarlyBurst) {
        score += 1.2;
        reasons.push(`Presión en Línea: Matchup de fase temprana débil frente a hostigador con burst`);
      }

      // 3. Modificador de Pickrate en la línea
      if (targetLanePickrate >= 10.0) {
        score *= 1.2;
        reasons.push(`Alta Frecuencia: Pickrate popular en ${normalizedTargetLane} (${targetLanePickrate.toFixed(1)}%)`);
      } else if (targetLanePickrate < 3.0 && score > 0) {
        score = Math.max(0, score - 1.5);
      }

      // 4. Gank Setup & Dive
      const candidateRole = candidate.tacticRole || candidate.tactic_role || 'teamfight';
      const hasHardCC = candidate.hasHardCC || candidate.has_hard_cc === 1;
      if (hasHardCC && (candidateRole === 'engage' || candidateRole === 'dive')) {
        score += 1.0;
        reasons.push("Gank Setup & Dive: Alto potencial de iniciación y control de masas en línea");
      }
    }
  } 
  // -------------------------------------------------------------
  // BIFURCACIÓN 2: MODO BLIND BAN (Sin hover marcado)
  // -------------------------------------------------------------
  else {
    const laneWr = targetLaneStats?.winRate || candidate.meta?.winRate || 50.0;
    const lanePr = targetLanePickrate;

    // 1. Presencia Opresiva en Línea
    const wrBonus = Math.max(0, (laneWr - 50.0) * 0.8);
    const prBonus = lanePr * 0.35;
    const oppressivePresence = wrBonus + prBonus + 1.0;

    if (oppressivePresence > 1.2) {
      score += oppressivePresence;
      reasons.push(`Presencia Opresiva: ${laneWr.toFixed(1)}% WR y ${lanePr.toFixed(1)}% Pickrate en ${normalizedTargetLane}`);
    }

    // 2. Pool Histórico: Evaluación contra los 3 campeones con mayor maestría del usuario en ese rol
    const masteryChamps = Object.entries(PERSONAL_STATS)
      .map(([idStr, stats]) => ({
        id: Number(idStr),
        name: getNameFromId(Number(idStr)),
        stats
      }))
      .filter(entry => entry.name && normalizeRole(ENRICHED_DB[entry.name]?.lane, 'UNKNOWN' as any) === normalizedTargetLane)
      .sort((a, b) => (b.stats.gamesPlayed * (b.stats.winRate / 100)) - (a.stats.gamesPlayed * (a.stats.winRate / 100)))
      .slice(0, 3);

    if (masteryChamps.length > 0) {
      let worstDelta = 0;
      let counterTarget = '';

      masteryChamps.forEach(champ => {
        const champData = ENRICHED_DB[champ.name];
        const counterMatch = champData?.counters?.find(c => normalizeKey(c.name) === normalizeKey(candidateName));
        if (counterMatch) {
          const dScore = Math.abs(counterMatch.dominanceScore || 0);
          if (dScore > worstDelta) {
            worstDelta = dScore;
            counterTarget = champ.name;
          }
        }
      });

      if (worstDelta > 0) {
        const poolPenalty = worstDelta * 0.8;
        score += poolPenalty;
        reasons.push(`Amenaza a tu Pool: Hard counter de tu campeón frecuente ${counterTarget} (+${poolPenalty.toFixed(1)})`);
      }
    }

    // 3. Gatekeeper de Línea: Conteo de dominanceScore > 0 frente al pool viable del carril
    const lanePool = DATA_BY_LANE[normalizedTargetLane] || [];
    let positiveMatchupCount = 0;
    
    lanePool.forEach(viableChamp => {
      const isDominating = viableChamp.counters?.some(c => normalizeKey(c.name) === normalizeKey(candidateName) && (c.dominanceScore || 0) < 0);
      const isGodOver = candidate.godMatchups?.some(g => normalizeKey(g.name) === normalizeKey(viableChamp.name) && (g.dominanceScore || 0) > 0);
      if (isDominating || isGodOver) {
        positiveMatchupCount++;
      }
    });

    if (positiveMatchupCount >= 4) {
      const gatekeeperBonus = Math.min(positiveMatchupCount * 0.35, 2.0);
      score += gatekeeperBonus;
      reasons.push(`Gatekeeper: Domina el enfrentamiento directo contra ${positiveMatchupCount} opciones del carril`);
    }
  }

  return {
    score: Math.max(0, score),
    reasons
  };
}
