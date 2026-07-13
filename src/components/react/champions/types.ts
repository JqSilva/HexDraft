export interface LaneStats {
  winRate: number;
  tier: number;
}

export interface ChampionMeta {
  winRate: number;
  tier: number;
}

export interface Champion {
  id: number;
  name: string;
  lane: string;
  damageType: string;
  class: string;
  isFrontline: boolean;
  isHypercarry: boolean;
  hasHardCC: boolean;
  tags: string[];
  scalingType: string;
  pickrate: number;
  matches: number;
  lanesStats: Record<string, LaneStats>;
  lanesPickrate: Record<string, number>;
  meta: ChampionMeta;
  builds?: Build[];
  counters?: Counter[];
  synergies?: Record<string, Synergy[]>;
}

export interface RuneSelections {
  primaryStyleId: number;
  subStyleId: number;
  selections: number[];
  shards: number[];
}

export interface BuildItems {
  starter?: number[];
  boots?: any;
  core?: any[];
  coreSlots?: any[];
  paths?: {
    snowball?: any[];
    neutral?: any[];
    behind?: any[];
  };
  slotItems?: Record<string, any>;
}

export interface BuildSkills {
  skillLevelUp1?: number;
  skillLevelUp2?: number;
  skillLevelUp3?: number;
}

export interface Build {
  id: number;
  build_name: string;
  is_default: boolean;
  runes: RuneSelections;
  items: BuildItems;
  summoners: number[];
  skills?: BuildSkills;
  special_notes?: {
    winrate: number;
    games: number;
  };
}

export interface Counter {
  name: string;
  winrate: string;
  dominanceScore: string;
  lane: string;
}

export interface Synergy {
  name: string;
  delta: string;
}
