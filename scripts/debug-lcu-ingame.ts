// scripts/debug-lcu-ingame.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import https from 'node:https';
import axios from 'axios';

// Agente HTTPS que ignora certificados SSL autofirmados de Riot y Puerto 2999
const agent = new https.Agent({ rejectUnauthorized: false });

async function debugInGame() {
  console.log(`===================================================================`);
  console.log(`[DIAGNÓSTICO EN VIVO: LCU Y PUERTO 2999 (LIVE CLIENT DATA)]`);
  console.log(`===================================================================\n`);

  const lcu = getLockfileData();
  if (lcu) {
    console.log(`[1] LCU LOCKFILE DETECTADO`);
    console.log(`    Puerto: ${lcu.port} | Token: ${lcu.token.slice(0, 5)}...`);

    const auth = btoa(`riot:${lcu.token}`);
    const lcuHeaders = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

    // A. Consultar /lol-gameflow/v1/gameflow-phase
    try {
      const phaseRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/gameflow-phase`, { headers: lcuHeaders, httpsAgent: agent });
      console.log(`    Fase Gameflow: "${phaseRes.data}"`);
    } catch (e: any) {
      console.log(`    Error consultando gameflow-phase: ${e.message}`);
    }

    // B. Consultar /lol-gameflow/v1/session
    try {
      const sessionRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, { headers: lcuHeaders, httpsAgent: agent });
      console.log(`    /lol-gameflow/v1/session HTTP Status: ${sessionRes.status}`);
      const data = sessionRes.data;
      console.log(`    Keys en session: ${Object.keys(data).join(', ')}`);
      if (data.gameData) {
        console.log(`    Keys en session.gameData: ${Object.keys(data.gameData).join(', ')}`);
        console.log(`    teamOne count: ${data.gameData.teamOne?.length || 0}`);
        console.log(`    teamTwo count: ${data.gameData.teamTwo?.length || 0}`);
        console.log(`    playerChampionSelections:`, data.gameData.playerChampionSelections);
      }
    } catch (e: any) {
      console.log(`    Error consultando session: ${e.message}`);
    }

    // C. Consultar /lol-champ-select/v1/session
    try {
      const draftRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`, { headers: lcuHeaders, httpsAgent: agent });
      console.log(`    /lol-champ-select/v1/session HTTP Status: ${draftRes.status}`);
      console.log(`    myTeam count: ${draftRes.data?.myTeam?.length || 0}`);
      console.log(`    theirTeam count: ${draftRes.data?.theirTeam?.length || 0}`);
    } catch (e: any) {
      console.log(`    ChampSelect no activo o error: ${e.message}`);
    }
  } else {
    console.log(`[!] LCU lockfile no detectado.`);
  }

  // 2. PROBAR PUERTO 2999 (Live Client Data Directo del Proceso League of Legends.exe)
  console.log(`\n-------------------------------------------------------------------`);
  console.log(`[2] PROBANDO PUERTO LOCAL 2999 (https://127.0.0.1:2999/liveclientdata/allgamedata)`);
  console.log(`-------------------------------------------------------------------`);

  try {
    const liveRes = await axios.get(`https://127.0.0.1:2999/liveclientdata/allgamedata`, {
      httpsAgent: agent,
      timeout: 3000
    });

    console.log(`[PUERTO 2999 RESPODIÓ OK] Status: ${liveRes.status}`);
    const allPlayers = liveRes.data?.allPlayers || [];
    console.log(`Total de Invocadores en allPlayers: ${allPlayers.length}`);

    allPlayers.forEach((p: any, idx: number) => {
      console.log(`  [${idx + 1}] ${p.summonerName} (Campeón: ${p.championName}, Equipo: ${p.team})`);
    });

  } catch (e: any) {
    console.log(`[PUERTO 2999 NO DISPONIBLE]: ${e.message}`);
  }
}

debugInGame();
