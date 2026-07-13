// src/pages/api/history.ts
import type { APIRoute } from 'astro';
import { getLockfileData } from '../../lib/services/lcu.service.js';
import { getNameFromId } from '../../lib/engine/engine.js';
import { db } from '../../lib/db/sqlite.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// MOCK DATA: 8 matches for high-fidelity offline mode
const MOCK_HISTORY = [
  {
    gameId: 1001,
    gameCreation: Date.now() - 3600000 * 20, // 20h ago
    gameDuration: 1496, // 24:56
    gameMode: "CLASSIC",
    queueId: 440, // Flex
    win: true,
    championId: 254, // Vi (Wukong / Rek'Sai are also nice, but Vi is great)
    kills: 4,
    deaths: 2,
    assists: 5,
    cs: 145,
    csPerMin: "5.8",
    level: 13,
    gold: 9800,
    damage: 12400,
    visionScore: 18,
    spells: [11, 4], // Smite, Flash
    runes: { keystone: 8010, primaryStyle: 8000, subStyle: 8400 }, // Conqueror, Precision, Resolve
    items: [6631, 3071, 3111, 1055, 3067, 3133, 3364], // Evenshroud, Black Cleaver, Mercs, DBlade, Kindle, Caulfields, Sweeper
    allies: [
      { championId: 266, summonerName: "Frikz" }, // Aatrox
      { championId: 254, summonerName: "Frikz #xoro" }, // Vi (Self)
      { championId: 103, summonerName: "Ahri Main" }, // Ahri
      { championId: 222, summonerName: "Jinx Carry" }, // Jinx
      { championId: 412, summonerName: "Hooker" } // Thresh
    ],
    enemies: [
      { championId: 58, summonerName: "Crocodile" }, // Renekton
      { championId: 120, summonerName: "Pony" }, // Hecarim
      { championId: 84, summonerName: "Ninja" }, // Akali
      { championId: 145, summonerName: "VoidGirl" }, // Kaisa
      { championId: 12, summonerName: "Cow" } // Alistar
    ]
  },
  {
    gameId: 1002,
    gameCreation: Date.now() - 3600000 * 72, // 3d ago
    gameDuration: 1978, // 32:58
    gameMode: "CLASSIC",
    queueId: 440, // Flex
    win: true,
    championId: 62, // Wukong
    kills: 14,
    deaths: 8,
    assists: 8,
    cs: 215,
    csPerMin: "6.5",
    level: 16,
    gold: 14200,
    damage: 28400,
    visionScore: 24,
    spells: [11, 4], // Smite, Flash
    runes: { keystone: 8010, primaryStyle: 8000, subStyle: 8400 }, // Conqueror, Precision, Resolve
    items: [3078, 6333, 3153, 3071, 3111, 3053, 3364], // Trinity, DD, Blade, Cleaver, Mercs, Steraks, Sweeper
    allies: [
      { championId: 78, summonerName: "YordleTop" }, // Poppy
      { championId: 62, summonerName: "Frikz #xoro" }, // Wukong (Self)
      { championId: 157, summonerName: "WindMan" }, // Yasuo
      { championId: 81, summonerName: "Explorer" }, // Ezreal
      { championId: 89, summonerName: "SunLady" } // Leona
    ],
    enemies: [
      { championId: 86, summonerName: "SpinToWin" }, // Garen
      { championId: 64, summonerName: "BlindMonk" }, // Lee Sin
      { championId: 134, summonerName: "Balls" }, // Syndra
      { championId: 222, summonerName: "Rockets" }, // Jinx
      { championId: 201, summonerName: "Shield" } // Braum
    ]
  },
  {
    gameId: 1003,
    gameCreation: Date.now() - 3600000 * 96, // 4d ago
    gameDuration: 2299, // 38:19
    gameMode: "CLASSIC",
    queueId: 440,
    win: false,
    championId: 103, // Ahri
    kills: 9,
    deaths: 9,
    assists: 16,
    cs: 280,
    csPerMin: "7.3",
    level: 18,
    gold: 16500,
    damage: 39500,
    visionScore: 31,
    spells: [4, 14], // Flash, Ignite
    runes: { keystone: 8112, primaryStyle: 8100, subStyle: 8200 }, // Electrocute, Domination, Sorcery
    items: [6655, 3089, 3135, 3157, 3020, 3100, 3340], // Ludens, Deathcap, VoidStaff, Zhoniyas, Sorcs, LichBane, Ward
    allies: [
      { championId: 24, summonerName: "Jaximus" }, // Jax
      { championId: 76, summonerName: "Spear" }, // Nidalee
      { championId: 103, summonerName: "Frikz #xoro" }, // Ahri (Self)
      { championId: 145, summonerName: "VoidCarry" }, // Kaisa
      { championId: 497, summonerName: "Dancer" } // Rakan
    ],
    enemies: [
      { championId: 266, summonerName: "Darkin" }, // Aatrox
      { championId: 254, summonerName: "Punch" }, // Vi
      { championId: 84, summonerName: "Kallme" }, // Akali
      { championId: 22, summonerName: "IceBow" }, // Ashe
      { championId: 432, summonerName: "StarBards" } // Bard
    ]
  },
  {
    gameId: 1004,
    gameCreation: Date.now() - 3600000 * 120, // 5d ago
    gameDuration: 1102, // 18:22
    gameMode: "CLASSIC",
    queueId: 440,
    win: true,
    championId: 103, // Ahri
    kills: 4,
    deaths: 3,
    assists: 5,
    cs: 138,
    csPerMin: "7.5",
    level: 11,
    gold: 7200,
    damage: 10200,
    visionScore: 12,
    spells: [4, 14], // Flash, Ignite
    runes: { keystone: 8112, primaryStyle: 8100, subStyle: 8200 },
    items: [6655, 3100, 3020, 1056, 3113, 0, 3340],
    allies: [
      { championId: 17, summonerName: "TeeMo" },
      { championId: 120, summonerName: "HecaJng" },
      { championId: 103, summonerName: "Frikz #xoro" },
      { championId: 81, summonerName: "EzBoy" },
      { championId: 267, summonerName: "Bubble" }
    ],
    enemies: [
      { championId: 86, summonerName: "BushGaren" },
      { championId: 200, summonerName: "Kevyn" },
      { championId: 157, summonerName: "Hasagii" },
      { championId: 22, summonerName: "Arrow" },
      { championId: 117, summonerName: "LuluPix" }
    ]
  },
  {
    gameId: 1005,
    gameCreation: Date.now() - 3600000 * 168, // 7d ago
    gameDuration: 2248, // 37:28
    gameMode: "CLASSIC",
    queueId: 440,
    win: true,
    championId: 238, // Zed
    kills: 9,
    deaths: 7,
    assists: 13,
    cs: 310,
    csPerMin: "8.3",
    level: 18,
    gold: 17200,
    damage: 42300,
    visionScore: 28,
    spells: [4, 14],
    runes: { keystone: 8128, primaryStyle: 8100, subStyle: 8200 }, // Dark Harvest
    items: [3142, 6695, 3814, 3071, 3156, 3158, 3364], // Ghostblade, Seryldas, EoN, Cleaver, Maw, Ionian, Sweeper
    allies: [
      { championId: 223, summonerName: "FrogTop" },
      { championId: 104, summonerName: "GravesJng" },
      { championId: 238, summonerName: "Frikz #xoro" },
      { championId: 222, summonerName: "RocketCarry" },
      { championId: 53, summonerName: "HookEm" }
    ],
    enemies: [
      { championId: 127, summonerName: "Lissandra" },
      { championId: 64, summonerName: "Lee" },
      { championId: 91, summonerName: "Talon" },
      { championId: 145, summonerName: "Kaisa" },
      { championId: 201, summonerName: "Braum" }
    ]
  },
  {
    gameId: 1006,
    gameCreation: Date.now() - 3600000 * 192, // 8d ago
    gameDuration: 1678, // 27:58
    gameMode: "CLASSIC",
    queueId: 440,
    win: true,
    championId: 64, // Lee Sin
    kills: 7,
    deaths: 3,
    assists: 17,
    cs: 140,
    csPerMin: "5.0",
    level: 14,
    gold: 11100,
    damage: 14900,
    visionScore: 35,
    spells: [11, 4],
    runes: { keystone: 8010, primaryStyle: 8000, subStyle: 8200 },
    items: [6631, 3071, 3053, 3111, 3133, 0, 3364],
    allies: [
      { championId: 86, summonerName: "Spin" },
      { championId: 64, summonerName: "Frikz #xoro" },
      { championId: 103, summonerName: "Fox" },
      { championId: 22, summonerName: "Ashe" },
      { championId: 12, summonerName: "Moo" }
    ],
    enemies: [
      { championId: 266, summonerName: "Aatrox" },
      { championId: 20, summonerName: "Nunu" },
      { championId: 112, summonerName: "Viktor" },
      { championId: 145, summonerName: "Kaisa" },
      { championId: 117, summonerName: "Lulu" }
    ]
  },
  {
    gameId: 1007,
    gameCreation: Date.now() - 3600000 * 360, // 15d ago
    gameDuration: 1687, // 28:07
    gameMode: "CLASSIC",
    queueId: 440,
    win: false,
    championId: 62, // Wukong
    kills: 4,
    deaths: 8,
    assists: 8,
    cs: 151,
    csPerMin: "5.4",
    level: 13,
    gold: 9100,
    damage: 11200,
    visionScore: 19,
    spells: [11, 4],
    runes: { keystone: 8010, primaryStyle: 8000, subStyle: 8400 },
    items: [3078, 3071, 3111, 1055, 1037, 0, 3364],
    allies: [
      { championId: 150, summonerName: "MegaGnar" },
      { championId: 62, summonerName: "Frikz #xoro" },
      { championId: 4, summonerName: "TF" },
      { championId: 222, summonerName: "Jinx" },
      { championId: 412, summonerName: "Thresh" }
    ],
    enemies: [
      { championId: 58, summonerName: "Croc" },
      { championId: 254, summonerName: "Punchy" },
      { championId: 134, summonerName: "Syndra" },
      { championId: 81, summonerName: "Ez" },
      { championId: 89, summonerName: "Leona" }
    ]
  },
  {
    gameId: 1008,
    gameCreation: Date.now() - 3600000 * 362, // 15d ago
    gameDuration: 1215, // 20:15
    gameMode: "CLASSIC",
    queueId: 440,
    win: false,
    championId: 157, // Yasuo
    kills: 2,
    deaths: 5,
    assists: 6,
    cs: 141,
    csPerMin: "7.0",
    level: 12,
    gold: 6800,
    damage: 9400,
    visionScore: 8,
    spells: [4, 14],
    runes: { keystone: 8008, primaryStyle: 8000, subStyle: 8400 }, // Lethal Tempo
    items: [3046, 1037, 3006, 1055, 0, 0, 3340],
    allies: [
      { championId: 266, summonerName: "Aatrox" },
      { championId: 120, summonerName: "Hecarim" },
      { championId: 157, summonerName: "Frikz #xoro" },
      { championId: 145, summonerName: "Kaisa" },
      { championId: 111, summonerName: "Naut" }
    ],
    enemies: [
      { championId: 86, summonerName: "Garen" },
      { championId: 64, summonerName: "Lee" },
      { championId: 103, summonerName: "Ahri" },
      { championId: 22, summonerName: "Ashe" },
      { championId: 267, summonerName: "Nami" }
    ]
  }
];

