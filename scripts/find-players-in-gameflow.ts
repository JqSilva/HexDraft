// scripts/find-players-in-gameflow.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import https from 'node:https';
import axios from 'axios';

const agent = new https.Agent({ rejectUnauthorized: false });

async function findPlayers() {
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

    const data = res.data;
    console.log("Phase:", data.phase);
    console.log("Keys en la raiz de session:", Object.keys(data));

    if (data.gameData) {
      console.log("Keys en gameData:", Object.keys(data.gameData));
      console.log("gameData.playerChampionSelections:", JSON.stringify(data.gameData.playerChampionSelections, null, 2));
      console.log("gameData.teamOne:", JSON.stringify(data.gameData.teamOne, null, 2));
      console.log("gameData.teamTwo:", JSON.stringify(data.gameData.teamTwo, null, 2));
    }

  } catch (e: any) {
    console.error(e.message);
  }
}

findPlayers();
