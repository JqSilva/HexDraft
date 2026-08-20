// src/lib/engine/picks/index.ts
import { DATA_BY_LANE, ENRICHED_DB, initializeEngineData } from '../core/dataProvider.js';
import { normalizeRole, getNameFromId } from '../core/constants.js';
import type { EnrichedChampion } from '../core/types.js';
import type { Recommendation, PickRecommendation, PickEngineInput } from './types.js';
import { calculateScore, getSingleChampionBuild } from './pickScoring.js';

export * from './types.js';
export { calculateScore, getSingleChampionBuild } from './pickScoring.js';
export { 
  analyzeComposition, 
  detectEnemyArchetype, 
  detectAllyArchetype, 
  type EnemyArchetype, 
  type AllyArchetype, 
  type ArchetypeReading, 
  type CompositionAnalysis 
} from './compositionAnalyzer.js';

// Inicializar el dataset base en memoria
initializeEngineData();

/**
 * Entrypoint principal de recomendaciones de PICKS.
 * Retorna exclusivamente objetos ligeros { id, name, score, reasons, lane }.
 */
export function getProcessedRecommendations(
  myTeamIdsOrInput: number[] | PickEngineInput,
  theirTeamIds: number[] = [],
  bannedIds: number[] = [],
  myRole: string = 'MIDDLE',
  myPickId?: number,
  singleChampId?: number
): Recommendation[] {
  let myTeamIds: number[];
  let enemies: number[];
  let bans: number[];
  let role: string;
  let pickId: number | undefined;
  let singleId: number | undefined;

  if (!Array.isArray(myTeamIdsOrInput) && typeof myTeamIdsOrInput === 'object') {
    myTeamIds = myTeamIdsOrInput.myTeamIds || [];
    enemies = myTeamIdsOrInput.theirTeamIds || [];
    bans = myTeamIdsOrInput.bannedIds || [];
    role = myTeamIdsOrInput.myRole || 'MIDDLE';
    pickId = myTeamIdsOrInput.myPickId;
    singleId = myTeamIdsOrInput.singleChampId;
  } else {
    myTeamIds = myTeamIdsOrInput || [];
    enemies = theirTeamIds || [];
    bans = bannedIds || [];
    role = myRole || 'MIDDLE';
    pickId = myPickId;
    singleId = singleChampId;
  }

  const cleanMyTeamIds = pickId 
    ? myTeamIds.filter(id => id !== pickId) 
    : myTeamIds;
  const unavailableIds = [...cleanMyTeamIds, ...enemies, ...bans];

  const results: Recommendation[] = [];

  const targetLane = normalizeRole(role, 'MIDDLE');

  const allyNames = myTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];
  const enemyNames = enemies.map(id => getNameFromId(id)).filter(Boolean) as string[];

  let pool = DATA_BY_LANE[targetLane] || [];
  if (pool.length === 0) {
    pool = (Object.values(ENRICHED_DB) as EnrichedChampion[]).filter(c => {
      const primary = normalizeRole(c.lane, 'UNKNOWN' as any);
      if (primary === targetLane) return true;
      const playLanes: string[] = c.playLanes || c.play_lanes || [];
      return Array.isArray(playLanes) && playLanes.map(l => normalizeRole(l, 'UNKNOWN' as any)).includes(targetLane);
    });
  }

  if (singleId) {
    const targetChamp = pool.find(c => c.id === singleId) || 
                        (Object.values(ENRICHED_DB) as EnrichedChampion[]).find(c => c.id === singleId);
    pool = targetChamp ? [targetChamp] : [];
  }

  for (const c of pool) {
    if (!singleId && unavailableIds.includes(c.id)) continue;
    const { score, reasons } = calculateScore(c, allyNames, enemyNames, unavailableIds);

    results.push({
      id: c.id,
      name: c.name,
      score: score,
      reasons: reasons,
      lane: targetLane
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 30);
}