// Helper to format mock history with correct lanes for UI VS matchups
const getFormattedMocks = () => {
  const lanes = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  return MOCK_HISTORY.map(m => {
    const alliesWithLane = m.allies.map((a, i) => ({ ...a, lane: lanes[i] || "MID" }));
    const enemiesWithLane = m.enemies.map((e, i) => ({ ...e, lane: lanes[i] || "MID" }));
    const selfIndex = m.allies.findIndex(a => a.summonerName.includes("Frikz"));
    const selfLane = selfIndex !== -1 ? lanes[selfIndex] : "MID";
    return {
      ...m,
      lane: selfLane,
      allies: alliesWithLane,
      enemies: enemiesWithLane
    };
  });
};

// Heuristic to sort 5 players of a team into TOP, JUNGLE, MID, ADC, SUPPORT
const assignLanesToTeam = (participants: any[]) => {
  // 1. Identify JUNGLE (Smite spell 11)
  let jungleIdx = participants.findIndex(p => p.spell1Id === 11 || p.spell2Id === 11);
  if (jungleIdx === -1) {
    jungleIdx = participants.findIndex(p => {
      const name = getNameFromId(p.championId || 0);
      return ["Lee Sin", "Vi", "Wukong", "Rek'Sai", "Hecarim", "Nidalee", "Graves", "Nunu", "Viego", "Nocturne", "Elise", "Shaco", "Evelynn", "Skarner", "Bel'Veth", "Belveth", "Ivern", "Kindred", "Lillia", "Kha'Zix", "Khazix", "Rengar", "Karthus", "Fiddlesticks", "Amumu", "Rammus", "Sejuani", "Zac", "Udyr", "Volibear", "Jax", "Trundle", "Xin Zhao", "Olaf", "Diana", "Gragas", "Ekko", "Taliyah", "Sylas", "Briar", "Brand"].includes(name);
    });
  }
  if (jungleIdx === -1) jungleIdx = 1; // fallback

  // 2. Identify SUPPORT (non-jungler with lowest CS)
  const nonJungleIndices = [0, 1, 2, 3, 4].filter(idx => idx !== jungleIdx);
  let supportIdx = nonJungleIndices[0];
  let minCs = Infinity;
  nonJungleIndices.forEach(idx => {
    const pCs = (participants[idx]?.stats?.totalMinionsKilled || 0) + (participants[idx]?.stats?.neutralMinionsKilled || 0);
    if (pCs < minCs) {
      minCs = pCs;
      supportIdx = idx;
    }
  });

  // 3. Classify TOP, MID, ADC
  const laneIndices = nonJungleIndices.filter(idx => idx !== supportIdx);
  const championLanes: Record<string, string[]> = {
    "TOP": ["Garen", "Aatrox", "Poppy", "Renekton", "Jax", "Teemo", "Gnar", "Darius", "Fiora", "Camille", "Irelia", "Riven", "Malphite", "Ornn", "Sion", "Cho'Gath", "K'Sante", "Ksante", "Tryndamere", "Nasus", "Yorick", "Urgot", "Singed", "Dr. Mundo", "DrMundo", "Shen", "Kennan", "Kennen", "Rumble", "Volibear", "Gwen", "Kled", "Sett", "Morde", "Mordekaiser", "Pantheon", "Quinn", "Kayle", "Yasuo", "Yone", "Aurelion Sol", "AurelionSol", "Udyr", "Olaf", "Jayce", "Gangplank"],
    "MID": ["Ahri", "Zed", "Yasuo", "Viktor", "Syndra", "Akali", "Lissandra", "Talon", "Katarina", "Yone", "Veigar", "Orianna", "Leblanc", "LeBlanc", "Ryze", "Azir", "Lux", "Vex", "Hwei", "Neeko", "Zoe", "Taliyah", "Sylas", "Ekko", "Kassadin", "Anivia", "Malzahar", "Swain", "Vladimir", "Cassiopeia", "Twisted Fate", "TF", "Annie", "Aurelion Sol", "AurelionSol", "Galio", "Karma", "Heimerdinger", "Ziggs", "Xerath", "Vel'Koz", "Velkoz", "Pantheon", "Naafiri", "Jayce"],
    "ADC": ["Jinx", "Ezreal", "Kai'Sa", "Ashe", "Caitlyn", "Lucian", "Vayne", "Sivir", "Tristana", "Miss Fortune", "Twitch", "Kog'Maw", "Varus", "Draven", "Samira", "Zeri", "Jhin", "Aphelios", "Kalista", "Nilah", "Smolder", "Yasuo"]
  };

  const scoreRole = (champId: number, role: string) => {
    const name = getNameFromId(champId) || "";
    if (championLanes[role].includes(name)) return 10;
    if (role === "ADC") {
      const marksmen = ["Aphelios", "Caitlyn", "Draven", "Ezreal", "Jhin", "Jinx", "Kai'Sa", "KogMaw", "Lucian", "MissFortune", "Samira", "Sivir", "Tristana", "Twitch", "Varus", "Vayne", "Zeri", "Kaisa", "Kalista", "Nilah", "Smolder"];
      if (marksmen.some(m => name.includes(m))) return 5;
    }
    return 0;
  };

  const roles = ["TOP", "MID", "ADC"];
  const permutations = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
  ];

  let bestPerm = permutations[0];
  let maxScore = -1;

  permutations.forEach(perm => {
    let score = 0;
    perm.forEach((roleIdx, i) => {
      const playerIdx = laneIndices[i];
      const role = roles[roleIdx];
      score += scoreRole(participants[playerIdx]?.championId || 0, role);
    });
    if (score > maxScore) {
      maxScore = score;
      bestPerm = perm;
    }
  });

  const laneMap: Record<number, string> = {};
  laneMap[jungleIdx] = "JUNGLE";
  laneMap[supportIdx] = "SUPPORT";
  laneIndices.forEach((playerIdx, i) => {
    laneMap[playerIdx] = roles[bestPerm[i]];
  });

  return laneMap;
};

