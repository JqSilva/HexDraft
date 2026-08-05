// src/lib/services/riot-api.service.ts

const DEFAULT_PLATFORM = (typeof process !== 'undefined' && process.env?.RIOT_PLATFORM) || (import.meta.env?.RIOT_PLATFORM as string) || 'la1';

/**
 * Mapea la plataforma (ej. la1, na1, euw1) a su región continental (americas, europe, asia, sea)
 * requerida por endpoints como Match-V5.
 */
export function getMatchRegionFromPlatform(platform: string): string {
  const plat = platform.toLowerCase();
  if (['la1', 'la2', 'na1', 'br1'].includes(plat)) {
    return 'americas';
  }
  if (['euw1', 'eun1', 'tr1', 'ru'].includes(plat)) {
    return 'europe';
  }
  if (['kr', 'jp1'].includes(plat)) {
    return 'asia';
  }
  if (['oc1', 'ph2', 'sg2', 'th2', 'tw2', 'vn2'].includes(plat)) {
    return 'sea';
  }
  return 'americas';
}

function getRiotApiKey(): string {
  const key = (typeof process !== 'undefined' && process.env?.RIOT_API_KEY) || (import.meta.env?.RIOT_API_KEY as string) || '';
  if (!key) {
    console.warn('[RiotAPI] Advertencia: RIOT_API_KEY no esta configurada en las variables de entorno.');
  }
  return key;
}

async function riotFetch<T>(url: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const apiKey = getRiotApiKey();
  if (!apiKey) {
    return { ok: false, status: 401, data: null };
  }

  try {
    const res = await fetch(url, {
      headers: {
        'X-Riot-Token': apiKey,
        'Accept': 'application/json'
      }
    });

    if (res.status === 404) {
      return { ok: false, status: 404, data: null };
    }

    if (!res.ok) {
      console.error(`[RiotAPI] Error HTTP ${res.status} al solicitar ${url}`);
      return { ok: false, status: res.status, data: null };
    }

    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (error) {
    console.error(`[RiotAPI] Excepcion al conectar con ${url}:`, error);
    return { ok: false, status: 500, data: null };
  }
}

export interface SpectatorGameInfo {
  gameId: number;
  mapId: number;
  gameMode: string;
  gameType: string;
  gameQueueConfigId: number;
  participants: Array<{
    puuid: string;
    teamId: number; // 100 para azul, 200 para rojo
    spell1Id: number;
    spell2Id: number;
    championId: number;
    profileIconId: number;
    riotId?: string;
    summonerId?: string;
    perks?: {
      perkIds: number[];
      perkStyle: number;
      perkSubStyle: number;
    };
  }>;
}

export interface RankedEntry {
  leagueId: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
}

export interface ChampionMastery {
  puuid: string;
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
}

export interface MatchSummary {
  matchId: string;
  gameCreation: number;
  gameDuration: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  championId: number;
}

export interface AccountInfo {
  puuid: string;
  gameName: string;
  tagLine: string;
}

/**
 * Account-V1: Obtiene la cuenta y PUUID global oficial de Riot Games por GameName y TagLine (ej. Frikz #xoro).
 */
export async function getPuuidByRiotId(
  gameName: string,
  tagLine: string,
  platform: string = DEFAULT_PLATFORM
): Promise<AccountInfo | null> {
  const region = getMatchRegionFromPlatform(platform);
  const encodedName = encodeURIComponent(gameName.trim());
  const encodedTag = encodeURIComponent(tagLine.trim().replace(/^#/, ''));
  const url = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`;
  const res = await riotFetch<AccountInfo>(url);
  return res.data;
}

/**
 * Spectator-V5: Obtiene la partida activa de un jugador por su PUUID.
 */
export async function getActiveGame(
  puuid: string,
  platform: string = DEFAULT_PLATFORM
): Promise<SpectatorGameInfo | null> {
  const url = `https://${platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`;
  const res = await riotFetch<SpectatorGameInfo>(url);
  return res.data;
}

/**
 * League-V4: Obtiene las entradas clasificatorias de un jugador por su PUUID (con fallback a Summoner-V4).
 */
export async function getRankedEntries(
  puuid: string,
  platform: string = DEFAULT_PLATFORM
): Promise<RankedEntry[]> {
  // 1. Intentar endpoint directo por PUUID (moderno)
  const urlPuuid = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
  const resPuuid = await riotFetch<RankedEntry[]>(urlPuuid);
  if (resPuuid.ok && Array.isArray(resPuuid.data) && resPuuid.data.length > 0) {
    return resPuuid.data;
  }

  // 2. Fallback: Obtener Summoner-V4 por PUUID para sacar el encryptedSummonerId
  const urlSummoner = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const resSummoner = await riotFetch<any>(urlSummoner);
  if (resSummoner.ok && resSummoner.data?.id) {
    const summonerId = resSummoner.data.id;
    const urlBySummoner = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
    const resBySummoner = await riotFetch<RankedEntry[]>(urlBySummoner);
    if (resBySummoner.ok && Array.isArray(resBySummoner.data)) {
      return resBySummoner.data;
    }
  }

  return resPuuid.data || [];
}

/**
 * Mastery-V4: Obtiene los campeones con mayor maestria de un jugador por su PUUID.
 */
export async function getTopMastery(
  puuid: string,
  count: number = 3,
  platform: string = DEFAULT_PLATFORM
): Promise<ChampionMastery[]> {
  const url = `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`;
  const res = await riotFetch<ChampionMastery[]>(url);
  if (res.ok && Array.isArray(res.data)) {
    return res.data;
  }
  return [];
}

/**
 * Match-V5: Obtiene los IDs de las partidas jugadas hoy desde startTime.
 */
export async function getMatchIdsToday(
  puuid: string,
  startTime: number,
  platform: string = DEFAULT_PLATFORM
): Promise<string[]> {
  const region = getMatchRegionFromPlatform(platform);
  // startTime en Riot API debe estar en segundos Epoch UNIX
  const startTimeSec = Math.floor(startTime / 1000);
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?startTime=${startTimeSec}&type=ranked&count=20`;
  const res = await riotFetch<string[]>(url);
  if (res.ok && Array.isArray(res.data)) {
    return res.data;
  }
  return [];
}

/**
 * Match-V5: Obtiene el detalle simplificado de una partida por matchId para un jugador especifico.
 */
export async function getMatchDetail(
  matchId: string,
  targetPuuid: string,
  platform: string = DEFAULT_PLATFORM
): Promise<MatchSummary | null> {
  const region = getMatchRegionFromPlatform(platform);
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  const res = await riotFetch<any>(url);

  if (!res.ok || !res.data || !res.data.info) {
    return null;
  }

  const info = res.data.info;
  const participant = info.participants?.find((p: any) => p.puuid === targetPuuid);

  if (!participant) {
    return null;
  }

  return {
    matchId,
    gameCreation: info.gameCreation,
    gameDuration: info.gameDuration,
    win: Boolean(participant.win),
    kills: participant.kills || 0,
    deaths: participant.deaths || 0,
    assists: participant.assists || 0,
    championId: participant.championId || 0
  };
}
