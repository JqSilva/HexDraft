// src/pages/api/live-game.ts
import https from 'https';
import axios from 'axios';
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { scrapeOpggProfile } from '../../lib/services/opgg.service.js';
import { getNameFromId, getIdFromName } from '../../lib/engine/core/constants.js';
import { getActiveGame } from '../../lib/services/riot-api.service.js';
import { resolveSkinNumber } from '../../lib/services/skinResolver.service.js';
import { assignTeamRoles } from '../../lib/services/roleAssignment.service.js';
import { loadLiveMatchCache, saveLiveMatchCache } from '../../lib/services/liveMatchCache.service.js';

const liveClient = axios.create({
  baseURL: 'https://127.0.0.1:2999/liveclientdata',
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 1500
});

/**
 * Consulta el historial reciente del invocador local en el LCU y calcula el record
 * de victorias/derrotas y la racha activa UNICAMENTE para las partidas jugadas hoy.
 */
async function fetchLocalSessionRecord(lcu: any, localPuuid?: string): Promise<{
  wins: number;
  losses: number;
  totalGames: number;
  winrate: number | null;
  streak: {
    type: 'win' | 'loss' | null;
    count: number;
  };
} | null> {
  if (!lcu) return null;
  const auth = btoa(`riot:${lcu.token}`);

  try {
    const res = await fetch(`https://127.0.0.1:${lcu.port}/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=15`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) return null;
    const mhData = await res.json();
    const games = mhData?.games?.games;
    if (!Array.isArray(games) || games.length === 0) return null;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayEpoch = startOfDay.getTime();

    // Filtrar partidas jugadas hoy (hora local)
    const todayGames = games.filter((g: any) => {
      const creation = typeof g.gameCreation === 'number' ? g.gameCreation : (new Date(g.gameCreationDate || 0)).getTime();
      return creation >= startOfDayEpoch;
    });

    if (todayGames.length === 0) {
      return {
        wins: 0,
        losses: 0,
        totalGames: 0,
        winrate: null,
        streak: { type: null, count: 0 }
      };
    }

    let todayWins = 0;
    let todayLosses = 0;
    const todayOutcomes: boolean[] = [];

    todayGames.forEach((g: any) => {
      let participantId = 1;
      if (localPuuid && Array.isArray(g.participantIdentities)) {
        const idObj = g.participantIdentities.find((pid: any) => pid.player?.puuid === localPuuid);
        if (idObj) participantId = idObj.participantId;
      }

      const participant = Array.isArray(g.participants)
        ? g.participants.find((p: any) => p.participantId === participantId) || g.participants[0]
        : null;

      const isWin = Boolean(participant?.stats?.win);
      todayOutcomes.push(isWin);
      if (isWin) todayWins++;
      else todayLosses++;
    });

    const totalGames = todayWins + todayLosses;
    const todayWinrate = totalGames > 0 ? Math.round((todayWins / totalGames) * 100) : null;

    let streakType: 'win' | 'loss' | null = null;
    let streakCount = 0;
    if (todayOutcomes.length > 0) {
      const firstOutcome = todayOutcomes[0];
      for (const outcome of todayOutcomes) {
        if (outcome === firstOutcome) {
          streakCount++;
        } else {
          break;
        }
      }
      streakType = firstOutcome ? 'win' : 'loss';
    }

    return {
      wins: todayWins,
      losses: todayLosses,
      totalGames,
      winrate: todayWinrate,
      streak: {
        type: streakType,
        count: streakCount
      }
    };
  } catch (e) {
    console.warn('[LiveGame API] Error al calcular racha de sesión local vía LCU:', e);
    return null;
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

const SPELL_NAME_TO_ID: Record<string, number> = {
  "summonerboost": 1,
  "cleanse": 1,
  "summonerexhaust": 3,
  "exhaust": 3,
  "summonerflash": 4,
  "flash": 4,
  "summonerhaste": 6,
  "ghost": 6,
  "summonerheal": 7,
  "heal": 7,
  "summonersmite": 11,
  "smite": 11,
  "summonerteleport": 12,
  "teleport": 12,
  "summonerclarity": 13,
  "clarity": 13,
  "summonerdot": 14,
  "ignite": 14,
  "summonerbarrier": 21,
  "barrier": 21,
  "summonersnowball": 32,
  "snowball": 32,
  "mark": 32
};

function parseLiveClientSpellId(spellData: any): number | undefined {
  if (!spellData) return undefined;
  if (typeof spellData === 'number') return spellData;
  if (typeof spellData.id === 'number') return spellData.id;
  if (typeof spellData.id === 'string' && !isNaN(Number(spellData.id))) return Number(spellData.id);
  if (typeof spellData.spellId === 'number') return spellData.spellId;
  if (typeof spellData.summonerSpellId === 'number') return spellData.summonerSpellId;

  const raw = (
    spellData.rawDisplayName ||
    spellData.displayName ||
    spellData.rawDescription ||
    spellData.name ||
    (typeof spellData === 'string' ? spellData : '')
  ).toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const [key, id] of Object.entries(SPELL_NAME_TO_ID)) {
    if (raw.includes(key)) return id;
  }
  return undefined;
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
  try {
    const p2999Res = await liveClient.get('/playerlist');
    if (p2999Res.status === 200 && Array.isArray(p2999Res.data) && p2999Res.data.length > 0) {
      participantsRaw = p2999Res.data.map((p: any) => {
        const champId = getIdFromName(p.championName) || 0;
        const spell1Id = parseLiveClientSpellId(p.summonerSpells?.summonerSpellOne);
        const spell2Id = parseLiveClientSpellId(p.summonerSpells?.summonerSpellTwo);
        const keystoneId = p.runes?.keystone?.id || undefined;
        const secondaryStyleId = p.runes?.secondaryRuneTree?.id || undefined;

        return {
          summonerName: p.summonerName,
          gameName: p.summonerName.includes('#') ? p.summonerName.split('#')[0].trim() : p.summonerName,
          tagLine: p.summonerName.includes('#') ? p.summonerName.split('#')[1].trim() : 'LAS',
          championName: p.championName,
          championId: champId,
          skinId: p.skinID || p.skinId || 0,
          selectedSkinId: p.skinID || p.skinId || 0,
          teamId: p.team === 'ORDER' ? 100 : 200,
          assignedPosition: p.position || '',
          spell1Id,
          spell2Id,
          keystoneId,
          secondaryStyleId,
          summonerSpells: p.summonerSpells,
          runes: p.runes,
          rawPlayer: p
        };
      });
    }
  } catch (_e) {
    // 2999 port fallback
  }

  // 2. Consultar LCU lockfile para enriquecer o complementar participantes y skins
  if (lcu) {
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

      let gameflowParticipants: any[] = [];
      let champSelectParticipants: any[] = [];

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

        const mapGf = (p: any, teamId: number) => ({
          ...p,
          teamId,
          championId: p.championId || getIdFromName(p.championName || p.championInternalName),
          spell1Id: p.spell1Id || p.spellOneId || p.summoner1Id || (p.spells && p.spells[0]) || parseLiveClientSpellId(p.summonerSpells?.summonerSpellOne),
          spell2Id: p.spell2Id || p.spellTwoId || p.summoner2Id || (p.spells && p.spells[1]) || parseLiveClientSpellId(p.summonerSpells?.summonerSpellTwo),
          selectedSkinId: p.selectedSkinId || p.skinId,
          keystoneId: p.perks?.perk0 || p.perk0 || p.perks?.perkIds?.[0] || p.keystoneId || p.runes?.keystone?.id,
          secondaryStyleId: p.perks?.perkSubStyle || p.perkSubStyle || p.secondaryStyleId || p.runes?.secondaryRuneTree?.id
        });

        if (teamOne.length > 0 || teamTwo.length > 0) {
          gameflowParticipants = [
            ...teamOne.map((p: any) => mapGf(p, 100)),
            ...teamTwo.map((p: any) => mapGf(p, 200))
          ];
        } else if (selections.length > 0) {
          gameflowParticipants = selections.map((p: any, idx: number) => mapGf(p, idx < 5 ? 100 : 200));
        }
      }

      // Si no hay datos en Gameflow, intentar Selección de Campeones (ChampSelect)
      const draftRes = await fetch(`https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
      });

      if (draftRes.ok) {
        const draftData = await draftRes.json();
        if (draftData.myTeam && draftData.myTeam.length > 0) {
          const myTeam = (draftData.myTeam || []).map((p: any) => ({ ...p, teamId: 100 }));
          const theirTeam = (draftData.theirTeam || []).map((p: any) => ({ ...p, teamId: 200 }));
          champSelectParticipants = [...myTeam, ...theirTeam];
        }
      }

      if (participantsRaw.length === 0) {
        if (gameflowParticipants.length > 0) {
          participantsRaw = gameflowParticipants;
        } else if (champSelectParticipants.length > 0) {
          participantsRaw = champSelectParticipants;
        }
      } else {
        // Enriquecer participantes de port 2999 con skins, spells y runas de LCU Gameflow / Champ Select
        const lcuSources = [...gameflowParticipants, ...champSelectParticipants];
        participantsRaw = participantsRaw.map(p => {
          const match = lcuSources.find((g: any) =>
            (g.puuid && p.puuid && g.puuid === p.puuid) ||
            (g.championId && p.championId && g.championId === p.championId) ||
            (g.summonerName && p.summonerName && g.summonerName === p.summonerName) ||
            (g.gameName && p.gameName && g.gameName === p.gameName)
          );
          if (match) {
            const sid = (!p.skinId || p.skinId === 0) ? (match.selectedSkinId || match.skinId || p.skinId) : p.skinId;
            const spell1Id = p.spell1Id || match.spell1Id || match.spellOneId || match.summoner1Id || (match.spells && match.spells[0]);
            const spell2Id = p.spell2Id || match.spell2Id || match.spellTwoId || match.summoner2Id || (match.spells && match.spells[1]);
            const keystoneId = p.keystoneId || match.keystoneId || match.perk0 || (match.perks?.perkIds?.[0]);
            const secondaryStyleId = p.secondaryStyleId || match.secondaryStyleId || match.perkSubStyle || (match.perks?.perkSubStyle);
            return {
              ...p,
              skinId: sid,
              selectedSkinId: sid,
              spell1Id,
              spell2Id,
              keystoneId,
              secondaryStyleId
            };
          }
          return p;
        });
      }
    } catch (e) {
      console.warn('[LiveGame API] Error al obtener participantes del LCU local:', e);
    }
  }

  // 3. Fallback a Spectator API si LCU local no retornó participantes pero tenemos puuid
  if (participantsRaw.length === 0 && puuid) {
    try {
      const spectatorGame = await getActiveGame(puuid, platform);
      if (spectatorGame && spectatorGame.participants) {
        participantsRaw = spectatorGame.participants;
        gameMode = spectatorGame.gameMode || 'RANKED';
      }
    } catch (_e) {
      // Spectator API fallback
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

  // Generar huella (fingerprint) única y unificada de la partida basada en campeones y equipos
  const matchFingerprint = buildMatchFingerprint(participantsRaw, puuid);

  // 1. Si los datos ya fueron scrapeados para esta partida (isScraped === 1), retornar directo desde JSON
  // actualizando en tiempo real la skin seleccionada si el jugador la cambió
  const cachedMatch = loadLiveMatchCache();
  if (cachedMatch && cachedMatch.isScraped === 1 && cachedMatch.matchFingerprint === matchFingerprint) {
    let hasSkinUpdates = false;

    const updateSkinInCachedTeam = async (team: any[]) => {
      return Promise.all(team.map(async (p) => {
        const liveP = participantsRaw.find(raw => 
          (raw.puuid && p.puuid && raw.puuid === p.puuid) || 
          (raw.championId && p.championId && raw.championId === p.championId) ||
          (raw.summonerName && p.summonerName && raw.summonerName === p.summonerName)
        );
        const sid = liveP ? (liveP.selectedSkinId || liveP.skinId || liveP.skinID || 0) : (p.selectedSkinId || p.skinId || 0);
        const skinNum = await resolveSkinNumber(p.championId, sid);
        if (sid !== p.skinId || skinNum !== p.skinNum) {
          hasSkinUpdates = true;
        }
        return { ...p, skinId: sid, selectedSkinId: sid, skinNum };
      }));
    };

    const blueTeam = await updateSkinInCachedTeam(cachedMatch.blueTeam || []);
    const redTeam = await updateSkinInCachedTeam(cachedMatch.redTeam || []);

    if (hasSkinUpdates) {
      saveLiveMatchCache({
        ...cachedMatch,
        blueTeam,
        redTeam
      });
    }

    return new Response(
      JSON.stringify({
        active: true,
        gameMode: cachedMatch.gameMode,
        blueTeam,
        redTeam,
        myTeam: blueTeam,
        theirTeam: redTeam,
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

    const role = p.role || (p.assignedPosition && p.assignedPosition.trim() !== '' && p.assignedPosition !== 'none'
      ? p.assignedPosition.toUpperCase()
      : ROLES_ORDER[indexInTeam % 5]);

    const isSelf = Boolean(
      (puuid && p.puuid && p.puuid === puuid) ||
      (rawName.toLowerCase() === 'frikz') ||
      p.isLocalPlayer
    );

    // Extraer perfil y etiquetas vía OP.GG Scraper Service v2 (sin caché para el usuario local)
    const profile = await scrapeOpggProfile(rawName, rawTag, platform, championId, isSelf);

    // Si el usuario es local y tenemos LCU activo, calcular el record exacto de la sesion del dia
    if (isSelf && lcu) {
      const localSession = await fetchLocalSessionRecord(lcu, puuid);
      if (localSession) {
        profile.todayRecord = localSession;
        console.log(`[LiveGame API] Sesión de hoy calculada vía LCU para ${rawName}: ${localSession.wins}W - ${localSession.losses}L (Racha: ${localSession.streak.count}${localSession.streak.type || ''})`);
      }
    }

    const skinId = p.selectedSkinId || p.skinId || p.skinID || 0;
    const skinNum = await resolveSkinNumber(championId, skinId);

    const spell1Id = p.spell1Id ||
      parseLiveClientSpellId(p.summonerSpells?.summonerSpellOne) ||
      parseLiveClientSpellId(p.rawPlayer?.summonerSpells?.summonerSpellOne) ||
      p.spellOneId ||
      p.summoner1Id ||
      (p.spells && p.spells[0]) ||
      undefined;

    const spell2Id = p.spell2Id ||
      parseLiveClientSpellId(p.summonerSpells?.summonerSpellTwo) ||
      parseLiveClientSpellId(p.rawPlayer?.summonerSpells?.summonerSpellTwo) ||
      p.spellTwoId ||
      p.summoner2Id ||
      (p.spells && p.spells[1]) ||
      undefined;

    const keystoneId = p.keystoneId ||
      p.runes?.keystone?.id ||
      p.rawPlayer?.runes?.keystone?.id ||
      p.perks?.perk0 ||
      p.perk0 ||
      p.perks?.perkIds?.[0] ||
      undefined;

    const secondaryStyleId = p.secondaryStyleId ||
      p.runes?.secondaryRuneTree?.id ||
      p.rawPlayer?.runes?.secondaryRuneTree?.id ||
      p.perks?.perkSubStyle ||
      p.perkSubStyle ||
      undefined;

    console.log(`[LiveGame API] Invocador: ${rawName || 'Anónimo'}${isSelf ? ' (TÚ)' : ''} | Campeón: ${championName} (ID: ${championId}) | Rol: ${role} | SkinId: ${skinId} -> #${skinNum} | Spells: [${spell1Id}, ${spell2Id}] | Keystone: ${keystoneId} | SubStyle: ${secondaryStyleId}`);

    return {
      ...profile,
      profileIconId: lcuProfileIconId || profile.profileIconId || 29,
      teamId: p.teamId,
      championId,
      championName,
      role,
      skinId,
      selectedSkinId: skinId,
      skinNum,
      spell1Id,
      spell2Id,
      keystoneId,
      secondaryStyleId
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

  const blueTeamWithRoles = assignTeamRoles(blueTeamRaw);
  const redTeamWithRoles = assignTeamRoles(redTeamRaw);

  const [blueTeamUnsorted, redTeamUnsorted] = await Promise.all([
    Promise.all(blueTeamWithRoles.map((p, idx) => processParticipant(p, idx))),
    Promise.all(redTeamWithRoles.map((p, idx) => processParticipant(p, idx)))
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