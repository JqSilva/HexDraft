// scripts/find-summoner-lcu.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import https from 'node:https';
import axios from 'axios';

const agent = new https.Agent({ rejectUnauthorized: false });

async function testSummoners() {
  const lcu = getLockfileData();
  if (!lcu) return;

  const auth = btoa(`riot:${lcu.token}`);
  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  const gfRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, { headers, httpsAgent: agent });
  const selections = gfRes.data?.gameData?.playerChampionSelections || [];

  for (let i = 0; i < selections.length; i++) {
    const p = selections[i];
    console.log(`\n--- Jugador [${i + 1}] (summonerId: ${p.summonerId}, puuid: ${p.puuid}) ---`);
    if (p.summonerId) {
      try {
        const sRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-summoner/v1/summoners/${p.summonerId}`, { headers, httpsAgent: agent });
        console.log(`  v1/summoners/${p.summonerId} -> gameName: "${sRes.data?.gameName}", tagLine: "${sRes.data?.tagLine}", displayName: "${sRes.data?.displayName}"`);
      } catch (e: any) {
        console.log(`  v1/summoners/${p.summonerId} -> Status: ${e.response?.status || e.message}`);
      }
    }
    if (p.puuid) {
      try {
        const pRes = await axios.get(`https://127.0.0.1:${lcu.port}/lol-summoner/v2/summoners/puuid/${p.puuid}`, { headers, httpsAgent: agent });
        console.log(`  v2/summoners/puuid/${p.puuid} -> gameName: "${pRes.data?.gameName}", tagLine: "${pRes.data?.tagLine}", displayName: "${pRes.data?.displayName}"`);
      } catch (e: any) {
        console.log(`  v2/summoners/puuid/${p.puuid} -> Status: ${e.response?.status || e.message}`);
      }
    }
  }
}

testSummoners();
