// src/pages/api/me.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';

// Desactivar validación de certificados SSL autofirmados para el cliente local de Riot
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();

  const mockPayload = {
    isConnected: false,
    gameVersion: "14.9.1", // Fallback a la versión local por defecto en hydrator.ts (14.9.1)
    summoner: "Alex Legend",
    level: 128,
    xpPercent: 43,
    xpCurrent: 12450,
    xpMax: 28950,
    profileIconId: 29, // Icono clásico
    ranked: {
      tier: "CHALLENGER",
      division: "I",
      lp: 842,
      wins: 142,
      losses: 105
    },
    rankedFlex: {
      tier: "DIAMOND",
      division: "IV",
      lp: 22,
      wins: 45,
      losses: 38
    },
    mastery: [
      { championId: 238, level: 7, points: 248500 }, // Zed
      { championId: 157, level: 7, points: 185200 }, // Yasuo
      { championId: 103, level: 6, points: 92000 },  // Ahri
      { championId: 222, level: 5, points: 45100 }   // Jinx
    ],
    matches: [
      { championId: 238, win: true, kills: 14, deaths: 2, assists: 8, csPerMin: "8.2", timeAgo: "24m hace", gameMode: "CLASSIC" },
      { championId: 157, win: false, kills: 4, deaths: 7, assists: 2, csPerMin: "6.8", timeAgo: "2h hace", gameMode: "CLASSIC" },
      { championId: 103, win: true, kills: 9, deaths: 1, assists: 12, csPerMin: "7.3", timeAgo: "5h hace", gameMode: "CLASSIC" },
      { championId: 238, win: true, kills: 18, deaths: 3, assists: 9, csPerMin: "8.5", timeAgo: "Ayer", gameMode: "CLASSIC" }
    ]
  };

  if (!lcu) {
    return new Response(JSON.stringify(mockPayload), { status: 200 });
  }

  const auth = btoa(`riot:${lcu.token}`);
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json'
  };

  try {
    // 1. Obtener datos del summoner actual
    const response = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-summoner/v1/current-summoner`,
      { headers }
    );

    if (!response.ok) {
      throw new Error("No se pudo obtener el summoner actual");
    }

    const data = await response.json();
    const summonerName = data.gameName || data.displayName;
    const puuid = data.puuid;

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
    let topMastery = mockPayload.mastery;
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
    let recentMatches = mockPayload.matches;
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

            return {
              championId: participant ? participant.championId : 238,
              win,
              kills,
              deaths,
              assists,
              csPerMin,
              timeAgo,
              gameMode: g.gameMode || "CLASSIC"
            };
          });
        }
      }
    } catch (e) {
      console.warn("No se pudo obtener el historial de partidas LCU:", e);
    }

    return new Response(JSON.stringify({
      isConnected: true,
      gameVersion: gameVersion,
      summoner: summonerName,
      level: data.summonerLevel,
      xpPercent: data.percentCompleteForNextLevel,
      xpCurrent: data.xpSinceLastLevel,
      xpMax: data.xpSinceLastLevel + data.xpUntilNextLevel,
      profileIconId: data.profileIconId,
      ranked: rankedInfo,
      rankedFlex: rankedFlexInfo,
      mastery: topMastery,
      matches: recentMatches
    }), { status: 200 });
    
  } catch (e) {
    return new Response(JSON.stringify({
      ...mockPayload,
      error: "Error de conexión con el LCU"
    }), { status: 200 });
  }
};