// scripts/test-player-selections.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import https from 'node:https';
import axios from 'axios';

const agent = new https.Agent({ rejectUnauthorized: false });

async function testPlayerSelections() {
  const lcu = getLockfileData();
  if (!lcu) return;

  const auth = btoa(`riot:${lcu.token}`);
  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  try {
    const res = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, {
      headers,
      httpsAgent: agent,
      timeout: 3000
    });

    const selections = res.data?.gameData?.playerChampionSelections || [];
    console.log(`[playerChampionSelections count]: ${selections.length}`);

    const resolvedNames: string[] = [];

    for (let i = 0; i < selections.length; i++) {
      const p = selections[i];
      let name = '';

      if (p.summonerId || p.puuid) {
        try {
          const endpoint = p.puuid
            ? `https://127.0.0.1:${lcu.port}/lol-summoner/v1/summoners/by-puuid/${p.puuid}`
            : `https://127.0.0.1:${lcu.port}/lol-summoner/v1/summoners/${p.summonerId}`;
          const sumRes = await axios.get(endpoint, { headers, httpsAgent: agent, timeout: 1500 });
          const d = sumRes.data;
          if (d.gameName) {
            name = `${d.gameName}#${d.tagLine || 'LAS'}`;
          } else if (d.displayName) {
            name = d.displayName;
          }
        } catch (err: any) {
          console.error(`Error al resolver jugador [${i}]:`, err.message);
        }
      }

      console.log(`Jugador [${i + 1}/${selections.length}] (ChampID: ${p.championId}, Pos: ${p.selectedPosition}) -> Resuelto: "${name}"`);
      if (name) resolvedNames.push(name);
    }

    console.log(`\nTotal de Nombres Resueltos Exitosamente: ${resolvedNames.length}`);
    console.log(resolvedNames);

  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

testPlayerSelections();
