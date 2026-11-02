import type { APIRoute } from 'astro';
import { championBuildCacheRepo } from '../../lib/db/championBuildCache.repo.js';
import { getIdFromName, getNameFromId, normalizeRole } from '../../lib/engine/core/constants.js';
import { fetchLatestGameVersion } from '../../lib/gameVersion.js';
import { fetchLolalyticsChampionStats } from '../../lib/sources/lolalytics.source.js';
import { fetchOneTricksChampionBuild, normalizeLolalyticsPlaystyles } from '../../lib/sources/onetricks.source.js';

const inflight = new Map<string, Promise<any>>();

function sourceRole(role: string): string {
  return ({ TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'bot', UTILITY: 'support' } as Record<string, string>)[role] || 'mid';
}

function toPayload(cacheEntry: { payload: string } | null): any | null {
  if (!cacheEntry) return null;
  try { return JSON.parse(cacheEntry.payload); } catch { return null; }
}

async function loadChampionBuild(championId: number, championName: string, role: string, patch: string): Promise<any> {
  const lane = sourceRole(role);
  let oneTricksError = '';
  try {
    const result = await fetchOneTricksChampionBuild(championName, lane, patch);
    const sourceMetadata = {
      source: 'onetricks',
      url: result.url,
      patch,
      sourcePatch: result.patch,
      role,
      sourceRole: lane,
      tier: 'Masters+',
      region: 'All Major',
      dataType: 'first-item playstyles'
    };
    const payload = {
      sourceMetadata,
      playstyles: result.playstyles.map(style => ({
        ...style,
        title: '',
        statsData: {
          ...style.statsData,
          sourceMetadata: { ...style.statsData.sourceMetadata, ...sourceMetadata, playstyleItem: style.firstItemId }
        }
      }))
    };
    championBuildCacheRepo.save({ champion_id: championId, lane: role, patch, source: 'onetricks', payload: JSON.stringify(payload) });
    return payload;
  } catch (error: any) {
    oneTricksError = error?.message || 'No se pudieron leer los datos de OneTricks';
  }

  let lolalytics: any;
  try {
    lolalytics = await fetchLolalyticsChampionStats(championName, lane, patch, undefined, false);
  } catch (error: any) {
    throw new Error(`OneTricks: ${oneTricksError}. LoLalytics: ${error?.message || 'falló la consulta de respaldo'}`);
  }
  const playstyles = normalizeLolalyticsPlaystyles(lolalytics);
  if (playstyles.length < 2) throw new Error(`OneTricks: ${oneTricksError}. LoLalytics no entregó al menos dos playstyles utilizables.`);
  const sourceMetadata = {
    ...(lolalytics.sourceMetadata || {}),
    source: 'lolalytics',
    fallbackFrom: 'onetricks',
    fallbackReason: oneTricksError,
    patch,
    role,
    sourceRole: lane,
    dataType: 'first-item playstyles'
  };
  const payload = {
    sourceMetadata,
    playstyles: playstyles.map(style => ({
      ...style,
      title: '',
      statsData: {
        ...style.statsData,
        sourceMetadata: { ...style.statsData.sourceMetadata, ...sourceMetadata, playstyleItem: style.firstItemId }
      }
    }))
  };
  championBuildCacheRepo.save({ champion_id: championId, lane: role, patch, source: 'lolalytics', payload: JSON.stringify(payload) });
  return payload;
}

export const GET: APIRoute = async ({ url }) => {
  const rawId = Number(url.searchParams.get('championId'));
  const rawName = url.searchParams.get('champion') || '';
  const championId = Number.isInteger(rawId) && rawId > 0 ? rawId : getIdFromName(rawName);
  const championName = championId ? getNameFromId(championId) : rawName;
  if (!championId || !championName) return new Response(JSON.stringify({ error: 'Campeón inválido' }), { status: 400 });

  const role = normalizeRole(url.searchParams.get('role'), 'MIDDLE');
  const patchVersion = await fetchLatestGameVersion();
  const patch = String(patchVersion).split('.').slice(0, 2).join('.') || '16.1';
  const lane = role;

  const cached = championBuildCacheRepo.get(championId, lane);
  if (cached?.patch === patch) {
    const payload = toPayload(cached);
    if (payload?.playstyles?.length) return new Response(JSON.stringify({ ...payload, cached: true }), { status: 200 });
  }
  if (cached && cached.patch !== patch) championBuildCacheRepo.remove(championId, lane);

  const key = `${championId}:${lane}:${patch}`;
  let pending = inflight.get(key);
  if (!pending) {
    pending = loadChampionBuild(championId, championName, lane, patch).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  try {
    const payload = await pending;
    return new Response(JSON.stringify({ ...payload, cached: false }), { status: 200 });
  } catch (error: any) {
    console.error(`[CHAMPION BUILD DATA] ${championName} ${lane} ${patch}:`, error);
    return new Response(JSON.stringify({ error: error?.message || 'No se pudieron obtener los datos de build' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
