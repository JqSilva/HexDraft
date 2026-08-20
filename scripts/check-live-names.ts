// scripts/check-live-names.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import { scrapeOpggProfile } from '../src/lib/services/opgg.service.js';
import { getNameFromId } from '../src/lib/engine/core/constants.js';
import https from 'node:https';
import axios from 'axios';

const agent = new https.Agent({ rejectUnauthorized: false });

async function checkLiveNames() {
  console.log(`===================================================================`);
  console.log(`[PRUEBA DE RESOLUCIÓN DE NOMBRES EN VIVO & SCRAPING OP.GG]`);
  console.log(`===================================================================\n`);

  let participantsRaw: any[] = [];
  let source = '';

  // 1. Intentar consultar el Puerto Local 2999 (Live Client Data Directo del juego)
  try {
    const port2999Res = await axios.get('https://127.0.0.1:2999/liveclientdata/playerlist', {
      httpsAgent: agent,
      timeout: 2000
    });
    if (port2999Res.status === 200 && Array.isArray(port2999Res.data) && port2999Res.data.length > 0) {
      source = 'Puerto 2999 Live Client Data (Partida In-Game)';
      participantsRaw = port2999Res.data.map(p => ({
        summonerName: p.summonerName,
        gameName: p.summonerName.includes('#') ? p.summonerName.split('#')[0] : p.summonerName,
        tagLine: p.summonerName.includes('#') ? p.summonerName.split('#')[1] : 'LAS',
        championName: p.championName,
        teamId: p.team === 'ORDER' ? 100 : 200,
        assignedPosition: p.position || ''
      }));
    }
  } catch (e) {}

  // 2. Si el puerto 2999 no respondió, intentar vía LCU Lockfile
  const lcu = getLockfileData();
  if (participantsRaw.length === 0 && lcu) {
    console.log(`[LCU CONECTADO] Puerto: ${lcu.port} | Protocolo: ${lcu.protocol}`);
    const auth = btoa(`riot:${lcu.token}`);
    const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

    // A. Intentar Gameflow Session (Pantalla de Carga / In-Game)
    try {
      const gfRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, { headers, httpsAgent: agent });
      if (gfRes.status === 200 && gfRes.data?.gameData) {
        const teamOne = gfRes.data.gameData.teamOne || [];
        const teamTwo = gfRes.data.gameData.teamTwo || [];
        if (teamOne.length > 0 || teamTwo.length > 0) {
          source = 'Gameflow Session (/lol-gameflow/v1/session - Pantalla de Carga)';
          participantsRaw = [
            ...teamOne.map((p: any) => ({ ...p, teamId: 100 })),
            ...teamTwo.map((p: any) => ({ ...p, teamId: 200 }))
          ];
        }
      }
    } catch (e) {}

    // B. Intentar ChampSelect (Selección de Campeones)
    if (participantsRaw.length === 0) {
      try {
        const draftRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`, { headers, httpsAgent: agent });
        if (draftRes.status === 200 && draftRes.data?.myTeam?.length > 0) {
          source = 'ChampSelect (/lol-champ-select/v1/session)';
          const myTeam = (draftRes.data.myTeam || []).map((p: any) => ({ ...p, teamId: 100 }));
          const theirTeam = (draftRes.data.theirTeam || []).map((p: any) => ({ ...p, teamId: 200 }));
          participantsRaw = [...myTeam, ...theirTeam];
        }
      } catch (e) {}
    }
  }

  if (participantsRaw.length === 0) {
    console.log(`[!] No se pudieron detectar participantes ni por el Puerto 2999 ni por LCU.`);
    return;
  }

  console.log(`[PARTIDA DETECTADA CORRECAMENTE] Fuente: ${source}`);
  console.log(`Total de participantes encontrados: ${participantsRaw.length}\n`);

  console.log(`-------------------------------------------------------------------`);
  console.log(`RESOLVIENDO JUGADORES Y CONSULTANDO OP.GG...`);
  console.log(`-------------------------------------------------------------------\n`);

  for (let i = 0; i < participantsRaw.length; i++) {
    const p = participantsRaw[i];
    let rawName = p.gameName || p.summonerName || p.displayName || '';
    let rawTag = p.tagLine || p.riotIdTag || '';

    if (!rawName && p.riotId && p.riotId.includes('#')) {
      const parts = p.riotId.split('#');
      rawName = parts[0];
      rawTag = parts[1] || '';
    }

    if (!rawTag) rawTag = 'LAS';

    const champName = p.championName || getNameFromId(p.championId || p.championPickIntent || 0) || 'Sin Campeón';
    const teamName = p.teamId === 100 ? 'AZUL' : 'ROJO';

    console.log(`[Jugador ${i + 1}/${participantsRaw.length}] [Equipo ${teamName}] Campeón: ${champName}`);
    console.log(`  Riot ID Resuelto: "${rawName}#${rawTag}"`);

    // Probar scraping OP.GG
    const profile = await scrapeOpggProfile(rawName, rawTag, 'las', p.championId || 0);
    console.log(`  Resultado OP.GG:`);
    console.log(`    - Rango SoloQ: ${profile.ranked.tier} ${profile.ranked.division} (${profile.ranked.lp} LP) - Winrate: ${profile.ranked.winrate}%`);
    console.log(`    - Streamer Mode: ${profile.isStreamerMode}`);
    console.log(`    - Tags Generados: [${profile.tags.join(', ')}]`);
    console.log(`-------------------------------------------------------------------`);
  }
}

checkLiveNames();
