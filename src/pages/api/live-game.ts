// src/pages/api/live-game.ts
import type { APIRoute } from 'astro';
import { getLockfileData, readLcuProfileCache } from '../../lib/services/lcu.service.js';
import {
  getActiveGame,
  getRankedEntries,
  getTopMastery,
  getMatchIdsToday,
  getMatchDetail,
  getPuuidByRiotId
} from '../../lib/services/riot-api.service.js';
import { getCachedPlayer, setCachedPlayer, getCachedMatch, setCachedMatch } from '../../lib/services/riot-cache.service.js';
import { computeTodayRecord } from '../../lib/engine/streakEngine.js';
import { getNameFromId } from '../../lib/engine/engine.js';

const ROLES_ORDER = ['TOP', 'JNG', 'MID', 'ADC', 'SUPP'];

function getMidnightTodayMs(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

export const GET: APIRoute = async ({ request }) => {
  const urlParams = new URL(request.url).searchParams;
  let puuid = urlParams.get('puuid') || '';
  const platform = urlParams.get('platform') || (typeof process !== 'undefined' && process.env?.RIOT_PLATFORM) || (import.meta.env?.RIOT_PLATFORM as string) || 'la2';

  const lcu = getLockfileData();
  let summonerName = '';

  if (!puuid && lcu) {
    try {
      const auth = btoa(`riot:${lcu.token}`);
      const response = await fetch(
        `https://127.0.0.1:${lcu.port}/lol-summoner/v1/current-summoner`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        puuid = data.puuid;
        summonerName = data.gameName ? `${data.gameName}#${data.tagLine}` : data.displayName;
      }
    } catch (e) {
      console.warn('[LiveGame] Error al obtener el invocador de LCU:', e);
    }
  }

  if (!puuid) {
    const cachedProfile = readLcuProfileCache();
    if (cachedProfile) {
      puuid = cachedProfile.puuid || (cachedProfile.summonerProfile && cachedProfile.summonerProfile.puuid) || '';
      summonerName = cachedProfile.summoner || (cachedProfile.summonerProfile && cachedProfile.summonerProfile.summoner) || '';
    }
  }

  if (summonerName && summonerName.includes('#')) {
    const [gName, tag] = summonerName.split('#');
    if (gName && tag) {
      const acc = await getPuuidByRiotId(gName, tag, platform);
      if (acc?.puuid) {
        puuid = acc.puuid;
      }
    }
  }

  if (!puuid) {
    return new Response(
      JSON.stringify({
        active: false,
        error: 'No se pudo identificar el PUUID del invocador local.'
      }),
      { status: 200 }
    );
  }

  // 1. Obtener la partida activa de Spectator-V5
  const spectatorGame = await getActiveGame(puuid, platform);

  if (!spectatorGame || !spectatorGame.participants) {
    return new Response(
      JSON.stringify({
        active: false,
        message: 'El invocador no se encuentra en partida activa.'
      }),
      { status: 200 }
    );
  }

  const startTimeToday = getMidnightTodayMs();

  // 2. Procesar los 10 participantes en paralelo respetando caché local
  const blueTeamRaw = spectatorGame.participants.filter(p => p.teamId === 100);
  const redTeamRaw = spectatorGame.participants.filter(p => p.teamId === 200);

  const processParticipant = async (p: any, indexInTeam: number) => {
    const playerPuuid = p.puuid;
    const championId = p.championId;
    const championName = getNameFromId(championId) || `Champion_${championId}`;
    const role = ROLES_ORDER[indexInTeam % 5];

    // Intentar recuperar de caché local
    const cached = getCachedPlayer(playerPuuid);
    if (cached) {
      return {
        ...cached,
        puuid: playerPuuid,
        teamId: p.teamId,
        championId,
        championName,
        spell1Id: p.spell1Id,
        spell2Id: p.spell2Id,
        keystoneId: p.perks?.perkIds?.[0] || 0,
        secondaryStyleId: p.perks?.perkSubStyle || 0,
        role
      };
    }

    // Si no está en caché, consultar Riot API
    let rankedInfo = {
      tier: 'UNRANKED',
      division: '',
      lp: 0,
      wins: 0,
      losses: 0,
      winrate: 0
    };
    let topMasteryList: any[] = [];
    let todayRecord = {
      wins: 0,
      losses: 0,
      winrate: 0,
      streak: { type: null as 'win' | 'loss' | null, count: 0 }
    };

    try {
      const [rankedEntries, mastery] = await Promise.all([
        getRankedEntries(playerPuuid, platform),
        getTopMastery(playerPuuid, 4, platform)
      ]);

      if (rankedEntries && Array.isArray(rankedEntries)) {
        const soloQ = rankedEntries.find((r: any) => r.queueType === 'RANKED_SOLO_5x5');
        if (soloQ) {
          const totalGames = (soloQ.wins || 0) + (soloQ.losses || 0);
          rankedInfo = {
            tier: soloQ.tier || 'UNRANKED',
            division: soloQ.rank || (soloQ as any).division || '',
            lp: soloQ.leaguePoints || 0,
            wins: soloQ.wins || 0,
            losses: soloQ.losses || 0,
            winrate: totalGames > 0 ? Math.round((soloQ.wins / totalGames) * 100) : 0
          };
        }
      }

      topMasteryList = mastery || [];

      // Historial de partidas de hoy
      const matchIds = await getMatchIdsToday(playerPuuid, startTimeToday, platform);
      if (matchIds && matchIds.length > 0) {
        const matchDetails = await Promise.all(
          matchIds.map(async mId => {
            const cachedM = getCachedMatch(mId);
            if (cachedM) return cachedM;

            const detail = await getMatchDetail(mId, playerPuuid, platform);
            if (detail) {
              setCachedMatch(mId, detail);
            }
            return detail;
          })
        );

        const validMatches = matchDetails.filter(Boolean);
        todayRecord = computeTodayRecord(validMatches);
      }
    } catch (e) {
      console.warn(`[LiveGame] Error al procesar participante ${playerPuuid}:`, e);
    }

    const isMain = topMasteryList.some((m: any) => m.championId === championId);

    const compiledData = {
      puuid: playerPuuid,
      riotId: p.riotId || p.summonerId || 'Invocador',
      ranked: rankedInfo,
      topMastery: topMasteryList,
      isMain,
      todayRecord
    };

    // Guardar en caché local de jugadores
    setCachedPlayer(playerPuuid, compiledData);

    return {
      ...compiledData,
      teamId: p.teamId,
      championId,
      championName,
      spell1Id: p.spell1Id,
      spell2Id: p.spell2Id,
      keystoneId: p.perks?.perkIds?.[0] || 0,
      secondaryStyleId: p.perks?.perkSubStyle || 0,
      role
    };
  };

  const [blueTeam, redTeam] = await Promise.all([
    Promise.all(blueTeamRaw.map((p, idx) => processParticipant(p, idx))),
    Promise.all(redTeamRaw.map((p, idx) => processParticipant(p, idx)))
  ]);

  return new Response(
    JSON.stringify({
      active: true,
      gameId: spectatorGame.gameId,
      gameMode: spectatorGame.gameMode,
      mapId: spectatorGame.mapId,
      blueTeam,
      redTeam
    }),
    { status: 200 }
  );
};
