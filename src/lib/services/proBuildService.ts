import { fetchProBuilds, resolveTearAndEvolutions, type OpggProBuild } from '../scrapers/opgg-scraper.js';
import {
  getProBuildFromCache,
  saveProBuildToCache,
  getTtlForSampleSize,
  cleanOldBuildCache
} from '../db/proBuild.repo.js';
import { getOpponentArchetype } from '../engine/archetypes.js';
import { logOpgg } from '../utils/opggLogger.js';
import { getSituationalSwapsForBuild } from '../engine/itemEngine.js';

export interface InFlightState {
  status: 'loading' | 'ready' | 'error' | 'insufficient_data';
  builds?: OpggProBuild[];
  data?: OpggProBuild | null;
  error?: string | null;
  cachedAt?: number;
  timestamp: number;
}

const inFlightMap = new Map<string, InFlightState>();

function buildKey(champion: string, role: string, patch: string, archetype: string): string {
  return `${champion.toLowerCase()}_${role.toLowerCase()}_${patch}_${archetype.toLowerCase()}`;
}

function enrichBuildWithContext(
  build: OpggProBuild,
  allies: string[] = [],
  enemies: string[] = []
): OpggProBuild {
  const resolved = resolveTearAndEvolutions(build.coreItems, build.championName);
  const situationalSwaps = getSituationalSwapsForBuild(
    build.championName,
    resolved.completedCore,
    build.boots,
    allies,
    enemies
  );

  return {
    ...build,
    earlyBuy: build.earlyBuy || resolved.earlyBuy,
    coreItems: resolved.completedCore,
    situationalSwaps
  };
}

export async function processProBuildRequest(
  champion: string,
  opponent: string,
  role: string,
  patch: string,
  allies: string[] = [],
  enemies: string[] = []
) {
  cleanOldBuildCache(patch);

  const archetype = getOpponentArchetype(opponent) || 'generalist';
  const key = buildKey(champion, role, patch, archetype);
  const nowSeconds = Math.floor(Date.now() / 1000);

  const resolvedEnemies = enemies.length > 0 ? enemies : (opponent ? [opponent] : []);

  logOpgg('API-REQ', `Petición recibida para ${champion} (${role}) vs ${opponent || 'ninguno'} (arquetipo: ${archetype})`, {
    champion,
    role,
    opponent,
    archetype
  });

  // 1. Buscar en memoria si ya tenemos las builds listas para este arquetipo
  const inFlight = inFlightMap.get(key);
  if (inFlight && inFlight.status === 'ready' && inFlight.builds && inFlight.builds.length > 0) {
    const enrichedBuilds = inFlight.builds.map(b => enrichBuildWithContext(b, allies, resolvedEnemies));
    logOpgg('CACHE-MEMORY-HIT', `Builds servidas desde memoria activa para ${champion} vs ${archetype}`, {
      buildCount: enrichedBuilds.length
    });
    return {
      status: 'ready',
      cachedAt: inFlight.cachedAt || nowSeconds,
      archetype,
      builds: enrichedBuilds,
      data: enrichedBuilds[0]
    };
  }

  // 2. Buscar en SQLite para este arquetipo específico
  const cachedRecord = getProBuildFromCache(champion, role, patch, archetype);
  if (cachedRecord) {
    const ageSeconds = nowSeconds - cachedRecord.cached_at;
    const allowedTtl = getTtlForSampleSize(cachedRecord.sample_size);

    if (ageSeconds <= allowedTtl) {
      logOpgg('CACHE-SQLITE-HIT', `Build servida desde base de datos SQLite para ${champion} vs ${archetype}`, {
        sampleSize: cachedRecord.sample_size,
        ageSeconds
      });

      const cachedData: OpggProBuild = {
        id: 'cached-1',
        title: `Build vs ${archetype}`,
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

      const enriched = enrichBuildWithContext(cachedData, allies, resolvedEnemies);

      return {
        status: 'ready',
        cachedAt: cachedRecord.cached_at,
        archetype,
        builds: [enriched],
        data: enriched
      };
    }
  }

  // 3. Iniciar scraping en background de hasta 3 builds
  if (!inFlight || inFlight.status !== 'loading') {
    inFlightMap.set(key, { status: 'loading', timestamp: Date.now() });
    logOpgg('SCRAPING-BACKGROUND-START', `Iniciando scraping en background para ${champion} (${role}) vs ${archetype}`);

    (async () => {
      try {
        const builds = await fetchProBuilds(champion, role, opponent);
        if (!builds || builds.length === 0) {
          logOpgg('SCRAPING-WARN', `Scraping finalizó sin builds para ${champion}`);
          inFlightMap.set(key, {
            status: 'error',
            error: 'No se pudo obtener información de op.gg',
            timestamp: Date.now()
          });
          return;
        }

        saveProBuildToCache(builds[0], archetype);
        inFlightMap.set(key, {
          status: 'ready',
          builds,
          data: builds[0],
          cachedAt: Math.floor(Date.now() / 1000),
          timestamp: Date.now()
        });
        logOpgg('SCRAPING-SUCCESS', `Scraping completado para ${champion} vs ${archetype}. Builds generadas: ${builds.length}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logOpgg('SCRAPING-FATAL', `Error en background para ${champion}: ${msg}`);
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
  patch: string,
  allies: string[] = [],
  enemies: string[] = []
) {
  const archetype = getOpponentArchetype(opponent) || 'generalist';
  const key = buildKey(champion, role, patch, archetype);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const resolvedEnemies = enemies.length > 0 ? enemies : (opponent ? [opponent] : []);

  const inFlight = inFlightMap.get(key);
  if (inFlight) {
    if (inFlight.status === 'ready' && inFlight.builds && inFlight.builds.length > 0) {
      const enrichedBuilds = inFlight.builds.map(b => enrichBuildWithContext(b, allies, resolvedEnemies));
      return {
        status: 'ready',
        cachedAt: inFlight.cachedAt || nowSeconds,
        archetype,
        builds: enrichedBuilds,
        data: enrichedBuilds[0]
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
