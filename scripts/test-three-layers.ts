// scripts/test-three-layers.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import https from 'node:https';
import axios from 'axios';
import { performance } from 'node:perf_hooks';
import readline from 'node:readline';

const agent = new https.Agent({ rejectUnauthorized: false });

async function runLayer1() {
  const start = performance.now();
  try {
    const res = await axios.get('https://127.0.0.1:2999/liveclientdata/playerlist', {
      httpsAgent: agent,
      timeout: 2000
    });
    const time = (performance.now() - start).toFixed(2);
    if (res.status === 200 && Array.isArray(res.data)) {
      const names = res.data.map((p: any) => p.summonerName);
      return { time, status: `OK 200 (${names.length} jugadores)`, names };
    }
    return { time, status: `Respuesta vacía`, names: [] };
  } catch (e: any) {
    const time = (performance.now() - start).toFixed(2);
    return { time, status: `Inactivo / Error (${e.message})`, names: [] };
  }
}

async function runLayer2(lcu: any) {
  const start = performance.now();
  if (!lcu) return { time: '0.00', status: 'LCU no detectado', names: [] };
  const auth = btoa(`riot:${lcu.token}`);
  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  try {
    const res = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, {
      headers,
      httpsAgent: agent,
      timeout: 2000
    });
    if (res.status === 200 && res.data?.gameData) {
      const teamOne = res.data.gameData.teamOne || [];
      const teamTwo = res.data.gameData.teamTwo || [];
      const selections = res.data.gameData.playerChampionSelections || [];
      const rawList = (teamOne.length > 0 || teamTwo.length > 0) ? [...teamOne, ...teamTwo] : selections;
      const names: string[] = [];

      for (const p of rawList) {
        let name = p.gameName ? `${p.gameName}#${p.tagLine || 'LAS'}` : (p.summonerName || p.displayName || '');
        if ((!name || name.toLowerCase().startsWith('invocador')) && (p.summonerId || p.puuid)) {
          try {
            const endpoint = p.puuid
              ? `https://127.0.0.1:${lcu.port}/lol-summoner/v2/summoners/puuid/${p.puuid}`
              : `https://127.0.0.1:${lcu.port}/lol-summoner/v1/summoners/${p.summonerId}`;
            const sumRes = await axios.get(endpoint, { headers, httpsAgent: agent, timeout: 1000 });
            if (sumRes.data?.gameName) {
              name = `${sumRes.data.gameName}#${sumRes.data.tagLine || 'LAS'}`;
            }
          } catch (err) {}
        }
        if (name) names.push(name);
      }
      const time = (performance.now() - start).toFixed(2);
      return { time, status: `OK 200 (${names.length} jugadores)`, names };
    }
    const time = (performance.now() - start).toFixed(2);
    return { time, status: 'gameData inactivo', names: [] };
  } catch (e: any) {
    const time = (performance.now() - start).toFixed(2);
    return { time, status: `Inactivo / Error (${e.message})`, names: [] };
  }
}

async function runLayer3(lcu: any) {
  const start = performance.now();
  if (!lcu) return { time: '0.00', status: 'LCU no detectado', names: [] };
  const auth = btoa(`riot:${lcu.token}`);
  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  try {
    const res = await axios.get(`https://127.0.0.1:${lcu.port}/lol-champ-select/v1/session`, {
      headers,
      httpsAgent: agent,
      timeout: 2000
    });
    if (res.status === 200 && res.data?.myTeam) {
      const myTeam = res.data.myTeam || [];
      const theirTeam = res.data.theirTeam || [];
      const rawList = [...myTeam, ...theirTeam];
      const names: string[] = [];

      for (const p of rawList) {
        let name = p.gameName ? `${p.gameName}#${p.tagLine || 'LAS'}` : (p.summonerName || p.displayName || '');
        if ((!name || name.toLowerCase().startsWith('invocador')) && (p.summonerId || p.puuid)) {
          try {
            const endpoint = p.puuid
              ? `https://127.0.0.1:${lcu.port}/lol-summoner/v1/summoners/by-puuid/${p.puuid}`
              : `https://127.0.0.1:${lcu.port}/lol-summoner/v1/summoners/${p.summonerId}`;
            const sumRes = await axios.get(endpoint, { headers, httpsAgent: agent, timeout: 1000 });
            if (sumRes.data?.gameName) {
              name = `${sumRes.data.gameName}#${sumRes.data.tagLine || 'LAS'}`;
            }
          } catch (err) {}
        }
        if (name) names.push(name);
      }
      const time = (performance.now() - start).toFixed(2);
      return { time, status: `OK 200 (${names.length} jugadores)`, names };
    }
    const time = (performance.now() - start).toFixed(2);
    return { time, status: 'ChampSelect inactivo', names: [] };
  } catch (e: any) {
    const time = (performance.now() - start).toFixed(2);
    return { time, status: `Inactivo / Error (${e.message})`, names: [] };
  }
}

