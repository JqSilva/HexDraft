// src/lib/engine/core/types.ts
import type { ChampionData } from '../../data/championdb.js';

export type ChampionLane = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';

export type TacticRole = 
  | 'engage' 
  | 'peel' 
  | 'poke' 
  | 'dive' 
  | 'burst' 
  | 'splitpush' 
  | 'skirmish' 
  | 'teamfight' 
  | 'siege' 
  | 'utility';

export type ScalingType = 'Early' | 'Mid' | 'Late';

export interface MatchupData {
  name: string;
  lane: string;
  winrate: string;
  goldDiff: string;
  xpDiff: string;
  csDiff: string;
  count: number;
  laneTag: 'Good Lane' | 'Bad Lane';
  dominanceScore: number;
}

export interface SynergyEntry {
  name: string;
  delta: string;
}

export interface EnrichedChampion extends ChampionData {
  lane: string;
  tags: string[];
  combat: {
    damageComposition: { physical: number; magic: number; true: number };
    winrateCurve: any[];
  };
  counters: MatchupData[];
  godMatchups: MatchupData[];
  synergies: Record<string, SynergyEntry[]>;
  meta: {
    winRate: number;
    tier: number;
  };
  scalingType: ScalingType;
  buildData?: any;
  builds?: any[];
  dpmData?: any;
  
  // Compatibilidad dual de nombres (snake_case / camelCase)
  tacticRole?: 'engage' | 'peel' | 'poke' | 'dive' | 'burst' | 'splitpush' | 'skirmish' | 'teamfight' | 'siege' | 'utility';
  tactic_role?: string;
  hasHardCC: boolean;
  isFrontline: boolean;
  isHypercarry: boolean;
  is_frontline?: number | boolean;
  is_hypercarry?: number | boolean;
  has_hard_cc?: number | boolean;
  hasSustain?: boolean;
  has_sustain?: number | boolean;
  hasShield?: boolean;
  has_shield?: number | boolean;
  lanePhase?: 'weak' | 'average' | 'strong';
  lane_phase?: string;
  resourceDependency?: 'high' | 'medium' | 'low';
  resource_dependency?: string;
  scaling_type?: string;
  damage_type?: string;
  playLanes?: string[];
  play_lanes?: string[];
  lanesPickrate?: Record<string, number | string>;
  lanes_pickrate?: Record<string, number | string>;
  lanesStats?: Record<string, { winRate: number; tier: number }>;
  lanes_stats?: Record<string, { winRate: number; tier: number }>;
  [key: string]: any;
}

export interface ItemAsset {
  id: number;
  name: string;
  gold: number;
  epicness: string;
  categories: string[];
  iconPath: string;
}

export interface PersonalStats {
  gamesPlayed: number;
  winRate: number;
}

export interface EngineWeights {
  meta_base: number;
  synergy: number;
  matchup: number;
  counter: number;
  composition: number;
  utility: number;
  scaling: number;
  tactic_role_bonus: number;
  personal_mastery: number;
  flex_value: number;
  phase_multiplier_pick5: number;
}
