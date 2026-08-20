// src/lib/engine/bans/types.ts
export interface BanRecommendationBreakdown {
  laneThreat: number;
  metaThreat: number;
  compThreat: number;
}

export interface BansRecommendation {
  id: number;
  score: number;
  name: string;
  reasons?: string[];
  breakdown?: BanRecommendationBreakdown;
}

export type BanRecommendation = BansRecommendation;

export interface BanEngineInput {
  myChampion?: string | null;
  myRole: string;
  alliedPicks?: string[];
  enemyPicks?: string[];
  bannedChamps?: string[];
  allAvailableChamps?: string[];
  topRecommendations?: Array<{ name: string; score: number; id?: number }>;
}

export interface ThreatEvaluationResult {
  score: number;
  reasons: string[];
}
