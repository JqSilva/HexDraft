// src/lib/engine/bans/index.ts
import { ENRICHED_DB, initializeEngineData } from '../core/dataProvider.js';
import { normalizeRole, NAME_TO_ID, normalizeKey } from '../core/constants.js';
import type { EnrichedChampion } from '../core/types.js';
import type { BanEngineInput, BansRecommendation, BanRecommendation } from './types.js';
import { evaluateLaneThreat, isChampionInLane } from './laneThreatEvaluator.js';
import { evaluateMetaThreat } from './metaThreatEvaluator.js';
import { evaluateCompThreat } from './compThreatEvaluator.js';

export * from './types.js';
export { evaluateLaneThreat, isChampionInLane, getLanePickrate } from './laneThreatEvaluator.js';
export { evaluateMetaThreat } from './metaThreatEvaluator.js';
export { evaluateCompThreat } from './compThreatEvaluator.js';

// Inicializar el dataset base en memoria
initializeEngineData();

/**
 * Entrypoint principal de recomendaciones de BANS con cálculo ponderado y calibrado (1.0 - 10.0).
 */
export function getBanRecommendations(
  myChampion: string | null = null,
  myRole: string = 'MIDDLE',
  alliedPicks: string[] = [],
  enemyPicks: string[] = [],
  bannedChamps: string[] = [],
  allAvailableChamps: string[] = []
): BansRecommendation[] {
  const normBanned = bannedChamps.map(normalizeKey);
  const normAllies = alliedPicks.map(normalizeKey);
  const normEnemies = enemyPicks.map(normalizeKey);

  const targetLane = normalizeRole(myRole, 'MIDDLE');

  // Filtrar candidatos disponibles
  const poolNames = allAvailableChamps && allAvailableChamps.length > 0 
    ? allAvailableChamps 
    : Object.keys(ENRICHED_DB);

  // Filtro estricto: Disponibilidad y pertenencia obligatoria al carril objetivo
  const availableCandidates = poolNames.filter(name => {
    const candidate = ENRICHED_DB[name];
    if (!candidate) return false;
    const norm = normalizeKey(name);
    if (normBanned.includes(norm) || normAllies.includes(norm) || normEnemies.includes(norm)) {
      return false;
    }
    return isChampionInLane(candidate, targetLane);
  });

  const results: BansRecommendation[] = [];

  for (const name of availableCandidates) {
    const candidate = ENRICHED_DB[name];
    const champId = NAME_TO_ID[name];
    if (!candidate || !champId) continue;

    // 1. Evaluación de Línea Directa (65%)
    const laneResult = evaluateLaneThreat(candidate, targetLane, myChampion);

    // 2. Evaluación de Meta Global (20%)
    const metaResult = evaluateMetaThreat(candidate, targetLane);

    // 3. Evaluación de Composición (15%)
    const compResult = evaluateCompThreat(candidate, alliedPicks, myChampion);

    // Ponderación de bloques
    const rawScore = (laneResult.score * 0.65) + (metaResult.score * 0.20) + (compResult.score * 0.15);

    // Normalización y calibración a escala 1.0 - 10.0
    // - Blind Ban Top 1-3: ~7.0 - 8.5
    // - Hover Hard Counters: ~8.5 - 9.8
    let scaledScore = rawScore * 1.55;

    if (scaledScore > 8.5) {
      scaledScore = 8.5 + (scaledScore - 8.5) * 0.65;
    }

    const finalScore = parseFloat(Math.min(9.8, Math.max(1.0, scaledScore)).toFixed(1));

    // Consolidar razones positivas
    const allReasons = [...laneResult.reasons, ...metaResult.reasons, ...compResult.reasons];
    const uniqueReasons = Array.from(new Set(allReasons)).filter(Boolean);
    if (uniqueReasons.length === 0) {
      uniqueReasons.push(`Selección común en ${targetLane} con presencia constante`);
    }

    results.push({
      id: champId,
      name,
      score: finalScore,
      reasons: uniqueReasons.slice(0, 3),
      breakdown: {
        laneThreat: parseFloat((laneResult.score * 1.55).toFixed(1)),
        metaThreat: parseFloat((metaResult.score * 1.55).toFixed(1)),
        compThreat: parseFloat((compResult.score * 1.55).toFixed(1))
      }
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

/**
 * Sobrecarga flexible compatible con llamadas legacy o estructuradas.
 */
export function getProcessedBans(
  topRecommendationsOrInput: any[] | BanEngineInput,
  myChampion: string | null = null,
  myRole: string = 'MIDDLE',
  alliedPicks: string[] = [],
  enemyPicks: string[] = [],
  bannedChamps: string[] = [],
  allAvailableChamps: string[] = []
): BansRecommendation[] {
  if (topRecommendationsOrInput && !Array.isArray(topRecommendationsOrInput) && typeof topRecommendationsOrInput === 'object') {
    const input = topRecommendationsOrInput as BanEngineInput;
    return getBanRecommendations(
      input.myChampion ?? null,
      normalizeRole(input.myRole, 'MIDDLE'),
      input.alliedPicks || [],
      input.enemyPicks || [],
      input.bannedChamps || [],
      input.allAvailableChamps || []
    );
  }

  return getBanRecommendations(
    myChampion,
    normalizeRole(myRole, 'MIDDLE'),
    alliedPicks,
    enemyPicks,
    bannedChamps,
    allAvailableChamps
  );
}
