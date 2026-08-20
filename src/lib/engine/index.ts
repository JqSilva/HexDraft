// src/lib/engine/index.ts
// Re-exportación consolidada de submódulos desacoplados

// 1. Core
export type {
  ChampionLane,
  TacticRole,
  ScalingType,
  MatchupData,
  SynergyEntry,
  EnrichedChampion,
  ItemAsset,
  PersonalStats,
  EngineWeights
} from './core/types.js';

export {
  normalizeKey,
  ROLE_TO_LANE_MAP,
  normalizeRole,
  normalizeLane,
  NAME_TO_ID,
  getIdFromName,
  getNameFromId,
  isFlexChampion,
  engineWeights,
  setEngineWeights,
  PERSONAL_STATS,
  initializePersonalStats
} from './core/constants.js';

export {
  ENRICHED_DB,
  ITEMS_DB,
  DATA_BY_LANE,
  initializeEngineData,
  initializeItemsData
} from './core/dataProvider.js';

export { hydrateAsset } from './core/hydrator.js';

// 2. Picks
export type {
  PickEngineInput,
  Recommendation,
  PickRecommendation,
  SingleChampionBuildResult,
  EnemyArchetype,
  AllyArchetype,
  ArchetypeReading,
  CompositionAnalysis
} from './picks/index.js';

export {
  getProcessedRecommendations,
  getSingleChampionBuild,
  calculateScore,
  analyzeComposition,
  detectEnemyArchetype,
  detectAllyArchetype
} from './picks/index.js';

// 3. Bans
export type {
  BanRecommendationBreakdown,
  BansRecommendation,
  BanRecommendation,
  BanEngineInput,
  ThreatEvaluationResult
} from './bans/index.js';

export {
  getProcessedBans,
  getBanRecommendations,
  evaluateLaneThreat,
  isChampionInLane,
  getLanePickrate,
  evaluateMetaThreat,
  evaluateCompThreat
} from './bans/index.js';

// 4. Motores Especializados
export * from './itemEngine.js';
export * from './streakEngine.js';
export * from './tacticalEngine.js';
