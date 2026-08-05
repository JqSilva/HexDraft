// scripts/test-lcu-summoner-endpoints.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import https from 'node:https';
import axios from 'axios';

const agent = new https.Agent({ rejectUnauthorized: false });

async function testEndpoints() {
  const lcu = getLockfileData();
  if (!lcu) return;

  const auth = btoa(`riot:${lcu.token}`);
  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  // Obtener playerChampionSelections del gameflow
  try {
    const gfRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, { headers, httpsAgent: agent });
    const selections = gfRes.data?.gameData?.playerChampionSelections || [];

    if (selections.length === 0) {
      console.log("No hay playerChampionSelections.");
      return;
    }

    const testP = selections[0];
    console.log("Muestra de Jugador en playerChampionSelections:", testP);

    // Probar endpoints posibles:
    const endpointsToTest = [
      `/lol-summoner/v1/summoners/${testP.summonerId}`,
      `/lol-summoner/v2/summoners/puuid/${testP.puuid}`,
      `/lol-summoner/v1/summoners/by-puuid/${testP.puuid}`,
      `/lol-summoner/v1/summoners/puuid/${testP.puuid}`,
      `/lol-champ-select/v1/summoners/${testP.slotId || 0}`
    ];

    for (const ep of endpointsToTest) {
      const url = `https://127.0.0.1:${lcu.port}${ep}`;
      try {
        const r = await axios.get(url, { headers, httpsAgent: agent, timeout: 1500 });
        console.log(`\n[OK 200] ${ep}:`);
        console.log(JSON.stringify(r.data, null, 2));
      } catch (e: any) {
        console.log(`[${e.response?.status || 'Error'}] ${ep}: ${e.message}`);
      }
    }

  } catch (e: any) {
    console.error(e.message);
  }
}

testEndpoints();
