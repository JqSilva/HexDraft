// src/pages/api/me.ts
import type { APIRoute } from 'astro';
import { getLockfileData, readLcuProfileCache, writeLcuProfileCache } from '../../lib/services/lcu.service.js';
import { getNameFromId } from '../../lib/engine/engine.js';
import { configRepo } from '../../lib/db/config.repo.js';

// Desactivar validación de certificados SSL autofirmados para el cliente local de Riot
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let isBackgroundUpdating = false;

function checkIfSyncRecommended(gameVersion?: string): boolean {
  try {
    const lastSyncTimestamp = configRepo.getConfig('last_sync_timestamp') || '-';
    const lastSyncVersion = configRepo.getConfig('last_sync_version') || '-';
    const syncPeriodDays = parseInt(configRepo.getConfig('sync_period_days') || '3') || 3;
    
    // 1. Comprobar tiempo transcurrido (3 días)
    if (lastSyncTimestamp === '-' || !lastSyncTimestamp) return true;
    const lastDate = new Date(lastSyncTimestamp);
    if (!isNaN(lastDate.getTime())) {
      const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= syncPeriodDays) return true;
    } else {
      return true;
    }
    
    // 2. Comprobar versión de parche (si la tenemos)
    if (gameVersion && lastSyncVersion !== '-' && lastSyncVersion !== '0') {
      const parts = gameVersion.split('.');
      if (parts.length >= 2) {
        const shortVersion = `${parts[0]}.${parts[1]}`;
        if (shortVersion !== lastSyncVersion) return true;
      }
    }
  } catch (e) {
    console.error("Error al comprobar la recomendación de sync:", e);
  }
  return false;
}

