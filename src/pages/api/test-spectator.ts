// src/pages/api/test-spectator.ts
import type { APIRoute } from 'astro';
import { getLockfileData, readLcuProfileCache } from '../../lib/services/lcu.service.js';
import { getActiveGame, getRankedEntries, getTopMastery, getPuuidByRiotId } from '../../lib/services/riot-api.service.js';

export const GET: APIRoute = async ({ request }) => {
  const urlParams = new URL(request.url).searchParams;
  let puuid = urlParams.get('puuid') || '';

  const apiKey = (typeof process !== 'undefined' && process.env?.RIOT_API_KEY) || (import.meta.env?.RIOT_API_KEY as string) || '';
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'RIOT_API_KEY no esta configurada en el archivo .env',
        hint: 'Agrega RIOT_API_KEY="RGAPI-tu-key-aqui" en tu archivo .env'
      }),
      { status: 400 }
    );
  }

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
      console.error('Error obteniendo summoner local desde LCU:', e);
    }
  }

  if (!puuid) {
    const cached = readLcuProfileCache();
    if (cached) {
      puuid = cached.puuid || (cached.summonerProfile && cached.summonerProfile.puuid) || '';
      summonerName = cached.summoner || (cached.summonerProfile && cached.summonerProfile.summoner) || 'Caché local';
    }
  }

  if (!puuid) {
    return new Response(
      JSON.stringify({
        error: 'No se pudo obtener el PUUID del invocador local. Asegúrate de tener el cliente de League of Legends abierto o pasa ?puuid=TU_PUUID en la URL.'
      }),
      { status: 400 }
    );
  }

  const platform = urlParams.get('platform') || (typeof process !== 'undefined' && process.env?.RIOT_PLATFORM) || (import.meta.env?.RIOT_PLATFORM as string) || 'la1';
  let globalPuuid = puuid;
  let accountInfo = null;

  if (summonerName.includes('#')) {
    const [gName, tag] = summonerName.split('#');
    if (gName && tag) {
      accountInfo = await getPuuidByRiotId(gName, tag, platform);
      if (accountInfo?.puuid) {
        globalPuuid = accountInfo.puuid;
      }
    }
  }

  // Test Spectator-V5
  const spectatorData = await getActiveGame(globalPuuid, platform);
  
  // Test League-V4
  const rankedEntries = await getRankedEntries(globalPuuid, platform);
  
  // Test Mastery-V4
  const topMastery = await getTopMastery(globalPuuid, 3, platform);

  return new Response(
    JSON.stringify({
      status: 'ok',
      lcuPuuid: puuid,
      globalPuuid,
      summonerName,
      accountInfo,
      platform,
      spectatorData: spectatorData ? {
        gameId: spectatorData.gameId,
        gameMode: spectatorData.gameMode,
        participantsCount: spectatorData.participants?.length || 0,
        participants: spectatorData.participants?.map(p => ({
          puuid: p.puuid,
          championId: p.championId,
          teamId: p.teamId,
          spell1Id: p.spell1Id,
          spell2Id: p.spell2Id
        }))
      } : null,
      spectatorActive: Boolean(spectatorData),
      rankedEntries,
      topMastery
    }),
    { status: 200 }
  );
};
