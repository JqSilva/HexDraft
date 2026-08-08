// src/lib/services/proBuildService.ts
import { fetchProBuild, type OpggProBuild } from '../scrapers/opgg-scraper.js';
import {
  getProBuildFromCache,
  saveProBuildToCache,
  getTtlForSampleSize,
  cleanOldBuildCache
} from '../db/proBuild.repo.js';
import { getOpponentArchetype } from '../engine/archetypes.js';

export interface InFlightState {
  status: 'loading' | 'ready' | 'error' | 'insufficient_data';
  data?: OpggProBuild | null;
  error?: string | null;
  cachedAt?: number;
  timestamp: number;
}

const inFlightMap = new Map<string, InFlightState>();

function buildKey(champion: string, role: string, patch: string): string {
  return `${champion.toLowerCase()}_${role.toLowerCase()}_${patch}`;
}

export async function processProBuildRequest(
  champion: string,
  opponent: string,
  role: string,
  patch: string
) {
  cleanOldBuildCache(patch);

  const archetype = getOpponentArchetype(opponent);
  const key = buildKey(champion, role, patch);
  const nowSeconds = Math.floor(Date.now() / 1000);

  // 1. Buscar en SQLite
  const cachedRecord = getProBuildFromCache(champion, role, patch);
  if (cachedRecord) {
    const ageSeconds = nowSeconds - cachedRecord.cached_at;
    const allowedTtl = getTtlForSampleSize(cachedRecord.sample_size);

    if (ageSeconds <= allowedTtl) {
      return {
        status: 'ready',
        cachedAt: cachedRecord.cached_at,
        archetype,
        data: {
          championName: cachedRecord.champion_name,
          role: cachedRecord.role,
          patch: cachedRecord.patch,
          sampleSize: cachedRecord.sample_size,
          winRate: cachedRecord.win_rate,
          coreItems: JSON.parse(cachedRecord.core_items),
          boots: cachedRecord.boots,
          runes: JSON.parse(cachedRecord.runes),
          summoners: JSON.parse(cachedRecord.summoners),
          starterItems: JSON.parse(cachedRecord.starter_items)
        }
      };
    }
  }

  // 2. Si no existe o está stale -> Iniciar scraping en background de forma asíncrona
  const currentInFlight = inFlightMap.get(key);
  if (!currentInFlight || currentInFlight.status !== 'loading') {
    inFlightMap.set(key, { status: 'loading', timestamp: Date.now() });

    (async () => {
      console.log(`[PRO-BUILD] Iniciando scraping asíncrono en background para ${champion} (${role})...`);
      try {
        const buildResult = await fetchProBuild(champion, role, opponent);
        if (!buildResult) {
          console.warn(`[PRO-BUILD] Scraping finalizó con nulo para ${champion}`);
          inFlightMap.set(key, {
            status: 'error',
            error: 'No se pudo obtener información de op.gg',
            timestamp: Date.now()
          });
          return;
        }

        if (buildResult.sampleSize < 1 && buildResult.source !== 'otp_matchup' && buildResult.source !== 'otp_general') {
          console.warn(`[PRO-BUILD] Muestra insuficiente (${buildResult.sampleSize} < 1) para ${champion}`);
          inFlightMap.set(key, {
            status: 'insufficient_data',
            timestamp: Date.now()
          });
          return;
        }

        saveProBuildToCache(buildResult);
        inFlightMap.set(key, {
          status: 'ready',
          data: buildResult,
          cachedAt: Math.floor(Date.now() / 1000),
          timestamp: Date.now()
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[PRO-BUILD] Error en scraping background de ${champion}: ${msg}`);
        inFlightMap.set(key, {
          status: 'error',
          error: msg,
          timestamp: Date.now()
        });
      }
    })();
  }

  return {
    status: 'loading',
    cachedAt: cachedRecord ? cachedRecord.cached_at : null,
    archetype,
    data: null
  };
}

export function processProBuildStatus(
  champion: string,
  opponent: string,
  role: string,
  patch: string
) {
  const archetype = getOpponentArchetype(opponent);
  const key = buildKey(champion, role, patch);
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Comprobar BD SQLite primero
  const cachedRecord = getProBuildFromCache(champion, role, patch);
  if (cachedRecord) {
    const ageSeconds = nowSeconds - cachedRecord.cached_at;
    const allowedTtl = getTtlForSampleSize(cachedRecord.sample_size);
    if (ageSeconds <= allowedTtl) {
      return {
        status: 'ready',
        cachedAt: cachedRecord.cached_at,
        archetype,
        data: {
          championName: cachedRecord.champion_name,
          role: cachedRecord.role,
          patch: cachedRecord.patch,
          sampleSize: cachedRecord.sample_size,
          winRate: cachedRecord.win_rate,
          coreItems: JSON.parse(cachedRecord.core_items),
          boots: cachedRecord.boots,
          runes: JSON.parse(cachedRecord.runes),
          summoners: JSON.parse(cachedRecord.summoners),
          starterItems: JSON.parse(cachedRecord.starter_items)
        }
      };
    }
  }

  // Comprobar estado en memoria
  const inFlight = inFlightMap.get(key);
  if (inFlight) {
    if (inFlight.status === 'ready' && inFlight.data) {
      return {
        status: 'ready',
        cachedAt: inFlight.cachedAt || nowSeconds,
        archetype,
        data: inFlight.data
      };
    }
    return {
      status: inFlight.status,
      cachedAt: inFlight.cachedAt || null,
      archetype,
      data: null,
      error: inFlight.error || null
    };
  }

  return {
    status: 'loading',
    cachedAt: null,
    archetype,
    data: null
  };
}
