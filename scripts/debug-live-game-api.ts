// scripts/debug-live-game-api.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import https from 'node:https';
import axios from 'axios';

const agent = new https.Agent({ rejectUnauthorized: false });

async function debugLiveGame() {
  console.log("===================================================================");
  console.log("[DIAGNÓSTICO DE PANTALLA DE CARGA / API LIVE-GAME]");
  console.log("===================================================================");

  const lcu = getLockfileData();
  console.log("LCU Lockfile detectado:", lcu ? `SI (Port: ${lcu.port})` : "NO");

  if (!lcu) return;

  const auth = btoa(`riot:${lcu.token}`);
  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  // 1. Probar Puerto 2999
  try {
    const res1 = await axios.get('https://127.0.0.1:2999/liveclientdata/playerlist', { httpsAgent: agent, timeout: 2000 });
    console.log(`\n[Puerto 2999 In-Game]: OK 200 (${res1.data?.length || 0} jugadores)`);
  } catch (e: any) {
    console.log(`\n[Puerto 2999 In-Game]: Inactivo (${e.message})`);
  }

  // 2. Probar Gameflow Session
  try {
    const res2 = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, { headers, httpsAgent: agent, timeout: 2000 });
    console.log(`\n[LCU Gameflow Session]: Status ${res2.status}`);
    console.log("Phase:", res2.data?.phase);
    console.log("gameData.teamOne count:", res2.data?.gameData?.teamOne?.length || 0);
    console.log("gameData.teamTwo count:", res2.data?.gameData?.teamTwo?.length || 0);
    console.log("playerChampionSelections count:", res2.data?.gameData?.playerChampionSelections?.length || 0);
  } catch (e: any) {
    console.log(`\n[LCU Gameflow Session]: Error (${e.message})`);
  }

  // 3. Probar ChampSelect Session
  try {
    const res3 = await axios.get(`https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`, { headers, httpsAgent: agent, timeout: 2000 });
    console.log(`\n[LCU ChampSelect Session]: Status ${res3.status}`);
    console.log("myTeam count:", res3.data?.myTeam?.length || 0);
    console.log("theirTeam count:", res3.data?.theirTeam?.length || 0);
  } catch (e: any) {
    console.log(`\n[LCU ChampSelect Session]: Error (${e.message})`);
  }
}

debugLiveGame();