async function fetchAllProfileData(lcu: any, summonerData: any, signature: string) {
  const auth = btoa(`riot:${lcu.token}`);
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json'
  };

  const summonerName = summonerData.gameName || summonerData.displayName;
  const puuid = summonerData.puuid;

  // 2. Obtener la versión de juego actual del LCU (Fail-safe)
  let gameVersion = "14.9.1";
  try {
    const versionResponse = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-patch/v1/game-version`,
      { headers }
    );
    if (versionResponse.ok) {
      const fullVersion = await versionResponse.json();
      const parts = fullVersion.split('.');
      gameVersion = `${parts[0]}.${parts[1]}.1`;
    }
  } catch (e) {
    console.warn("No se pudo obtener la versión de juego LCU:", e);
  }

  // 3. Obtener estadísticas clasificatorias (Opcional y fail-safe)
  let rankedInfo = {
    tier: "UNRANKED",
    division: "",
    lp: 0,
    wins: 0,
    losses: 0
  };

  let rankedFlexInfo = {
    tier: "UNRANKED",
    division: "",
    lp: 0,
    wins: 0,
    losses: 0
  };

  try {
    const rankedResponse = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-ranked/v1/current-ranked-stats`,
      { headers }
    );
    if (rankedResponse.ok) {
      const rankedData = await rankedResponse.json();
      if (rankedData && rankedData.queues) {
        const soloQueue = rankedData.queues.find(
          (q: any) => q.queueType === 'RANKED_SOLO_5x5'
        );
        const flexQueue = rankedData.queues.find(
          (q: any) => q.queueType === 'RANKED_FLEX_SR'
        );
        
        if (soloQueue && soloQueue.tier) {
          rankedInfo = {
            tier: soloQueue.tier,
            division: soloQueue.division || "",
            lp: soloQueue.leaguePoints || 0,
            wins: soloQueue.wins || 0,
            losses: soloQueue.losses || 0
          };
        }
        if (flexQueue && flexQueue.tier) {
          rankedFlexInfo = {
            tier: flexQueue.tier,
            division: flexQueue.division || "",
            lp: flexQueue.leaguePoints || 0,
            wins: flexQueue.wins || 0,
            losses: flexQueue.losses || 0
          };
        }
      }
    }
  } catch (e) {
    console.warn("No se pudo consultar el ranked de LCU:", e);
  }

  // 4. Obtener maestría de campeones (Opcional y fail-safe)
  let topMastery: any[] = [];
  try {
    const masteryResponse = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-champion-mastery/v1/local-player/champion-mastery`,
      { headers }
    );
    if (masteryResponse.ok) {
      const masteryData = await masteryResponse.json();
      if (Array.isArray(masteryData) && masteryData.length > 0) {
        const sorted = [...masteryData]
          .sort((a: any, b: any) => b.championPoints - a.championPoints)
          .slice(0, 4);

        topMastery = sorted.map((m: any) => ({
          championId: m.championId,
          level: m.championLevel,
          points: m.championPoints
        }));
      }
    }
  } catch (e) {
    console.warn("No se pudo consultar la maestría de LCU:", e);
  }

  // 5. Obtener historial de partidas reciente (Opcional y fail-safe)
  let recentMatches: any[] = [];
  try {
    const matchHistoryResponse = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-match-history/v1/products/lol/current-summoner/matches`,
      { headers }
    );
    if (matchHistoryResponse.ok) {
      const mhData = await matchHistoryResponse.json();
      if (mhData && mhData.games && mhData.games.games) {
        const gamesList = mhData.games.games.slice(0, 4);
        recentMatches = gamesList.map((g: any) => {
          const identity = g.participantIdentities.find(
            (pid: any) => pid.player.puuid === puuid
          );
          const participantId = identity ? identity.participantId : 1;
          const participant = g.participants.find(
            (p: any) => p.participantId === participantId
          );
          
          const stats = participant ? participant.stats : { kills: 0, deaths: 0, assists: 0, win: false, totalMinionsKilled: 0, neutralMinionsKilled: 0 };
          const kills = stats.kills || 0;
          const deaths = stats.deaths || 0;
          const assists = stats.assists || 0;
          const win = stats.win || false;
          
          const cs = (stats.totalMinionsKilled || 0) + (stats.neutralMinionsKilled || 0);
          const durationMin = Math.round((g.gameDuration || 1500) / 60);
          const csPerMin = durationMin > 0 ? (cs / durationMin).toFixed(1) : "0.0";
          
          const timeDiff = Date.now() - g.gameCreation;
          let timeAgo = "Hace poco";
          const minAgo = Math.floor(timeDiff / 60000);
          if (minAgo < 60) {
            timeAgo = `${minAgo}m hace`;
          } else {
            const hoursAgo = Math.floor(minAgo / 60);
            if (hoursAgo < 24) {
              timeAgo = `${hoursAgo}h hace`;
            } else {
              timeAgo = `${Math.floor(hoursAgo / 24)}d hace`;
            }
          }

          const timeline = participant?.timeline || {};
          const rawLane = timeline.lane || "NONE";
          const rawRole = timeline.role || "NONE";
          
          let matchLane = "MID"; // Default
          
          if (rawLane === "JUNGLE") {
            matchLane = "JUNGLE";
          } else if (rawLane === "MIDDLE" || rawLane === "MID") {
            matchLane = "MID";
          } else if (rawLane === "TOP") {
            matchLane = "TOP";
          } else if (rawLane === "BOTTOM" || rawLane === "BOT") {
            if (rawRole === "DUO_SUPPORT") {
              matchLane = "SUPPORT";
            } else {
              matchLane = "ADC";
            }
          } else if (rawLane === "UTILITY") {
            matchLane = "SUPPORT";
          } else {
            // Hechizos de invocador
            const s1 = participant?.spell1Id || 0;
            const s2 = participant?.spell2Id || 0;
            if (s1 === 11 || s2 === 11) {
              matchLane = "JUNGLE";
            } else {
              const champName = getNameFromId(participant?.championId || 0);
              if (champName) {
                const specialRoles: Record<string, string> = {
                  "Zed": "MID", "Yasuo": "MID", "Ahri": "MID", "Jinx": "ADC", "Lee Sin": "JUNGLE",
                  "Lux": "SUPPORT", "Garen": "TOP", "Viego": "JUNGLE", "Yone": "MID", "Aatrox": "TOP",
                  "Katarina": "MID", "Akali": "MID", "Thresh": "SUPPORT", "Teemo": "TOP", "Wukong": "JUNGLE",
                  "Rek'Sai": "JUNGLE"
                };
                matchLane = specialRoles[champName] || "MID";
              }
            }
          }

          return {
            championId: participant ? participant.championId : 238,
            win,
            kills,
            deaths,
            assists,
            csPerMin,
            timeAgo,
            gameMode: g.gameMode || "CLASSIC",
            lane: matchLane
          };
        });
      }
    }
  } catch (e) {
    console.warn("No se pudo obtener el historial de partidas LCU:", e);
  }

  const profileData = {
    isConnected: true,
    lockfileSignature: signature,
    gameVersion: gameVersion,
    puuid: puuid,
    summoner: summonerName,
    level: summonerData.summonerLevel,
    xpPercent: summonerData.percentCompleteForNextLevel,
    xpCurrent: summonerData.xpSinceLastLevel,
    xpMax: summonerData.xpSinceLastLevel + summonerData.xpUntilNextLevel,
    profileIconId: summonerData.profileIconId,
    ranked: rankedInfo,
    rankedFlex: rankedFlexInfo,
    mastery: topMastery,
    matches: recentMatches
  };

  // Escribir en caché local marcándolo para el siguiente arranque offline
  writeLcuProfileCache({
    ...profileData,
    isConnected: false
  });

  return profileData;
}

