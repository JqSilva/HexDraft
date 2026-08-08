// src/lib/services/proBuildService.ts
import { fetchProBuilds, type OpggProBuild } from '../scrapers/opgg-scraper.js';
import {
  getProBuildFromCache,
  saveProBuildToCache,
  getTtlForSampleSize,
  cleanOldBuildCache
} from '../db/proBuild.repo.js';
import { getOpponentArchetype } from '../engine/archetypes.js';

export interface InFlightState {
  status: 'loading' | 'ready' | 'error' | 'insufficient_data';
  builds?: OpggProBuild[];
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

  // 1. Buscar en memoria si ya tenemos las 3 builds listas
  const inFlight = inFlightMap.get(key);
  if (inFlight && inFlight.status === 'ready' && inFlight.builds && inFlight.builds.length > 0) {
    return {
      status: 'ready',
      cachedAt: inFlight.cachedAt || nowSeconds,
      archetype,
      builds: inFlight.builds,
      data: inFlight.builds[0]
    };
  }

  // 2. Buscar en SQLite
  const cachedRecord = getProBuildFromCache(champion, role, patch);
  if (cachedRecord) {
    const ageSeconds = nowSeconds - cachedRecord.cached_at;
    const allowedTtl = getTtlForSampleSize(cachedRecord.sample_size);

    if (ageSeconds <= allowedTtl) {
      const cachedData: OpggProBuild = {
        id: 'cached-1',
        title: 'Build Recomendada',
        championName: cachedRecord.champion_name,
        role: cachedRecord.role,
        patch: cachedRecord.patch,
        sampleSize: cachedRecord.sample_size,
        winRate: cachedRecord.win_rate,
        coreItems: JSON.parse(cachedRecord.core_items),
        boots: cachedRecord.boots,
        runes: JSON.parse(cachedRecord.runes),
        summoners: JSON.parse(cachedRecord.summoners),
        starterItems: JSON.parse(cachedRecord.starter_items),
        source: 'general_pro'
      };

      return {
        status: 'ready',
        cachedAt: cachedRecord.cached_at,
        archetype,
        builds: [cachedData],
        data: cachedData
      };
    }
  }

  // 3. Iniciar scraping en background de hasta 3 builds
  if (!inFlight || inFlight.status !== 'loading') {
    inFlightMap.set(key, { status: 'loading', timestamp: Date.now() });

    (async () => {
      console.log(`[PRO-BUILD] Iniciando scraping de 3 builds para ${champion} (${role})...`);
      try {
        const builds = await fetchProBuilds(champion, role, opponent);
        if (!builds || builds.length === 0) {
          console.warn(`[PRO-BUILD] Scraping finalizó sin builds para ${champion}`);
          inFlightMap.set(key, {
            status: 'error',
            error: 'No se pudo obtener información de op.gg',
            timestamp: Date.now()
          });
          return;
        }

        saveProBuildToCache(builds[0]);
        inFlightMap.set(key, {
          status: 'ready',
          builds,
          data: builds[0],
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
    builds: [],
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

  const inFlight = inFlightMap.get(key);
  if (inFlight) {
    if (inFlight.status === 'ready' && inFlight.builds && inFlight.builds.length > 0) {
      return {
        status: 'ready',
        cachedAt: inFlight.cachedAt || nowSeconds,
        archetype,
        builds: inFlight.builds,
        data: inFlight.builds[0]
      };
    }
    return {
      status: inFlight.status,
      cachedAt: inFlight.cachedAt || null,
      archetype,
      builds: inFlight.builds || [],
      data: inFlight.data || null,
      error: inFlight.error || null
    };
  }

  return {
    status: 'loading',
    cachedAt: null,
    archetype,
    builds: [],
    data: null
  };
}
