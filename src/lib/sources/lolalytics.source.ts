import axios from 'axios';
import { API_NAME_MAP } from '../domain/champion-name-resolver.js';
import { CHAMPIONS_DB } from '../data/championdb.js';
import { fetchWithFlareSolverr } from './flaresolverr.source.js';
import assetsMap from '../data/assets-map.json' with { type: 'json' };

type QwikPayload = { objs: any[] };
type StatTuple = [number, number, number, number, number, number];

const USER_AGENT = 'HexDraft/3.0 (+https://github.com/)';
const LANE_NAMES = ['top', 'jungle', 'middle', 'bottom', 'support'];
const GAME_TIME_LABELS = ['0-15', '15-20', '20-25', '25-30', '30-35', '35-40', '40+'];
// Espaciado global entre solicitudes para evitar ráfagas cuando varios workers
// descargan campeones simultáneamente. Se puede ajustar en despliegues propios.
const REQUEST_DELAY_MS = Math.max(500, Number(process.env.HEXDRAFT_LOLALYTICS_DELAY_MS || 900));
let nextAllowedRequestAt = 0;
let requestQueue = Promise.resolve();

async function throttledAxiosGet(url: string, config: any): Promise<any> {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;

  try {
    const waitMs = Math.max(0, nextAllowedRequestAt - Date.now());
    if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
    return await axios.get(url, config);
  } finally {
    nextAllowedRequestAt = Date.now() + REQUEST_DELAY_MS;
    release();
  }
}
const RUNE_ROWS: Record<number, number> = {
  8005: 0, 8008: 0, 8009: 1, 8010: 0, 8014: 3, 8017: 3, 8021: 0,
  8105: 3, 8106: 3, 8112: 0, 8126: 1, 8128: 0, 8135: 3, 8137: 2,
  8139: 1, 8140: 2, 8141: 2, 8143: 1, 8210: 2, 8214: 0, 8224: 1,
  8226: 1, 8229: 0, 8230: 0, 8232: 3, 8233: 2, 8234: 2, 8236: 3,
  8237: 3, 8242: 3, 8275: 1, 8299: 3, 8304: 1, 8306: 1, 8313: 2,
  8316: 3, 8321: 1, 8345: 2, 8347: 3, 8351: 0, 8352: 2, 8360: 0,
  8369: 0, 8401: 1, 8410: 3, 8429: 2, 8437: 0, 8439: 0, 8444: 2,
  8446: 1, 8451: 3, 8453: 3, 8463: 1, 8465: 0, 8473: 2, 8992: 0,
  9101: 1, 9103: 2, 9104: 2, 9105: 2, 9111: 1, 9923: 0
};

function numberOf(value: any, fallback = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function percentage(value: any): number {
  // LoLalytics serializa 0.98 como 0.98%, no como 0.0098.
  return numberOf(value);
}

function refIndex(value: any, size: number): number {
  if (typeof value !== 'string' || !/^[0-9a-z]+$/.test(value)) return -1;
  const result = parseInt(value, 36);
  return result >= 0 && result < size ? result : -1;
}

function decodeQwik(payload: QwikPayload, rootIndex: number): any {
  const cache = new Map<number, any>();
  const resolving = new Set<number>();

  const resolve = (value: any, depth = 0): any => {
    if (depth > 50) return value;
    if (typeof value === 'string') {
      const index = refIndex(value, payload.objs.length);
      if (index < 0) return value;
      if (cache.has(index)) return cache.get(index);
      if (resolving.has(index)) return value;
      resolving.add(index);
      const result = resolve(payload.objs[index], depth + 1);
      resolving.delete(index);
      cache.set(index, result);
      return result;
    }
    if (Array.isArray(value)) return value.map(item => resolve(item, depth + 1));
    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [key, child] of Object.entries(value)) result[key] = resolve(child, depth + 1);
      return result;
    }
    return value;
  };

  return resolve(payload.objs[rootIndex]);
}