async function executeSelection(option: string, loop: boolean) {
  let iteration = 1;

  const runOnce = async () => {
    const timeStr = new Date().toLocaleTimeString();
    const lcu = getLockfileData();
    console.log(`\n===================================================================`);
    console.log(`[ITERACIÓN #${iteration}] Hora: ${timeStr} | Opción: ${option.toUpperCase()}`);
    console.log(`===================================================================`);

    if (option === '1' || option === 'all') {
      const r1 = await runLayer1();
      console.log(`[CAPA 1: Puerto 2999 Live Client Data]: ${r1.status} (${r1.time} ms)`);
      if (r1.names.length > 0) {
        console.log(`  Nombres (${r1.names.length}): ${r1.names.join(', ')}`);
      }
    }

    if (option === '2' || option === 'all') {
      const r2 = await runLayer2(lcu);
      console.log(`[CAPA 2: LCU Gameflow Session (Carga)]: ${r2.status} (${r2.time} ms)`);
      if (r2.names.length > 0) {
        console.log(`  Nombres (${r2.names.length}): ${r2.names.join(', ')}`);
      }
    }

    if (option === '3' || option === 'all') {
      const r3 = await runLayer3(lcu);
      console.log(`[CAPA 3: LCU ChampSelect Session]: ${r3.status} (${r3.time} ms)`);
      if (r3.names.length > 0) {
        console.log(`  Nombres (${r3.names.length}): ${r3.names.join(', ')}`);
      }
    }

    iteration++;
  };

  await runOnce();

  if (loop) {
    console.log(`\n[SONDEO CONTINUO ACTIVADO (Cada 0.5s)] Presiona Ctrl+C para detener.`);
    setInterval(runOnce, 500);
  }
}

function main() {
  const args = process.argv.slice(2);
  let layerArg = '';
  let loopArg = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--layer' && args[i + 1]) {
      layerArg = args[i + 1].toLowerCase();
    }
    if (args[i] === '--loop' || args[i] === '--continuous') {
      loopArg = true;
    }
  }

  if (layerArg) {
    executeSelection(layerArg, loopArg);
    return;
  }

  // Modo Interactivo con Input por Consola
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`===================================================================`);
  console.log(`[MENÚ DE PRUEBA DE CAPAS LCU & PUERTO 2999]`);
  console.log(`===================================================================`);
  console.log(`Elige una opción:`);
  console.log(`  [1] Capa 1: Puerto 2999 Live Client Data (In-Game)`);
  console.log(`  [2] Capa 2: LCU Gameflow Session (Pantalla de Carga)`);
  console.log(`  [3] Capa 3: LCU ChampSelect Session (Selección de Campeones)`);
  console.log(`  [4] Todas las capas (1, 2 y 3)`);

  rl.question(`\nIngresa tu opción (1, 2, 3 o 4): `, (optAnswer) => {
    const option = optAnswer.trim() === '4' ? 'all' : optAnswer.trim();

    rl.question(`¿Ejecutar en bucle continuo cada 0.5 segundos? (s/n): `, (loopAnswer) => {
      const loop = loopAnswer.toLowerCase().startsWith('s');
      rl.close();
      executeSelection(option, loop);
    });
  });
}

main();
