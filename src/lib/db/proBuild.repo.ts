// src/lib/db/proBuild.repo.ts
import { db } from './sqlite.js';
import type { OpggProBuild } from '../scrapers/opgg-scraper.js';

export interface DbProBuildRecord {
  champion_name: string;
  role: string;
  patch: string;
  archetype: string;
  cached_at: number;
  sample_size: number;
  win_rate: number;
  core_items: string;
  boots: number;
  runes: string;
  summoners: string;
  starter_items: string;
}

export function cleanOldBuildCache(currentPatch?: string): void {
  try {
    // Eliminar registros con más de 7 días (604800 segundos) de antigüedad
    db.prepare(`
      DELETE FROM pro_build_cache 
      WHERE cached_at < (strftime('%s','now') - 604800)
    `).run();

    // Eliminar inmediatamente registros de parches anteriores
    if (currentPatch) {
      db.prepare(`
        DELETE FROM pro_build_cache 
        WHERE patch != ?
      `).run(currentPatch);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PRO-BUILD] Error al limpiar cache de builds: ${msg}`);
  }
}

export function getTtlForSampleSize(sampleSize: number): number {
  if (sampleSize >= 30) return 345600; // 4 días
  if (sampleSize >= 15) return 259200; // 3 días
  if (sampleSize >= 1) return 86400;   // 1 día (Válido para OTP o muestras iniciales)
  return 0;                            // Insuficiente
}

export function getProBuildFromCache(
  championName: string,
  role: string,
  patch: string,
  archetype: string = 'generalist'
): DbProBuildRecord | null {
  try {
    const stmt = db.prepare(`
      SELECT champion_name, role, patch, archetype, cached_at, sample_size, win_rate, core_items, boots, runes, summoners, starter_items
      FROM pro_build_cache
      WHERE LOWER(champion_name) = LOWER(?) AND LOWER(role) = LOWER(?) AND patch = ? AND LOWER(archetype) = LOWER(?)
    `);
    const record = stmt.get(championName, role, patch, archetype) as DbProBuildRecord | undefined;
    return record || null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PRO-BUILD] Error leyendo cache para ${championName} (${archetype}): ${msg}`);
    return null;
  }
}

export function saveProBuildToCache(data: OpggProBuild, archetype: string = 'generalist'): boolean {
  if (data.sampleSize < 1 && data.source !== 'otp_matchup' && data.source !== 'otp_general') {
    console.log(`[PRO-BUILD] Muestra insuficiente (${data.sampleSize} < 1) para ${data.championName}. No se guarda en cache.`);
    return false;
  }

  try {
    cleanOldBuildCache();

    const stmt = db.prepare(`
      INSERT INTO pro_build_cache (
        champion_name, role, patch, archetype, cached_at, sample_size, win_rate, core_items, boots, runes, summoners, starter_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(champion_name, role, patch, archetype) DO UPDATE SET
        cached_at = excluded.cached_at,
        sample_size = excluded.sample_size,
        win_rate = excluded.win_rate,
        core_items = excluded.core_items,
        boots = excluded.boots,
        runes = excluded.runes,
        summoners = excluded.summoners,
        starter_items = excluded.starter_items;
    `);

    const nowSeconds = Math.floor(Date.now() / 1000);

    stmt.run(
      data.championName,
      data.role,
      data.patch,
      archetype || 'generalist',
      nowSeconds,
      data.sampleSize,
      data.winRate,
      JSON.stringify(data.coreItems),
      data.boots,
      JSON.stringify(data.runes),
      JSON.stringify(data.summoners),
      JSON.stringify(data.starterItems)
    );

    console.log(`[PRO-BUILD] Build guardada en cache para ${data.championName} (${data.role}, ${data.patch}, ${archetype})`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PRO-BUILD] Error guardando build en cache para ${data.championName}: ${msg}`);
    return false;
  }
}