export function parseLolalyticsHtml(html: string): any {
  const match = html.match(/<script type="qwik\/json">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('LoLalytics no entrego estado SSR Qwik');
  const payload = JSON.parse(match[1]) as QwikPayload;
  const rootIndex = payload.objs.findIndex((item: any) =>
    item && typeof item === 'object' && item.header && item.summary && item.runes
  );
  if (rootIndex < 0) throw new Error('No se encontro el dataset del campeon en LoLalytics');
  return decodeQwik(payload, rootIndex);
}

function normalizeSlug(champName: string): string {
  const internalName = API_NAME_MAP[champName] || champName;
  return internalName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function championName(id: number): string {
  return CHAMPIONS_DB[id]?.name || `Unknown (${id})`;
}

function itemEntries(value: any): any[] {
  if (!Array.isArray(value)) return [];
  return value.map((tuple: any) => {
    if (!Array.isArray(tuple)) return null;
    const id = numberOf(tuple[0]);
    if (!id) return null;
    return {
      Id: id,
      id,
      winrate: percentage(tuple[1]),
      pickrate: percentage(tuple[2]),
      games: numberOf(tuple[3]),
      completionTime: numberOf(tuple[4]) || undefined
    };
  }).filter(Boolean);
}

function buildSets(value: any): any[] {
  if (!Array.isArray(value)) return [];
  return value.map((tuple: any) => {
    if (!Array.isArray(tuple)) return null;
    const itemIds = String(tuple[0]).split('_').map(numberOf).filter(Boolean);
    if (itemIds.length < 3) return null;
    return {
      itemIds,
      winrate: percentage(tuple[1]),
      pickrate: percentage(tuple[2]),
      games: numberOf(tuple[3])
    };
  }).filter(Boolean);
}

function runeOptions(stats: any): any[] {
  if (!stats || typeof stats !== 'object') return [];
  return Object.entries(stats).flatMap(([id, values]: [string, any]) => {
    if (!Array.isArray(values)) return [];
    const rows = values.filter((row: any) => Array.isArray(row));
    const row = [...rows].sort((a, b) => numberOf(b[2]) - numberOf(a[2]))[0];
    if (!row) return [];
    return [{
      Id: numberOf(id),
      id: numberOf(id),
      pickrate: percentage(row[0]),
      winrate: percentage(row[1]),
      games: numberOf(row[2])
    }];
  });
}

function buildRuneBuckets(stats: any, runeToStyle: Record<string, number>): any {
  const options = runeOptions(stats);
  const buckets: Record<string, any[]> = {
    primaryRuneId: [], primaryRuneId2: [], primaryRuneId3: [], primaryRuneId4: [], secondaryRuneId: [],
    perksStat1: [], perksStat2: [], perksStat3: []
  };

  for (const option of options) {
    const id = numberOf(option.Id);
    const style = numberOf(runeToStyle[String(id)]);
    const row = RUNE_ROWS[id];
    if (id >= 5000 && id < 6000) continue;
    if (!style || row === undefined) continue;
    buckets.secondaryRuneId.push(option);
    if (row === 0) buckets.primaryRuneId.push(option);
    else if (row === 1) buckets.primaryRuneId2.push(option);
    else if (row === 2) buckets.primaryRuneId3.push(option);
    else buckets.primaryRuneId4.push(option);
  }
  return buckets;
}

function buildRunePage(raw: any, runeToStyle: Record<string, number>): any | null {
  const set = raw?.runes?.set;
  if (!set || !Array.isArray(set.pri) || !Array.isArray(set.sec)) return null;
  const selections = [...set.pri, ...set.sec].map(numberOf).filter(Boolean);
  if (selections.length < 6) return null;
  const primaryStyleId = numberOf(runeToStyle[String(selections[0])]);
  const subStyleId = numberOf(runeToStyle[String(selections[4])]);
  if (!primaryStyleId || !subStyleId) return null;
  return {
    primaryStyleId,
    subStyleId,
    selections: selections.slice(0, 6),
    shards: Array.isArray(set.mod) ? set.mod.map(numberOf).filter(Boolean).slice(0, 3) : [],
    winrate: percentage(raw.runes.wr),
    games: numberOf(raw.runes.n)
  };
}

function buildSummaryItemEntries(value: any): any[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => {
    const id = numberOf(item?.id ?? item?.Id);
    if (!id) return null;
    return {
      Id: id,
      id,
      winrate: percentage(item?.wr ?? item?.winrate),
      pickrate: percentage(item?.pr ?? item?.pickrate),
      games: numberOf(item?.n ?? item?.games),
      completionTime: numberOf(item?.time) || undefined
    };
  }).filter(Boolean);
}
function buildMatchupRows(value: any): any[] {
  if (!Array.isArray(value)) return [];
  return value.map((tuple: StatTuple) => {
    if (!Array.isArray(tuple) || tuple.length < 6) return null;
    const id = numberOf(tuple[0]);
    const winratePercent = percentage(tuple[1]);
    const delta1 = numberOf(tuple[2]);
    const delta2 = numberOf(tuple[3]);
    const pickrate = percentage(tuple[4]);
    const games = numberOf(tuple[5]);
    return {
      championId: id,
      championName: championName(id),
      name: championName(id),
      winrate: winratePercent / 100,
      winratePercent,
      delta1,
      delta2,
      delta: delta1 / 100,
      pickrate,
      games,
      count: games,
      dominanceScore: delta1,
      laneTag: delta1 >= 0 ? 'Good Lane' : 'Bad Lane'
    };
  }).filter(Boolean);
}

function buildGameLengthCurve(data: any): any[] {
  const counts = data.sidebar?.time?.time || {};
  const wins = data.sidebar?.time?.timeWin || {};
  const total = Object.values(counts).reduce((sum: number, value: any) => sum + numberOf(value), 0);
  return GAME_TIME_LABELS.map((label, index) => {
    const key = String(index + 1);
    const games = numberOf(counts[key]);
    const winsInBucket = numberOf(wins[key]);
    return {
      bucket: label,
      label,
      games,
      pickrate: total > 0 ? (games / total) * 100 : 0,
      wins: winsInBucket,
      value: games > 0 ? (winsInBucket / games) * 100 : 50
    };
  });
}

function buildHistory(data: any): any {
  const graph = data.graph || {};
  const dates = Array.isArray(graph.dates) ? graph.dates : [];
  const tiers = ['all', 'diamond_plus', 'emerald', 'platinum', 'gold', 'silver', 'bronze', 'iron'];
  const byDate = dates.map((date: string, index: number) => {
    const row: Record<string, any> = { date };
    for (const tier of tiers) {
      row[tier] = {
        winrate: numberOf(graph.wr?.[tier]?.[index]),
        smoothedWinrate: numberOf(graph.wrs?.[tier]?.[index]),
        pickrate: numberOf(graph.pr?.[tier]?.[index]),
        games: numberOf(graph.n?.[tier]?.[index]),
        banrate: numberOf(graph.br?.[tier]?.[index])
      };
    }
    return row;
  });
  return { dates, byTier: graph, byDate };
}

function buildSkillData(data: any): any[] {
  const rows = Array.isArray(data.skill15) ? data.skill15 : [];
  return rows.map((tuple: any) => {
    if (!Array.isArray(tuple)) return null;
    return {
      order: String(tuple[0]),
      winrate: percentage(tuple[1]),
      pickrate: percentage(tuple[2]),
      games: numberOf(tuple[3])
    };
  }).filter(Boolean);
}

async function fetchTeamStats(slug: string, patch: string, lane: string, sessionId?: string): Promise<any> {
  const endpoint = 'https://a1.lolalytics.com/mega/?' + new URLSearchParams({
    ep: 'build-team', v: '1', patch, c: slug, lane,
    tier: 'emerald_plus', queue: 'ranked', region: 'all'
  }).toString();

  try {
    const response = await throttledAxiosGet(endpoint, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      timeout: 30000
    });
    if (response.data?.team) return response.data;
  } catch {
    // Se intenta una vez con el renderizador opcional si el host auxiliar rechaza la solicitud.
  }

  if (sessionId) {
    const response = await fetchWithFlareSolverr(endpoint, sessionId);
    const parsed = typeof response === 'string' ? JSON.parse(response) : response;
    if (parsed?.team) return parsed;
  }
  return null;
}

