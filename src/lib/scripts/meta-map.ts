import axios from 'axios';
import fs from 'fs';
import path from 'path';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';

function extractJsonFromHtml(htmlOrJson: string | any): any {
  if (typeof htmlOrJson === 'object') return htmlOrJson;
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
    return response.data.solution.response;
  }
  throw new Error(`FlareSolverr falló con estado: ${response.data?.status}`);
}

export async function SyncEstructuraLanes(
    version: string,
    checkAbort: () => boolean,
    writeLog: (msg: string) => void,
    onProgress?: (current: number, total: number, phase: 'lanes' | 'done') => void
) {
    writeLog("🐘 INICIANDO CICLO LARGO - Análisis Estructural");
    onProgress?.(1, 10, 'lanes');

    try {
        if (checkAbort()) {
            writeLog("🛑 CANCELACIÓN DETECTADA. Deteniendo...");
            return;
        }
        // --- PARTE 1: ACTUALIZAR BD DIRECTAMENTE ---
        writeLog("📡 Sincronizando Carriles en la Base de Datos...");
        onProgress?.(3, 10, 'lanes');

        const url = `https://dpm.lol/v1/tierlist?tier=diamond&timeframe=${version}&gameMode=ranked`;
        const responseHtml = await fetchWithFlareSolverr(url);
        const tierData = extractJsonFromHtml(responseHtml);

        onProgress?.(7, 10, 'lanes');
        
        const { championsRepo } = await import('../db/champions.repo.js');
        const { db } = await import('../db/sqlite.js');
        const nameIdMap = championsRepo.getChampionIdNameMap();

        db.exec('BEGIN TRANSACTION;');
        try {
            const updateStmt = db.prepare('UPDATE champions SET lane = ? WHERE id = ?');
            let updatedCount = 0;

            tierData.champions.forEach((c: any) => {
                const normName = c.championName.toLowerCase().replace(/[^a-z0-9]/g, "");
                const champId = nameIdMap[normName];
                if (champId) {
                    const lanes = Object.entries(c.lanesPickrate)
                        .filter(([_, rate]) => (rate as number) > 40.0)
                        .map(([lane]) => lane);
                    if (lanes.length === 0) {
                        const best = Object.entries(c.lanesPickrate).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0];
                        lanes.push(best);
                    }
                    const primaryLane = lanes[0]?.toUpperCase();
                    if (primaryLane) {
                        updateStmt.run(primaryLane, champId);
                        updatedCount++;
                    }
                }
            });

            db.exec('COMMIT;');
            writeLog(`✅ Carriles actualizados directamente en base de datos: ${updatedCount} campeones.`);
        } catch (err: any) {
            db.exec('ROLLBACK;');
            writeLog(`❌ Error al actualizar base de datos con carriles: ${err.message || err}`);
            throw err;
        }
        onProgress?.(9, 10, 'lanes');
        
        try {
            const { configRepo } = await import('../db/config.repo.js');
            configRepo.setConfig('last_lane_sync_timestamp', new Date().toISOString());
        } catch (e) {
            // Ignorado de forma segura si falla al persistir el timestamp de actualización
        }
        onProgress?.(10, 10, 'done');
    } catch (err: any) {
        writeLog(`❌ Error en SyncEstructuraLanes: ${err.message || err}`);
        throw err;
    }
}