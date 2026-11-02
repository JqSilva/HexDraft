import { db } from './sqlite.js';

export interface CachedChampionBuild {
  champion_id: number;
  lane: string;
  patch: string;
  source: string;
  payload: string;
  updated_at: string;
}

export const championBuildCacheRepo = {
  get(championId: number, lane: string): CachedChampionBuild | null {
    return (db.prepare(`
      SELECT champion_id, lane, patch, source, payload, updated_at
      FROM champion_build_cache
      WHERE champion_id = ? AND lane = ?
    `).get(championId, lane) as CachedChampionBuild | undefined) || null;
  },

  remove(championId: number, lane: string): void {
    db.prepare('DELETE FROM champion_build_cache WHERE champion_id = ? AND lane = ?').run(championId, lane);
  },

  save(entry: Omit<CachedChampionBuild, 'updated_at'>): void {
    db.prepare(`
      INSERT INTO champion_build_cache (champion_id, lane, patch, source, payload, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(champion_id, lane) DO UPDATE SET
        patch = excluded.patch,
        source = excluded.source,
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
    `).run(entry.champion_id, entry.lane, entry.patch, entry.source, entry.payload);
  }
};