function normalizeTeamStats(teamData: any): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (const lane of LANE_NAMES) result[lane] = buildMatchupRows(teamData?.team?.[lane]);
  if (!result.utility?.length && result.support?.length) result.utility = result.support;
  return result;
}

export async function fetchLolalyticsChampionStats(
  champName: string,
  lane: string,
  _version: string,
  sessionId?: string
): Promise<any> {
  const laneName = lane.toLowerCase() === 'utility' ? 'support' : lane.toLowerCase();
  const slug = normalizeSlug(champName);
  const url = `https://lolalytics.com/lol/${slug}/build/?lane=${encodeURIComponent(laneName)}`;

  let html: string;
  try {
    const response = await throttledAxiosGet(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      timeout: 70000
    });
    html = response.data;
  } catch (error) {
    if (!sessionId) throw error;
    html = await fetchWithFlareSolverr(url, sessionId);
  }

  const data = parseLolalyticsHtml(html);
  const patch = String(data.header?.patch || _version);
  const runeToStyle = ((assetsMap as any).runeToStyle || {}) as Record<string, number>;
  const pages = [data.summary?.pick, data.summary?.win]
    .map(raw => buildRunePage(raw, runeToStyle))
    .filter(Boolean);
  const teamData = await fetchTeamStats(slug, patch, laneName, sessionId);
  const enemyMatchups: Record<string, any[]> = {};
  for (const currentLane of LANE_NAMES) enemyMatchups[currentLane] = buildMatchupRows(data.enemy?.[currentLane]);
  if (!enemyMatchups.utility?.length && enemyMatchups.support?.length) enemyMatchups.utility = enemyMatchups.support;

  const start = data.summary?.pick?.items?.start;
  const startItems = start?.set ? [{
    startItems: start.set.map(numberOf).filter(Boolean),
    winrate: percentage(start.wr),
    pickrate: 100,
    games: numberOf(start.n)
  }] : [];

  const summoners = Array.isArray(data.spells) ? data.spells.map((tuple: any) => {
    if (!Array.isArray(tuple)) return null;
    const ids = String(tuple[0]).split('_').map(numberOf).filter(Boolean);
    if (ids.length < 2) return null;
    return {
      summonerId1: ids[0], summonerId2: ids[1],
      winrate: percentage(tuple[1]), pickrate: percentage(tuple[2]), games: numberOf(tuple[3])
    };
  }).filter(Boolean) : [];

  const skills = buildSkillData(data);
  const result = {
    sourceMetadata: {
      source: 'lolalytics', url, patch,
      lane: data.header?.lane || laneName,
      tier: 'emerald_plus', rank: data.header?.tier, queue: data.header?.queue || 420,
      builtOnly: true,
      coverage: ['builds', 'runes', 'skills', 'history', 'game_length', 'counters', 'synergies']
    },
    header: data.header,
    history: buildHistory(data),
    enemyMatchups,
    allyMatchups: teamData ? normalizeTeamStats(teamData) : {},
    damageComposition: data.header?.damage || {},
    winrateByGameTime: buildGameLengthCurve(data),
    gameLengthDistribution: buildGameLengthCurve(data).map((row: any) => ({ bucket: row.bucket, pickrate: row.pickrate, games: row.games })),
    runes: { ...buildRuneBuckets(data.runes?.stats, runeToStyle), pages },
    startItems,
    boots: itemEntries(data.boots).map((entry: any) => ({ itemId: entry.id, ...entry })),
    coreBuilds: { coreItem3: buildSets(data.builtBootSet3) },
    itemSets: data.itemSets?.itemBootSet3 || {},
    items: {
      item1: itemEntries(data.item1), item2: itemEntries(data.item2), item3: itemEntries(data.item3 || data.item),
      item4: itemEntries(data.item4).length ? itemEntries(data.item4) : buildSummaryItemEntries(data.summary?.pick?.items?.item4), item5: itemEntries(data.item5).length ? itemEntries(data.item5) : buildSummaryItemEntries(data.summary?.pick?.items?.item5), item6: buildSummaryItemEntries(data.item6 || data.summary?.pick?.items?.item6),
      early: itemEntries(data.earlyItem), popular: itemEntries(data.popularItem), winning: itemEntries(data.winningItem)
    },
    summoners,
    skillPriority: data.summary?.pick?.skillpriority || null,
    skillOrders: { level6: data.skill6 || [], level10: data.skill10 || [], level15: data.skill15 || [] },
    skillLevelUp: skills
  };

  if (!result.coreBuilds.coreItem3.length || !result.runes.pages.length) {
    throw new Error('LoLalytics no entrego una build o pagina de runas valida');
  }
  return result;
}