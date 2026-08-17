// src/pages/api/live-game.ts
import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { scrapeOpggProfile } from '../../lib/services/opgg.service.js';
import { getNameFromId, getIdFromName } from '../../lib/engine/engine.js';
import { getActiveGame } from '../../lib/services/riot-api.service.js';
import { loadLiveMatchCache, saveLiveMatchCache } from '../../lib/services/liveMatchCache.service.js';

// TODO DEBUG: remover este logging una vez diagnosticado el bug de loading screen
const LOG_PATH = path.resolve(process.cwd(), 'logs', 'loading-screen-debug.log');

function ensureLogDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function logPoll(entry: Record<string, any>) {
  try {
    ensureLogDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), source: 'live-game', ...entry });
    fs.appendFileSync(LOG_PATH, line + '\n');
    console.log('[LIVE-GAME-DEBUG]', line);
  } catch (err) {
    console.error('[LIVE-GAME-DEBUG-ERROR]', err);
  }
}

function buildMatchFingerprint(participants: any[], localPuuid?: string): string {
  const getChampId = (p: any): number => {
    if (p.championId && p.championId > 0) return p.championId;
    if (p.championPickIntent && p.championPickIntent > 0) return p.championPickIntent;
    if (p.championName) return getIdFromName(p.championName) || 0;
    return 0;
  };

  const blueChamps = participants
    .filter(p => p.teamId === 100)
    .map(getChampId)
    .sort((a, b) => a - b)
    .join(',');

  const redChamps = participants
    .filter(p => p.teamId === 200)
    .map(getChampId)
    .sort((a, b) => a - b)
    .join(',');

  const prefix = localPuuid ? `p_${localPuuid}_` : '';
  return `${prefix}b[${blueChamps}]_r[${redChamps}]`;
}

const ROLES_ORDER = ['TOP', 'JNG', 'MID', 'ADC', 'SUPP'];