export const GET: APIRoute = async () => {
  const lcu = getLockfileData();

  if (!lcu) {
    return new Response(JSON.stringify({ isConnected: false, matches: getFormattedMocks() }), { status: 200 });
  }

  const auth = btoa(`riot:${lcu.token}`);
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json'
  };

  try {
    // 1. Obtener puuid e info del invocador
    const summonerRes = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-summoner/v1/current-summoner`,
      { headers }
    );
    if (!summonerRes.ok) throw new Error("No se pudo obtener el invocador actual");
    const summonerData = await summonerRes.json();
    const puuid = summonerData.puuid;

    // 2. Obtener la versión de juego para Data Dragon
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
      // Ignorado de forma segura, se usará la versión por defecto
    }

    // 3. Obtener 15 partidas
    const historyRes = await fetch(
      `https://127.0.0.1:${lcu.port}/lol-match-history/v1/products/lol/current-summoner/matches`,
      { headers }
    );

    if (!historyRes.ok) {
      throw new Error("No se pudo obtener el historial de partidas");
    }

    const mhData = await historyRes.json();
    if (!mhData || !mhData.games || !mhData.games.games) {
      return new Response(JSON.stringify({ isConnected: true, gameVersion, matches: getFormattedMocks() }), { status: 200 });
    }

    const rawGames = mhData.games.games.slice(0, 15);

    // Fetch full game details for each match in parallel to populate all 10 participants
    const fullGames = await Promise.all(
      rawGames.map(async (g: any) => {
        try {
          const gameRes = await fetch(
            `https://127.0.0.1:${lcu.port}/lol-match-history/v1/games/${g.gameId}`,
            { headers }
          );
          if (gameRes.ok) {
            return await gameRes.json();
          }
        } catch (e) {
          console.error(`Error al obtener detalles de partida ${g.gameId}:`, e);
        }
        return g;
      })
    );

    const parsedMatches = fullGames.map((g: any) => {
      const identity = g.participantIdentities.find(
        (pid: any) => pid.player.puuid === puuid
      );
      const participantId = identity ? identity.participantId : 1;
      const participant = g.participants.find(
        (p: any) => p.participantId === participantId
      );

      const stats = participant ? participant.stats : {
        win: false, kills: 0, deaths: 0, assists: 0,
        totalMinionsKilled: 0, neutralMinionsKilled: 0,
        goldEarned: 0, totalDamageDealtToChampions: 0, visionScore: 0,
        champLevel: 1, item0: 0, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0,
        perk0: 0, perkPrimaryStyle: 0, perkSubStyle: 0
      };

      const win = stats.win || false;
      const kills = stats.kills || 0;
      const deaths = stats.deaths || 0;
      const assists = stats.assists || 0;
      const cs = (stats.totalMinionsKilled || 0) + (stats.neutralMinionsKilled || 0);
      const durationMin = Math.round((g.gameDuration || 1500) / 60);
      const csPerMin = durationMin > 0 ? (cs / durationMin).toFixed(1) : "0.0";

      // 4. Dividir participantes por equipos y asignar carriles usando el helper
      const team1 = g.participants.filter((p: any) => p.teamId === 100);
      const team2 = g.participants.filter((p: any) => p.teamId === 200);

      const team1Lanes = team1.length === 5 ? assignLanesToTeam(team1) : null;
      const team2Lanes = team2.length === 5 ? assignLanesToTeam(team2) : null;

      const getLaneForParticipant = (p: any) => {
        const isTeam1 = p.teamId === 100;
        const teamLanes = isTeam1 ? team1Lanes : team2Lanes;
        if (teamLanes) {
          const team = isTeam1 ? team1 : team2;
          const idx = team.findIndex((x: any) => x.participantId === p.participantId);
          if (idx !== -1 && teamLanes[idx]) {
            return teamLanes[idx];
          }
        }
        
        // Fallback robusto por si no es 5v5
        const pTimeline = p.timeline || {};
        const pRawLane = pTimeline.lane || "NONE";
        const pRawRole = pTimeline.role || "NONE";
        
        let pLane = "MID";
        if (pRawLane === "JUNGLE") {
          pLane = "JUNGLE";
        } else if (pRawLane === "MIDDLE" || pRawLane === "MID") {
          pLane = "MID";
        } else if (pRawLane === "TOP") {
          pLane = "TOP";
        } else if (pRawLane === "BOTTOM" || pRawLane === "BOT") {
          if (pRawRole === "DUO_SUPPORT") {
            pLane = "SUPPORT";
          } else {
            pLane = "ADC";
          }
        } else if (pRawLane === "UTILITY") {
          pLane = "SUPPORT";
        } else {
          const s1 = p.spell1Id || 0;
          const s2 = p.spell2Id || 0;
          if (s1 === 11 || s2 === 11) {
            pLane = "JUNGLE";
          } else {
            const champName = getNameFromId(p.championId || 0);
            if (champName) {
              const specialRoles: Record<string, string> = {
                "Zed": "MID", "Yasuo": "MID", "Ahri": "MID", "Jinx": "ADC", "Lee Sin": "JUNGLE",
                "Lux": "SUPPORT", "Garen": "TOP", "Viego": "JUNGLE", "Yone": "MID", "Aatrox": "TOP",
                "Katarina": "MID", "Akali": "MID", "Thresh": "SUPPORT", "Teemo": "TOP", "Wukong": "JUNGLE",
                "Rek'Sai": "JUNGLE"
              };
              pLane = specialRoles[champName] || "MID";
            }
          }
        }
        return pLane;
      };

      const matchLane = getLaneForParticipant(participant);

      // Organizar los 10 campeones por equipo con sus carriles asignados
      const allies: any[] = [];
      const enemies: any[] = [];
      const localTeamId = participant?.teamId || 100;

      g.participants.forEach((p: any) => {
        const pIdentity = g.participantIdentities.find(
          (pid: any) => pid.participantId === p.participantId
        );
        const sName = pIdentity?.player?.gameName || pIdentity?.player?.displayName || "Invocador";
        
        const playerObj = {
          championId: p.championId,
          summonerName: sName,
          lane: getLaneForParticipant(p)
        };

        if (p.teamId === localTeamId) {
          allies.push(playerObj);
        } else {
          enemies.push(playerObj);
        }
      });

      return {
        gameId: g.gameId,
        gameCreation: g.gameCreation,
        gameDuration: g.gameDuration,
        gameMode: g.gameMode || "CLASSIC",
        queueId: g.queueId,
        win,
        championId: participant?.championId || 238,
        kills,
        deaths,
        assists,
        cs,
        csPerMin,
        level: stats.champLevel || 1,
        gold: stats.goldEarned || 0,
        damage: stats.totalDamageDealtToChampions || 0,
        visionScore: stats.visionScore || 0,
        spells: [participant?.spell1Id || 4, participant?.spell2Id || 14],
        runes: {
          keystone: stats.perk0 || 0,
          primaryStyle: stats.perkPrimaryStyle || 0,
          subStyle: stats.perkSubStyle || 0
        },
        items: [
          stats.item0 || 0,
          stats.item1 || 0,
          stats.item2 || 0,
          stats.item3 || 0,
          stats.item4 || 0,
          stats.item5 || 0,
          stats.item6 || 0 // Trinket slot
        ],
        lane: matchLane,
        allies,
        enemies
      };
    });

    // Guardar partidas en la tabla SQLite player_history para el motor de maestría personal
    try {
      const insertHistoryStmt = db.prepare(`
        INSERT INTO player_history (
          game_id, champion_id, lane, win, kills, deaths, assists, cs_per_min, game_duration, patch, enemy_comp, ally_comp, items_built
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(game_id) DO UPDATE SET
          win=excluded.win,
          kills=excluded.kills,
          deaths=excluded.deaths,
          assists=excluded.assists,
          cs_per_min=excluded.cs_per_min,
          items_built=excluded.items_built
      `);
      
      db.exec('BEGIN TRANSACTION;');
      parsedMatches.forEach((m: any) => {
        const enemyComp = JSON.stringify(m.enemies.map((e: any) => e.championId));
        const allyComp = JSON.stringify(m.allies.map((a: any) => a.championId));
        const itemsBuilt = JSON.stringify(m.items.filter((id: number) => id > 0));

        insertHistoryStmt.run(
          String(m.gameId),
          m.championId,
          m.lane,
          m.win ? 1 : 0,
          m.kills,
          m.deaths,
          m.assists,
          parseFloat(m.csPerMin || '0.0'),
          m.gameDuration,
          gameVersion,
          enemyComp,
          allyComp,
          itemsBuilt
        );
      });
      db.exec('COMMIT;');
      console.log(`Guardadas ${parsedMatches.length} partidas en la tabla player_history de SQLite.`);
    } catch (saveHistoryErr) {
      try { db.exec('ROLLBACK;'); } catch (_) {
        // Ignorado si la transacción ya no está activa
      }
      console.error("Error al guardar partidas en SQLite:", saveHistoryErr);
    }

    return new Response(JSON.stringify({ isConnected: true, gameVersion, matches: parsedMatches }), { status: 200 });

  } catch (e: any) {
    console.error("Error en endpoint /api/history:", e);
    return new Response(JSON.stringify({ isConnected: false, matches: getFormattedMocks(), error: e.message }), { status: 200 });
  }
};
