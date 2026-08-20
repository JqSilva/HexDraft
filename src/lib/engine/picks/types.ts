// src/lib/engine/picks/types.ts
export interface PickEngineInput {
  myTeamIds: number[];
  theirTeamIds: number[];
  bannedIds: number[];
  myRole: string;
  myPickId?: number;
  singleChampId?: number;
}

export interface Recommendation {
  id: number;
  name: string;
  score: number;
  reasons: string[];
  lane: string;
}

export type PickRecommendation = Recommendation;

export interface SingleChampionBuildResult {
  name: string;
  build: {
    summoners: any[];
    runes: {
      primaryStyle: number;
      secondaryStyle: number;
      keystone: any;
      shards: any[];
      selections: any[];
    };
    items: {
      boots: any;
      core: any[];
      starter: any[];
      paths: {
        snowball: any[];
        neutral: any[];
        behind: any[];
      };
    };
    skillOrder: string;
  };
}