async function updateProfileCacheInBackground(lcu: any, cachedProfile: any, summonerData?: any) {
  if (isBackgroundUpdating) return;
  isBackgroundUpdating = true;
  try {
    const auth = btoa(`riot:${lcu.token}`);
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    };

    let activeSummonerData = summonerData;
    if (!activeSummonerData) {
      const response = await fetch(
        `https://127.0.0.1:${lcu.port}/lol-summoner/v1/current-summoner`,
        { headers }
      );
      if (response.ok) {
        activeSummonerData = await response.json();
      }
    }

    if (activeSummonerData) {
      const signature = `${lcu.port}:${lcu.token}`;
      await fetchAllProfileData(lcu, activeSummonerData, signature);
    }
  } catch (e) {
    console.error("Error en la actualización de perfil en segundo plano:", e);
  } finally {
    isBackgroundUpdating = false;
  }
}

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();

  const offlineEmptyPayload = {
    isConnected: false,
    syncRecommended: checkIfSyncRecommended(),
    gameVersion: "16.12",
    summoner: "Desconectado",
    level: 0,
    xpPercent: 0,
    xpCurrent: 0,
    xpMax: 100,
    profileIconId: 29, // Icono default
    ranked: {
      tier: "UNRANKED",
      division: "",
      lp: 0,
      wins: 0,
      losses: 0
    },
    rankedFlex: {
      tier: "UNRANKED",
      division: "",
      lp: 0,
      wins: 0,
      losses: 0
    },
    mastery: [],
    matches: []
  };

  if (!lcu) {
    const cachedProfile = readLcuProfileCache();
    if (cachedProfile) {
      return new Response(JSON.stringify({
        ...cachedProfile,
        isConnected: false,
        syncRecommended: checkIfSyncRecommended(cachedProfile.gameVersion)
      }), { status: 200 });
    }
    return new Response(JSON.stringify(offlineEmptyPayload), { status: 200 });
  }

  // Si LCU está conectado, comprobar caché con firma del lockfile
  const cachedProfile = readLcuProfileCache();
  const currentSignature = `${lcu.port}:${lcu.token}`;

  // Caso 1: Firma coincide exactamente -> Devolver caché al instante y actualizar estadísticas en background
  if (cachedProfile && cachedProfile.lockfileSignature === currentSignature) {
    updateProfileCacheInBackground(lcu, cachedProfile);
    return new Response(JSON.stringify({
      ...cachedProfile,
      isConnected: true,
      syncRecommended: checkIfSyncRecommended(cachedProfile.gameVersion)
    }), { status: 200 });
  }

  // Caso 2: Firma no coincide -> Hacemos petición rápida a Summoner para verificar si es el mismo usuario
  const auth = btoa(`riot:${lcu.token}`);
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json'
  };

  try {
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-summoner/v1/current-summoner`,
      { headers }
    );

    if (!response.ok) {
      throw new Error("No se pudo obtener el summoner actual");
    }

    const summonerData = await response.json();
    const summonerName = summonerData.gameName || summonerData.displayName;

    if (cachedProfile && cachedProfile.summoner === summonerName) {
      // Mismo invocador pero nueva sesión (ej: reinició cliente). Actualizamos firma y devolvemos caché de inmediato.
      cachedProfile.lockfileSignature = currentSignature;
      writeLcuProfileCache(cachedProfile);
      
      updateProfileCacheInBackground(lcu, cachedProfile, summonerData);
      
      return new Response(JSON.stringify({
        ...cachedProfile,
        isConnected: true,
        syncRecommended: checkIfSyncRecommended(cachedProfile.gameVersion)
      }), { status: 200 });
    }

    // Caso 3: Invocador distinto (cambio de cuenta) o sin caché -> Realizamos carga completa síncrona por esta única vez
    const newProfile = await fetchAllProfileData(lcu, summonerData, currentSignature);
    return new Response(JSON.stringify({
      ...newProfile,
      isConnected: true,
      syncRecommended: checkIfSyncRecommended(newProfile.gameVersion)
    }), { status: 200 });

  } catch (e: any) {
    console.error("Error al conectar con LCU:", e.message || e);
    if (cachedProfile) {
      return new Response(JSON.stringify({
        ...cachedProfile,
        isConnected: false,
        syncRecommended: checkIfSyncRecommended(cachedProfile.gameVersion),
        error: "Error de conexión con el LCU"
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      ...offlineEmptyPayload,
      error: "Error de conexión con el LCU"
    }), { status: 200 });
  }
};