export const GET: APIRoute = async ({ request }) => {
  const urlParams = new URL(request.url).searchParams;
  let puuid = urlParams.get('puuid') || '';
  const platform = urlParams.get('platform') || (typeof process !== 'undefined' && process.env?.RIOT_PLATFORM) || 'las';

  const lcu = getLockfileData();
  let participantsRaw: any[] = [];
  let gameMode = 'RANKED SOLO/DUO';

  // 1. Intentar consultar el Puerto Local 2999 (Live Client Data directo de League of Legends.exe)
  const p2999Start = Date.now();
  try {
    const p2999Res = await fetch('https://127.0.0.1:2999/liveclientdata/playerlist');
    const elapsedMs = Date.now() - p2999Start;
    if (p2999Res.ok) {
      const players = await p2999Res.json();
      if (Array.isArray(players) && players.length > 0) {
        participantsRaw = players.map(p => {
          const champId = getIdFromName(p.championName) || 0;
          return {
            summonerName: p.summonerName,
            gameName: p.summonerName.includes('#') ? p.summonerName.split('#')[0].trim() : p.summonerName,
            tagLine: p.summonerName.includes('#') ? p.summonerName.split('#')[1].trim() : 'LAS',
            championName: p.championName,
            championId: champId,
            teamId: p.team === 'ORDER' ? 100 : 200,
            assignedPosition: p.position || ''
          };
        });

        logPoll({
          step: 'port_2999',
          outcome: 'success',
          httpStatus: p2999Res.status,
          elapsedMs,
          participantsCount: participantsRaw.length,
          championNames: participantsRaw.map(p => p.championName).filter(Boolean)
        });
      } else {
        logPoll({
          step: 'port_2999',
          outcome: 'empty_players_array',
          httpStatus: p2999Res.status,
          elapsedMs
        });
      }
    } else {
      logPoll({
        step: 'port_2999',
        outcome: 'http_error',
        httpStatus: p2999Res.status,
        elapsedMs
      });
    }
  } catch (e: any) {
    const elapsedMs = Date.now() - p2999Start;
    logPoll({
      step: 'port_2999',
      outcome: 'fetch_failed_falling_back',
      errorName: e?.name,
      errorMessage: e?.message,
      elapsedMs
    });
  }

  // 2. Si el puerto 2999 no devolvió datos, intentar obtener datos vía LCU lockfile (Gameflow/ChampSelect)
  if (participantsRaw.length === 0 && lcu) {
    const lcuStart = Date.now();
    try {
      const auth = btoa(`riot:${lcu.token}`);

      // Obtener invocador local para puuid de fallback si no se pasó
      if (!puuid) {
        const sumStart = Date.now();
        const sumRes = await fetch(`https://127.0.0.1:${lcu.port}/lol-summoner/v1/current-summoner`, {
          headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
        });
        const sumElapsedMs = Date.now() - sumStart;
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          puuid = sumData.puuid || '';
          logPoll({
            step: 'lcu_current_summoner',
            outcome: 'success',
            elapsedMs: sumElapsedMs,
            puuidFound: Boolean(puuid),
            displayName: sumData.displayName || sumData.gameName
          });
        } else {
          logPoll({
            step: 'lcu_current_summoner',
            outcome: 'http_error',
            httpStatus: sumRes.status,
            elapsedMs: sumElapsedMs
          });
        }
      }

      let gameflowPhase = 'unknown';
      let gameflowParticipants: any[] = [];
      let champSelectParticipants: any[] = [];

      // Intentar obtener sesión de Gameflow (Pantalla de Carga / In-Game)
      const gfStart = Date.now();
      const gfRes = await fetch(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
      });
      const gfElapsedMs = Date.now() - gfStart;

      if (gfRes.ok) {
        const gfData = await gfRes.json();
        gameflowPhase = gfData.phase || 'None';
        gameMode = gfData.gameData?.queue?.gameMode || 'RANKED';
        const teamOne = gfData.gameData?.teamOne || [];
        const teamTwo = gfData.gameData?.teamTwo || [];
        const selections = gfData.gameData?.playerChampionSelections || [];

        if (teamOne.length > 0 || teamTwo.length > 0) {
          gameflowParticipants = [
            ...teamOne.map((p: any) => ({ ...p, teamId: 100 })),
            ...teamTwo.map((p: any) => ({ ...p, teamId: 200 }))
          ];
        } else if (selections.length > 0) {
          gameflowParticipants = selections.map((p: any, idx: number) => ({
            ...p,
            teamId: idx < 5 ? 100 : 200
          }));
        }

        logPoll({
          step: 'lcu_gameflow_session',
          outcome: gameflowParticipants.length > 0 ? 'success' : 'no_participants_in_gameflow',
          phase: gameflowPhase,
          gameMode,
          elapsedMs: gfElapsedMs,
          participantsCount: gameflowParticipants.length,
          championIds: gameflowParticipants.map((p: any) => p.championId || 0)
        });

        if (gameflowParticipants.length > 0) {
          participantsRaw = gameflowParticipants;
        }
      } else {
        logPoll({
          step: 'lcu_gameflow_session',
          outcome: 'http_error',
          httpStatus: gfRes.status,
          elapsedMs: gfElapsedMs
        });
      }

      // Si no hay datos en Gameflow o para verificar coherencia
      const csStart = Date.now();
      const draftRes = await fetch(`https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
      });
      const csElapsedMs = Date.now() - csStart;

      if (draftRes.ok) {
        const draftData = await draftRes.json();
        if (draftData.myTeam && draftData.myTeam.length > 0) {
          const myTeam = (draftData.myTeam || []).map((p: any) => ({ ...p, teamId: 100 }));
          const theirTeam = (draftData.theirTeam || []).map((p: any) => ({ ...p, teamId: 200 }));
          champSelectParticipants = [...myTeam, ...theirTeam];

          logPoll({
            step: 'lcu_champ_select_session',
            outcome: 'success',
            elapsedMs: csElapsedMs,
            participantsCount: champSelectParticipants.length,
            championIds: champSelectParticipants.map((p: any) => p.championId || p.championPickIntent || 0)
          });
        }
      } else {
        logPoll({
          step: 'lcu_champ_select_session',
          outcome: 'http_error',
          httpStatus: draftRes.status,
          elapsedMs: csElapsedMs
        });
      }

      // Verificar si hay discrepancias entre los fallbacks (mismatch)
      if (gameflowParticipants.length > 0 && champSelectParticipants.length > 0) {
        const gfChamps = gameflowParticipants.map((p: any) => p.championId || 0).sort().join(',');
        const csChamps = champSelectParticipants.map((p: any) => p.championId || p.championPickIntent || 0).sort().join(',');
        if (gfChamps !== csChamps) {
          logPoll({
            outcome: 'fallback_data_mismatch',
            sourceA: 'gameflow_session',
            sourceB: 'champ_select_session',
            gameflowPhase,
            gameflowChampionIds: gfChamps,
            champSelectChampionIds: csChamps
          });
        }
      }

      if (participantsRaw.length === 0 && champSelectParticipants.length > 0) {
        participantsRaw = champSelectParticipants;
      }
    } catch (e: any) {
      logPoll({
        step: 'lcu_fallbacks',
        outcome: 'error',
        errorName: e?.name,
        errorMessage: e?.message,
        elapsedMs: Date.now() - lcuStart
      });
      console.warn('[LiveGame API] Error al obtener participantes del LCU local:', e);
    }
  }

  // 3. Fallback a Spectator API si LCU local no retornó participantes pero tenemos puuid
  if (participantsRaw.length === 0 && puuid) {
    const specStart = Date.now();
    try {
      const spectatorGame = await getActiveGame(puuid, platform);
      const specElapsedMs = Date.now() - specStart;
      if (spectatorGame && spectatorGame.participants) {
        participantsRaw = spectatorGame.participants;
        gameMode = spectatorGame.gameMode || 'RANKED';
        logPoll({
          step: 'spectator_api',
          outcome: 'success',
          elapsedMs: specElapsedMs,
          participantsCount: participantsRaw.length
        });
      } else {
        logPoll({
          step: 'spectator_api',
          outcome: 'no_game_found',
          elapsedMs: specElapsedMs
        });
      }
    } catch (e: any) {
      logPoll({
        step: 'spectator_api',
        outcome: 'error',
        errorName: e?.name,
        errorMessage: e?.message,
        elapsedMs: Date.now() - specStart
      });
    }
  }

  if (participantsRaw.length === 0) {
    logPoll({
      outcome: 'no_participants_found_final',
      active: false
    });
    return new Response(
      JSON.stringify({
        active: false,
        message: 'No se encontraron datos de partida en vivo.'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Generar huella (fingerprint) única y unificada de la partida basada en campeones y equipos
  const matchFingerprint = buildMatchFingerprint(participantsRaw, puuid);

  // 1. Si los datos ya fueron scrapeados para esta partida (isScraped === 1), retornar directo desde JSON
  const cachedMatch = loadLiveMatchCache();
  if (cachedMatch && cachedMatch.isScraped === 1 && cachedMatch.matchFingerprint === matchFingerprint) {
    logPoll({
      outcome: 'served_from_cache',
      matchFingerprint,
      gameMode: cachedMatch.gameMode
    });
    return new Response(
      JSON.stringify({
        active: true,
        gameMode: cachedMatch.gameMode,
        blueTeam: cachedMatch.blueTeam,
        redTeam: cachedMatch.redTeam,
        myTeam: cachedMatch.blueTeam,
        theirTeam: cachedMatch.redTeam,
        fromCache: true,
        isPartial: false
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

  const isGeneric = (name?: string) => {
    if (!name || name.trim() === '') return true;
    const lower = name.toLowerCase().trim();
    return lower.startsWith('invocador') || lower.startsWith('summoner') || lower.startsWith('champion_');
  };

  const hasRealPlayerNames = blueTeam.some(p => !isGeneric(p.gameName || p.summonerName)) ||
                             redTeam.some(p => !isGeneric(p.gameName || p.summonerName));

  if (hasRealPlayerNames) {
    // Guardar en JSON persistente marcando flag isScraped = 1 (partida completamente identificada y scrapeada)
    saveLiveMatchCache({
      isScraped: 1,
      matchFingerprint,
      gameMode,
      blueTeam,
      redTeam
    });

    logPoll({
      outcome: 'scraped_and_ready',
      matchFingerprint,
      gameMode,
      blueCount: blueTeam.length,
      redCount: redTeam.length
    });
  } else {
    // Datos preliminares (ej. solo IDs de campeones desde Gameflow sin nombres de invocador).
    // No bloqueamos la caché con isScraped = 1 para permitir que en el siguiente poll del puerto 2999 se haga el scraping completo.
    logPoll({
      outcome: 'partial_ready_not_cached',
      matchFingerprint,
      gameMode,
      blueCount: blueTeam.length,
      redCount: redTeam.length
    });
  }

  return new Response(
    JSON.stringify({
      active: true,
      gameMode,
      blueTeam,
      redTeam,
      myTeam: blueTeam,
      theirTeam: redTeam,
      isPartial: !hasRealPlayerNames
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};