// src/pages/api/live-game.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { scrapeOpggProfile } from '../../lib/services/opgg.service.js';
import { getNameFromId, getIdFromName } from '../../lib/engine/engine.js';
import { getActiveGame } from '../../lib/services/riot-api.service.js';
import { loadLiveMatchCache, saveLiveMatchCache } from '../../lib/services/liveMatchCache.service.js';

const ROLES_ORDER = ['TOP', 'JNG', 'MID', 'ADC', 'SUPP'];

export const GET: APIRoute = async ({ request }) => {
  const urlParams = new URL(request.url).searchParams;
  let puuid = urlParams.get('puuid') || '';
  const platform = urlParams.get('platform') || (typeof process !== 'undefined' && process.env?.RIOT_PLATFORM) || 'las';

  const lcu = getLockfileData();
  let participantsRaw: any[] = [];
  let gameMode = 'RANKED SOLO/DUO';

  // 1. Intentar consultar el Puerto Local 2999 (Live Client Data directo de League of Legends.exe)
  try {
    const p2999Res = await fetch('https://127.0.0.1:2999/liveclientdata/playerlist');
    if (p2999Res.ok) {
      const players = await p2999Res.json();
      if (Array.isArray(players) && players.length > 0) {
        participantsRaw = players.map(p => ({
          summonerName: p.summonerName,
          gameName: p.summonerName.includes('#') ? p.summonerName.split('#')[0].trim() : p.summonerName,
          tagLine: p.summonerName.includes('#') ? p.summonerName.split('#')[1].trim() : 'LAS',
          championName: p.championName,
          teamId: p.team === 'ORDER' ? 100 : 200,
          assignedPosition: p.position || ''
        }));
      }
    }
  } catch (_e) {
    // 2999 port fallback
  }

  // 2. Si el puerto 2999 no devolvió datos, intentar obtener datos vía LCU lockfile (Gameflow/ChampSelect)
  if (participantsRaw.length === 0 && lcu) {
    try {
      const auth = btoa(`riot:${lcu.token}`);

      // Obtener invocador local para puuid de fallback si no se pasó
      if (!puuid) {
        const sumRes = await fetch(`https://127.0.0.1:${lcu.port}/lol-summoner/v1/current-summoner`, {
          headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
        });
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          puuid = sumData.puuid || '';
        }
      }

      // Intentar obtener sesión de Gameflow (Pantalla de Carga / In-Game)
      const gfRes = await fetch(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
      });

      if (gfRes.ok) {
        const gfData = await gfRes.json();
        gameMode = gfData.gameData?.queue?.gameMode || 'RANKED';
        const teamOne = gfData.gameData?.teamOne || [];
        const teamTwo = gfData.gameData?.teamTwo || [];
        const selections = gfData.gameData?.playerChampionSelections || [];

        if (teamOne.length > 0 || teamTwo.length > 0) {
          participantsRaw = [
            ...teamOne.map((p: any) => ({ ...p, teamId: 100 })),
            ...teamTwo.map((p: any) => ({ ...p, teamId: 200 }))
          ];
        } else if (selections.length > 0) {
          participantsRaw = selections.map((p: any, idx: number) => ({
            ...p,
            teamId: idx < 5 ? 100 : 200
          }));
        }
      }

      // Si no hay datos en Gameflow, intentar Selección de Campeones (ChampSelect)
      if (participantsRaw.length === 0) {
        const draftRes = await fetch(`https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`, {
          headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
        });
        if (draftRes.ok) {
          const draftData = await draftRes.json();
          if (draftData.myTeam && draftData.myTeam.length > 0) {
            const myTeam = (draftData.myTeam || []).map((p: any) => ({ ...p, teamId: 100 }));
            const theirTeam = (draftData.theirTeam || []).map((p: any) => ({ ...p, teamId: 200 }));
            participantsRaw = [...myTeam, ...theirTeam];
          }
        }
      }
    } catch (e) {
      console.warn('[LiveGame API] Error al obtener participantes del LCU local:', e);
    }
  }

  // 3. Fallback a Spectator API si LCU local no retornó participantes pero tenemos puuid
  if (participantsRaw.length === 0 && puuid) {
    const spectatorGame = await getActiveGame(puuid, platform);
    if (spectatorGame && spectatorGame.participants) {
      participantsRaw = spectatorGame.participants;
      gameMode = spectatorGame.gameMode || 'RANKED';
    }
  }

  if (participantsRaw.length === 0) {
    return new Response(
      JSON.stringify({
        active: false,
        message: 'No se encontraron datos de partida en vivo.'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Generar huella (fingerprint) única de la partida
  const matchFingerprint = participantsRaw
    .map(p => `${p.puuid || p.summonerId || p.summonerName || p.gameName || ''}_${p.championId || p.championPickIntent || 0}_${p.teamId || 100}`)
    .sort()
    .join('|');

  // 1. Si los datos ya fueron scrapeados para esta partida (isScraped === 1), retornar directo desde JSON
  const cachedMatch = loadLiveMatchCache();
  if (cachedMatch && cachedMatch.isScraped === 1 && cachedMatch.matchFingerprint === matchFingerprint) {
    return new Response(
      JSON.stringify({
        active: true,
        gameMode: cachedMatch.gameMode,
        blueTeam: cachedMatch.blueTeam,
        redTeam: cachedMatch.redTeam,
        myTeam: cachedMatch.blueTeam,
        theirTeam: cachedMatch.redTeam,
        fromCache: true
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Procesar participantes con opgg.service.ts
  const blueTeamRaw = participantsRaw.filter(p => p.teamId === 100);
  const redTeamRaw = participantsRaw.filter(p => p.teamId === 200);

  const auth = lcu ? btoa(`riot:${lcu.token}`) : '';

  const processParticipant = async (p: any, indexInTeam: number) => {
    let rawName = p.gameName || p.summonerName || p.displayName || '';
    let rawTag = p.tagLine || p.riotIdTag || '';

    if (rawName.includes('#')) {
      const parts = rawName.split('#');
      rawName = parts[0].trim();
      rawTag = parts[1].trim();
    }

    if (!rawName && p.riotId && p.riotId.includes('#')) {
      const parts = p.riotId.split('#');
      rawName = parts[0].trim();
      rawTag = parts[1].trim();
    }

    // Si el nombre devuelto es vago o genérico (ej. "Invocador 1"), intentar resolver el Invocador real vía LCU
    const isGenericPlaceholder = !rawName || rawName.toLowerCase().startsWith('invocador') || rawName.toLowerCase().startsWith('summoner');

    let lcuProfileIconId = p.profileIconId || 0;

    if (isGenericPlaceholder && lcu && (p.summonerId || p.puuid)) {
      try {
        const endpoint = p.puuid
          ? `https://127.0.0.1:${lcu.port}/lol-summoner/v2/summoners/puuid/${p.puuid}`
          : `https://127.0.0.1:${lcu.port}/lol-summoner/v1/summoners/${p.summonerId}`;

        const res = await fetch(endpoint, {
          headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
        });

        if (res.ok) {
          const sum = await res.json();
          if (sum.gameName) rawName = sum.gameName;
          if (sum.tagLine) rawTag = sum.tagLine;
          if (sum.profileIconId) lcuProfileIconId = sum.profileIconId;
          if (!rawName && sum.displayName && !sum.displayName.toLowerCase().startsWith('invocador')) {
            rawName = sum.displayName;
          }
        }
      } catch (e) {
        console.warn('[LiveGame] Error resolviendo invocador en LCU:', e);
      }
    }

    if (!rawTag) rawTag = 'LAS';

    let championId = p.championId || p.championPickIntent || 0;
    if (!championId && p.championName) {
      championId = getIdFromName(p.championName);
    }
    const championName = getNameFromId(championId) || p.championName || `Champion_${championId}`;

    const role = p.assignedPosition && p.assignedPosition.trim() !== '' && p.assignedPosition !== 'none'
      ? p.assignedPosition.toUpperCase()
      : ROLES_ORDER[indexInTeam % 5];

    // Extraer perfil y etiquetas vía OP.GG Scraper Service v2
    const profile = await scrapeOpggProfile(rawName, rawTag, platform, championId);

    return {
      ...profile,
      profileIconId: lcuProfileIconId || profile.profileIconId || 29,
      teamId: p.teamId,
      championId,
      championName,
      role
    };
  };

  const ROLE_SORT: Record<string, number> = {
    'TOP': 1, 'JNG': 2, 'JUNGLE': 2, 'MID': 3, 'MIDDLE': 3, 'ADC': 4, 'BOTTOM': 4, 'BOT': 4, 'SUPP': 5, 'SUPPORT': 5, 'UTILITY': 5
  };

  const sortByRole = (team: any[]) => {
    return [...team].sort((a, b) => {
      const orderA = ROLE_SORT[a.role?.toUpperCase()] || 99;
      const orderB = ROLE_SORT[b.role?.toUpperCase()] || 99;
      return orderA - orderB;
    });
  };

  const [blueTeamUnsorted, redTeamUnsorted] = await Promise.all([
    Promise.all(blueTeamRaw.map((p, idx) => processParticipant(p, idx))),
    Promise.all(redTeamRaw.map((p, idx) => processParticipant(p, idx)))
  ]);

  const blueTeam = sortByRole(blueTeamUnsorted);
  const redTeam = sortByRole(redTeamUnsorted);

  // Guardar en JSON persistente marcando flag isScraped = 1
  saveLiveMatchCache({
    isScraped: 1,
    matchFingerprint,
    gameMode,
    blueTeam,
    redTeam
  });

  return new Response(
    JSON.stringify({
      active: true,
      gameMode,
      blueTeam,
      redTeam,
      myTeam: blueTeam,
      theirTeam: redTeam
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};