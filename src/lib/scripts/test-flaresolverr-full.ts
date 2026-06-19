// src/lib/scripts/test-flaresolverr-full.ts
import { db } from '../db/sqlite.js';
import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const CONCURRENCY = 4; // Ajusta según la capacidad de tu red/PC y para no saturar FlareSolverr
const VERSION_PATCH = '16.12'; // Parche de ejemplo para test

const API_NAME_MAP: Record<string, string> = {
  "Wukong": "MonkeyKing",
  "Maestro Yi": "MasterYi",
  "Nunu y Willump": "Nunu",
  "Renata Glasc": "Renata",
  "Bardo": "Bard",
  "Kha'Zix": "Khazix",
  "Kai'Sa": "Kaisa",
  "Bel'Veth": "Belveth",
  "Rek'Sai": "RekSai",
  "Vel'Koz": "Velkoz",
  "Cho'Gath": "Chogath",
  "Dr. Mundo": "DrMundo",
  "K'Sante": "KSante",
  "Kog'Maw": "KogMaw",
  "Jarvan IV": "JarvanIV",
  "Lee Sin": "LeeSin",
  "Miss Fortune": "MissFortune",
  "Master Yi": "MasterYi",
  "Twisted Fate": "TwistedFate",
  "Xin Zhao": "XinZhao"
};

function extractJsonFromHtml(htmlOrJson: string): any {
  try {
    return JSON.parse(htmlOrJson);
  } catch (e) {
    const preMatch = htmlOrJson.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch && preMatch[1]) {
      return JSON.parse(preMatch[1].trim());
    }
    const bodyMatch = htmlOrJson.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      const text = bodyMatch[1].replace(/<[^>]*>/g, '').trim();
      return JSON.parse(text);
    }
    throw new Error("No se pudo extraer JSON puro de la respuesta de FlareSolverr.");
  }
}

async function fetchWithFlareSolverr(url: string): Promise<any> {
  const response = await axios.post(FLARESOLVERR_URL, {
    cmd: "request.get",
    url: url,
    maxTimeout: 60000
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 70000
  });

  if (response.data && response.data.status === 'ok') {
    return extractJsonFromHtml(response.data.solution.response);
  }
  throw new Error(`FlareSolverr falló con estado: ${response.data?.status}`);
}

async function runFullSimulation() {
  console.log("🚀 [TEST] Iniciando simulación completa de sincronización con FlareSolverr...");
  console.log(`📡 URL de FlareSolverr: ${FLARESOLVERR_URL}`);
  console.log(`⚡ Concurrencia de trabajadores: ${CONCURRENCY}`);

  // 1. Obtener lista de campeones y sus carriles de SQLite
  let rows: any[] = [];
  try {
    rows = db.prepare('SELECT name, play_lanes, lane FROM champions').all() as any[];
  } catch (e: any) {
    console.error("❌ Error leyendo la tabla de campeones de SQLite:", e.message);
    process.exit(1);
  }

  // 2. Construir lista de tareas individuales (campeón + línea)
  const tasks: Array<{ name: string; lane: string }> = [];
  for (const row of rows) {
    const playLanes = JSON.parse(row.play_lanes || '[]');
    if (playLanes.length === 0 && row.lane && row.lane !== 'UNKNOWN') {
      playLanes.push(row.lane);
    }
    for (const lane of playLanes) {
      if (lane && lane !== 'UNKNOWN') {
        tasks.push({ name: row.name, lane });
      }
    }
  }

  const totalTasks = tasks.length;
  console.log(`📦 Encontradas ${totalTasks} consultas totales (campeón + carril) para realizar.`);
  
  if (totalTasks === 0) {
    console.log("⚠️ No hay tareas válidas. Asegúrate de tener campeones en SQLite.");
    process.exit(0);
  }

  let index = 0;
  let successCount = 0;
  let failCount = 0;
  const auditData: Record<string, any> = {};

  const startTime = performance.now();

  // 3. Cola concurrente de trabajadores
  const worker = async (workerId: number) => {
    while (index < tasks.length) {
      const task = tasks[index++];
      if (!task) break;

      const { name, lane } = task;
      const internalName = API_NAME_MAP[name] || name;
      const urlName = internalName.replace(/[^a-zA-Z0-9]/g, "");
      const dpmLane = lane.toLowerCase();
      const url = `https://dpm.lol/v1/builds/${urlName}?lane=${dpmLane}&tier=emerald_plus&timeframe=${VERSION_PATCH}&gameMode=ranked`;

      console.log(`[W-${workerId}] [${index}/${totalTasks}] Descargando: ${name} (${lane})`);

      try {
        const data = await fetchWithFlareSolverr(url);
        if (data && data.runes) {
          successCount++;
          // Guardar reporte detallado por carril para cada campeón
          if (!auditData[name]) {
            auditData[name] = {
              lanes: {}
            };
          }
          auditData[name].lanes[lane] = {
            runesFound: !!data.runes,
            startItemsFound: !!data.startItems,
            coreBuildsFound: !!data.coreBuilds,
            enemyMatchupsCount: data.enemyMatchups ? Object.keys(data.enemyMatchups).length : 0,
            allyMatchupsCount: data.allyMatchups ? Object.keys(data.allyMatchups).length : 0
          };
        } else {
          console.warn(`⚠️  [W-${workerId}] Respuesta incompleta de dpm.lol para ${name} en ${lane}`);
          failCount++;
        }
      } catch (err: any) {
        console.error(`❌ [W-${workerId}] Error procesando ${name} en ${lane}: ${err.message}`);
        failCount++;
      }

      // Delay de cortesía corto para no saturar FlareSolverr/dpm.lol
      await new Promise(r => setTimeout(r, 800));
    }
  };

  // 4. Lanzar trabajadores en paralelo
  const workers = Array.from({ length: CONCURRENCY }).map((_, i) => worker(i + 1));
  await Promise.all(workers);

  const endTime = performance.now();
  const totalTimeSeconds = ((endTime - startTime) / 1000).toFixed(2);
  const avgTimePerRequest = (parseFloat(totalTimeSeconds) / (successCount + failCount || 1)).toFixed(2);

  console.log("\n==========================================");
  console.log("🏁 SIMULACIÓN FINALIZADA");
  console.log(`⏱️  Tiempo Total Transcurrido: ${totalTimeSeconds} segundos`);
  console.log(`📊 Peticiones exitosas: ${successCount}`);
  console.log(`💥 Peticiones fallidas/errores: ${failCount}`);
  console.log(`⏱️  Tiempo promedio por petición: ${avgTimePerRequest} segundos`);
  console.log("==========================================\n");

  // Guardar reporte de auditoría de los datos obtenidos
  const auditPath = path.resolve(process.cwd(), 'src/lib/data/flaresolverr-test-audit.json');
  fs.writeFileSync(auditPath, JSON.stringify({
    stats: {
      totalTimeSeconds: parseFloat(totalTimeSeconds),
      successCount,
      failCount,
      avgTimePerRequest: parseFloat(avgTimePerRequest)
    },
    sampleData: auditData
  }, null, 2));

  console.log(`💾 Auditoría de datos guardada en: ${auditPath}`);
}

runFullSimulation()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error en simulación:", err);
    process.exit(1);
  });
