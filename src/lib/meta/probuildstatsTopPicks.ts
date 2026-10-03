import bundledSnapshot from '../data/probuildstats-top-picks.json';

export const META_LANES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
export type MetaLane = (typeof META_LANES)[number];

export interface ProbuildstatsTopPick {
  championId: number;
  rank: number;
}

export interface ProbuildstatsTopPicksSnapshot {
  schemaVersion: 1;
  source: string;
  patch: string;
  updatedAt: string;
  version: string;
  roles: Record<MetaLane, ProbuildstatsTopPick[]>;
}

const ROLE_ALIASES: Record<string, MetaLane> = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  JNG: 'JUNGLE',
  MIDDLE: 'MIDDLE',
  MID: 'MIDDLE',
  BOTTOM: 'BOTTOM',
  BOT: 'BOTTOM',
  ADC: 'BOTTOM',
  UTILITY: 'UTILITY',
  SUPPORT: 'UTILITY',
  SUPP: 'UTILITY'
};

export function normalizeMetaLane(lane: string): MetaLane | null {
  return ROLE_ALIASES[lane.trim().toUpperCase()] || null;
}

export function validateProbuildstatsSnapshot(value: unknown): ProbuildstatsTopPicksSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ProbuildstatsTopPicksSnapshot>;
  if (candidate.schemaVersion !== 1 || typeof candidate.version !== 'string' || !candidate.roles) return null;

  const roles = {} as Record<MetaLane, ProbuildstatsTopPick[]>;
  for (const lane of META_LANES) {
    const entries = candidate.roles[lane];
    if (!Array.isArray(entries) || entries.length !== 20) return null;
    const ids = new Set<number>();
    const ranks = new Set<number>();
    const normalized: ProbuildstatsTopPick[] = [];
    for (const entry of entries) {
      const championId = Number(entry?.championId);
      const rank = Number(entry?.rank);
      if (!Number.isInteger(championId) || championId <= 0 || !Number.isInteger(rank) || rank < 1 || rank > 20 || ids.has(championId) || ranks.has(rank)) return null;
      ids.add(championId);
      ranks.add(rank);
      normalized.push({ championId, rank });
    }
    if (ranks.size !== 20) return null;
    roles[lane] = normalized.sort((a, b) => a.rank - b.rank);
  }

  return {
    schemaVersion: 1,
    source: String(candidate.source || ''),
    patch: String(candidate.patch || ''),
    updatedAt: String(candidate.updatedAt || ''),
    version: candidate.version,
    roles
  };
}

const bundled = validateProbuildstatsSnapshot(bundledSnapshot);
let activeSnapshot: ProbuildstatsTopPicksSnapshot = bundled || {
  schemaVersion: 1,
  source: 'https://probuildstats.com/top-picks',
  patch: '',
  updatedAt: '',
  version: '',
  roles: Object.fromEntries(META_LANES.map(lane => [lane, []])) as unknown as Record<MetaLane, ProbuildstatsTopPick[]>
};

export function getProbuildstatsTopPicksSnapshot(): ProbuildstatsTopPicksSnapshot {
  return activeSnapshot;
}

export function setProbuildstatsTopPicksSnapshot(value: unknown): boolean {
  const validated = validateProbuildstatsSnapshot(value);
  if (!validated) return false;
  activeSnapshot = validated;
  return true;
}

export function getTopPickRank(championId: number, lane: string): number | null {
  const normalizedLane = normalizeMetaLane(lane);
  if (!normalizedLane) return null;
  return activeSnapshot.roles[normalizedLane].find(entry => entry.championId === Number(championId))?.rank ?? null;
}

export function getChampionTopRoleRanks(championId: number): Array<{ lane: MetaLane; rank: number }> {
  return META_LANES.flatMap(lane => {
    const entry = activeSnapshot.roles[lane].find(candidate => candidate.championId === Number(championId));
    return entry ? [{ lane, rank: entry.rank }] : [];
  }).sort((a, b) => a.rank - b.rank);
}
