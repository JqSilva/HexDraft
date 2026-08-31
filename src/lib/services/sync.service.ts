// src/lib/services/sync.service.ts
import fs from 'node:fs';
import path from 'node:path';
import { db as dbInstance } from '../db/sqlite.js';
import { championsRepo } from '../db/champions.repo.js';
import { configRepo } from '../db/config.repo.js';
import { CHAMPIONS_DB } from '../data/championdb.js';
import { getPathsForBuild } from '../engine/itemEngine.js';
import { syncItemsFromCommunityDragon } from '../scripts/sync-items.js';
import { syncRunesFromCommunityDragon } from '../scripts/sync-runes.js';
import { syncChampionsSemanticData } from '../scripts/sync-champions-cdrag.js';
import { API_NAME_MAP, NORM_API_NAME_MAP, normalizeKey, resolveChampionId } from '../domain/champion-name-resolver.js';
import { getStyleOfRune } from '../domain/rune-style-map.js';
import { createFlareSolverrSession, destroyFlareSolverrSession } from '../sources/flaresolverr.source.js';
import { fetchOpggMetaByPosition } from '../sources/opgg-meta.source.js';

import { getChampionPlayLanes, scrapeSingleChampion, scrapeSingleChampionLane } from '../sync/scrape-champion.js';
import { buildChampionRecord } from '../sync/build-champion-record.js';

export { scrapeSingleChampion, buildChampionRecord };

// --- SERVICIO DE SINCRONIZACIÓN GENERAL ---
export async function syncMetaCacheOnly(writeLog: (msg: string) => void): Promise<void> {
  const cachePath = './src/lib/data/meta-cache.json';
  const nameIdMap = championsRepo.getChampionIdNameMap();
  const roles = ['top', 'jungle', 'mid', 'adc', 'support'];
  const metaCache: Record<string, any[]> = {};

  writeLog(`[OPGG-SYNC] Iniciando actualizacion ligera del meta...`);

  for (const role of roles) {
    writeLog(`[OPGG-SYNC] Scrapeando: ${role}`);
    try {
      metaCache[role] = await fetchOpggMetaByPosition(role);
    } catch (e: any) {
      writeLog(`Error OP.GG ${role}: ${e.message || e}`);
    }
  }

  try {
    fs.writeFileSync(cachePath, JSON.stringify(metaCache, null, 2));
  } catch (err) {
    writeLog(`[OPGG-SYNC] Error escribiendo cache: ${err}`);
  }

  // Guardar Tiers y Winrates actualizados en SQLite (OP.GG)
  writeLog("[OPGG-SYNC] Sincronizando tiers y winrates con SQLite...");
  
  const roleToLaneMap: Record<string, string> = {
    'top': 'TOP',
    'jungle': 'JUNGLE',
    'mid': 'MIDDLE',
    'adc': 'BOTTOM',
    'support': 'UTILITY'
  };

  const champMetaStats: Record<number, Array<{ role: string; rank: string; winRate: string; pickRate: string }>> = {};

  Object.keys(metaCache).forEach(role => {
    const list = metaCache[role] || [];
    list.forEach((metaChamp: any) => {
      const champId = resolveChampionId(metaChamp.name, nameIdMap);
      if (!champId) return;
      if (!champMetaStats[champId]) {
        champMetaStats[champId] = [];
      }
      champMetaStats[champId].push({
        role,
        rank: metaChamp.rank,
        winRate: metaChamp.winRate,
        pickRate: metaChamp.pickRate
      });
    });
  });

  Object.keys(champMetaStats).forEach(idStr => {
    const champId = Number(idStr);
    const statsList = champMetaStats[champId];
    if (statsList.length === 0) return;

    const parsePickRate = (pr: string) => parseFloat(pr.replace('%', '')) || 0.0;
    
    let bestStat = statsList[0];
    let maxPick = parsePickRate(bestStat.pickRate);

    for (let i = 1; i < statsList.length; i++) {
      const pr = parsePickRate(statsList[i].pickRate);
      if (pr > maxPick) {
        maxPick = pr;
        bestStat = statsList[i];
      }
    }

     let totalPickRate = 0;
     statsList.forEach(s => {
       totalPickRate += parsePickRate(s.pickRate);
     });
 
     const distribution: Record<string, number> = {};
     const lanesStats: Record<string, { tier: number, winRate: number }> = {};
     statsList.forEach(s => {
       const laneKey = roleToLaneMap[s.role];
       if (laneKey && totalPickRate > 0) {
         const relativeRate = (parsePickRate(s.pickRate) / totalPickRate) * 100;
         distribution[laneKey] = parseFloat(relativeRate.toFixed(1));
         lanesStats[laneKey] = {
           tier: parseInt(s.rank) || 99,
           winRate: parseFloat(s.winRate) || 50.0
         };
       }
     });
 
     const playLanes = Object.entries(distribution)
       .filter(([_, relRate]) => relRate > 5.0)
       .map(([lane]) => lane);
 
     if (playLanes.length === 0 && Object.keys(distribution).length > 0) {
       const bestLane = Object.entries(distribution).reduce((a, b) => a[1] > b[1] ? a : b)[0];
       playLanes.push(bestLane);
     }
 
     const baseChamp = CHAMPIONS_DB[champId];
     if (!baseChamp) return;

     const currentChampStmt = dbInstance.prepare('SELECT lane, scaling_type FROM champions WHERE id = ?');
     const current = currentChampStmt.get(champId) as any;
 
     const primaryLane = roleToLaneMap[bestStat.role] || "UNKNOWN";
 
     championsRepo.saveChampion({
       id: champId,
       name: baseChamp.name,
       lane: primaryLane,
       tier: parseInt(bestStat.rank) || 99,
       win_rate: parseFloat(bestStat.winRate) || 50.0,
       scaling_type: current?.scaling_type || "Mid",
       damage_type: baseChamp.damageType || "Adaptive",
       class: baseChamp.class || "Unknown",
       is_frontline: baseChamp.isFrontline ? 1 : 0,
       is_hypercarry: baseChamp.isHypercarry ? 1 : 0,
       has_hard_cc: baseChamp.hasHardCC ? 1 : 0,
       tags: JSON.stringify(baseChamp.tags || []),
       play_lanes: JSON.stringify(playLanes),
       lanes_pickrate: JSON.stringify(distribution),
       lanes_stats: JSON.stringify(lanesStats)
     });
  });

  try {
    configRepo.setConfig('last_meta_cache_sync', new Date().toISOString());
  } catch (err) {
    writeLog(`[OPGG-SYNC] Error guardando last_meta_cache_sync: ${err}`);
  }

  writeLog(`[OPGG-SYNC] Actualizacion del meta finalizada.`);
}

export async function syncMetaAndBuilds(
  version: string,
  checkAbort: () => boolean,
  writeLog: (msg: string) => void,
  onProgress?: (current: number, total: number, phase: 'opgg' | 'puppeteer' | 'done') => void
): Promise<string> {
  const nameIdMap = championsRepo.getChampionIdNameMap();
  const nameMap = championsRepo.getChampionNameIdMap();
  const champions = Object.values(nameMap); // Obtener todos los campeones de SQLite para soportar nuevos campeones

  writeLog(`[SYNC] Iniciando sincronizacion general - Parche: ${version}`);

  // --- PARTE 0: Sincronizar catálogo de items desde Community Dragon ---
  try {
    writeLog("[SYNC] Sincronizando catalogo de items desde Community Dragon...");
    const itemsCount = await syncItemsFromCommunityDragon();
    writeLog(`[OK] Catalogo de items actualizado (${itemsCount} items)`);
  } catch (e: any) {
    writeLog(`[WARN] Error al sincronizar items desde Community Dragon: ${e.message || e}`);
  }

  // --- PARTE 0.5: Sincronizar runas y shards desde Community Dragon ---
  try {
    writeLog("[SYNC] Sincronizando runas y shards desde Community Dragon...");
    const runesResult = await syncRunesFromCommunityDragon();
    writeLog(`[OK] Runas actualizadas (${runesResult.runesCount} runas, ${runesResult.shardsCount} shards, ${runesResult.runeToStyleCount} mappings)`);
  } catch (e: any) {
    writeLog(`[WARN] Error al sincronizar runas desde Community Dragon: ${e.message || e}`);
  }

  // --- PARTE 1: OP.GG (Sin Puppeteer - Rápido) ---
  onProgress?.(0, 5, 'opgg');
  await syncMetaCacheOnly(writeLog);
  onProgress?.(5, 5, 'opgg');

  // El workflow de GitHub es la única política de actualización: cada ejecución
  // procesa todos los campeones válidos y deja SQLite como fuente de verdad.
  const pendingChamps = champions.filter(name => Boolean(nameIdMap[normalizeKey(name)]));
  const skippedCount = champions.length - pendingChamps.length;
  if (skippedCount > 0) {
    writeLog(`[WARN] ${skippedCount} campeones no tienen ID válido en SQLite y fueron omitidos.`);
  }

  if (pendingChamps.length === 0) {
    try {
      configRepo.setConfig('last_sync_timestamp', new Date().toISOString());
      configRepo.setConfig('last_sync_version', version);
    } catch (err) {
      writeLog(`[WARN] No se pudo guardar el estado del sync de Meta: ${err}`);
    }
    writeLog("[DONE] Todos los campeones estan al dia. Sincronizacion finalizada.");
    onProgress?.(0, 0, 'done');
    return "Sincronización al día";
  }

  const pendingTasks = pendingChamps.flatMap(name =>
    getChampionPlayLanes(name, nameIdMap).map(lane => ({ name, lane }))
  );

  if (pendingTasks.length === 0) {
    writeLog("[DONE] No se encontraron carriles válidos para sincronizar.");
    onProgress?.(0, 0, 'done');
    return "Sincronización finalizada sin carriles pendientes";
  }

  writeLog(`[LOLALYTICS] Iniciando procesamiento de ${pendingChamps.length} campeones en ${pendingTasks.length} tareas campeón/carril.`);
  onProgress?.(0, pendingTasks.length, 'puppeteer');

  // --- PARTE 2: LoLalytics (concurrencia limitada) ---
  const concurrencySetting = parseInt(configRepo.getConfig('puppeteer_concurrency') || '3') || 3;
  // Concurrencia de trabajadores
  const concurrency = Math.min(Math.max(concurrencySetting, 1), 6); 

  writeLog(`[LOLALYTICS] Concurrencia: ${concurrency} trabajadores simultáneos.`);

  let index = 0;
  let completedTasks = 0;
  let failedTasks = 0;
  const failedTaskLabels: string[] = [];

  const worker = async (workerId: number) => {
    let sessionId: string | undefined;
    if (process.env.HEXDRAFT_USE_FLARESOLVERR === '1') {
      const requestedSessionId = `hexdraft-sync-${Date.now()}-${workerId}`;
      try {
        sessionId = await createFlareSolverrSession(requestedSessionId);
        writeLog(`[W-${workerId}] Sesión opcional de FlareSolverr creada.`);
      } catch (e: any) {
        writeLog(`[W-${workerId}] [WARN] FlareSolverr opcional no disponible: ${e.message || e}`);
      }
    }

    try {
      while (index < pendingTasks.length) {
        if (checkAbort()) break;

        const task = pendingTasks[index++];
        if (!task) break;

        writeLog(`[W-${workerId}] Descargando build y matchups: ${task.name} / ${task.lane} (${index}/${pendingTasks.length})`);

        const succeeded = await scrapeSingleChampionLane(task.name, task.lane, version, nameIdMap, writeLog, sessionId);
        if (!succeeded) {
          failedTasks++;
          failedTaskLabels.push(`${task.name} / ${task.lane}`);
          writeLog(`[WARN] Tarea fallida registrada: ${task.name} / ${task.lane}`);
          continue;
        }
        completedTasks++;
        onProgress?.(completedTasks, pendingTasks.length, 'puppeteer');

        // Delay de cortesía para no sobrecargar el LoLalytics.
        await new Promise(r => setTimeout(r, 800));
      }
    } finally {
      if (sessionId) {
        await destroyFlareSolverrSession(sessionId);
        writeLog(`[W-${workerId}] Sesión persistente de FlareSolverr cerrada.`);
      }
    }
  };

  // Cada tarea usa un savepoint; los carriles válidos se conservan aunque falle otro.
  dbInstance.exec('BEGIN TRANSACTION;');
  try {
    // Lanzar todos los workers en paralelo
    await Promise.all(Array.from({ length: concurrency }).map((_, i) => worker(i + 1)));
    if (failedTasks > 0) {
      writeLog(`[WARN] ${failedTasks} tareas fallaron; se conservarán los datos anteriores de esos carriles y se guardarán los éxitos. Pendientes: ${failedTaskLabels.join(', ')}`);
    }
    if (checkAbort()) {
      dbInstance.exec('ROLLBACK;');
      writeLog('[ABORT] Cancelación procesada; se conservaron los datos anteriores.');
      return 'Cancelado por el usuario';
    }
    dbInstance.exec('COMMIT;');
  } catch (error) {
    try { dbInstance.exec('ROLLBACK;'); } catch { /* la transacción ya fue cerrada */ }
    throw error;
  }

  if (checkAbort()) {
    writeLog("[ABORT] Cancelacion procesada. Procesador detenido.");
    return "Cancelado por el usuario";
  }

  try {
    configRepo.setConfig('last_sync_timestamp', new Date().toISOString());
    configRepo.setConfig('last_sync_version', version);
  } catch (err) {
    // Ignorado si falla persistir el timestamp de actualización de config
  }
  
  // --- PARTE 3: Sincronizar datos semánticos de campeones ---
  try {
    writeLog("[SYNC] Sincronizando datos semanticos de campeones...");
    await syncChampionsSemanticData();
  } catch (e: any) {
    writeLog(`[WARN] Error al sincronizar datos semanticos: ${e.message || e}`);
  }

  writeLog("[DONE] Sincronizacion completa - Datos actualizados en SQLite local");
  onProgress?.(completedTasks, pendingTasks.length, 'done');
  return "Sincronización completa";
}

let isSyncing = false;

export async function checkAndRunMetaSync(writeLog: (msg: string) => void) {
  if (isSyncing) return;
  
  try {
    const freqStr = configRepo.getConfig('meta_sync_frequency') || '2';
    const frequencyHours = parseFloat(freqStr);
    
    if (frequencyHours === 0) {
      // Sincronización desactivada
      return;
    }
    
    const lastSyncStr = configRepo.getConfig('last_meta_cache_sync');
    
    if (!lastSyncStr || lastSyncStr === '-') {
      // Primera vez, correr inmediatamente
      isSyncing = true;
      await syncMetaCacheOnly(writeLog);
      isSyncing = false;
      return;
    }
    
    const lastSyncDate = new Date(lastSyncStr);
    if (isNaN(lastSyncDate.getTime())) {
      // Fecha inválida, correr inmediatamente
      isSyncing = true;
      await syncMetaCacheOnly(writeLog);
      isSyncing = false;
      return;
    }
    
    if (frequencyHours === -1) {
      // Únicamente al inicio
      return;
    }
    
    const elapsedMs = Date.now() - lastSyncDate.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    
    if (elapsedHours >= frequencyHours) {
      isSyncing = true;
      await syncMetaCacheOnly(writeLog);
      isSyncing = false;
    }
  } catch (err) {
    console.error('[Scheduler] Error en checkAndRunMetaSync:', err);
    isSyncing = false;
  }
}

export function startAutomaticMetaCacheScheduler() {
  const g = globalThis as any;
  if (g.metaCacheSchedulerStarted) {
    console.log('[Scheduler] El planificador de meta-cache ya está activo.');
    return;
  }
  g.metaCacheSchedulerStarted = true;
  
  const writeLog = (msg: string) => {
    console.log(`[Scheduler] ${msg}`);
  };
  
  console.log('[Scheduler] Iniciando planificador automático de Meta-Cache (frecuencia configurada)...');
  
  // Ejecutar una comprobación inicial al arrancar (después de 5 segundos)
  setTimeout(() => {
    const freqStr = configRepo.getConfig('meta_sync_frequency') || '2';
    if (freqStr === '-1') {
      isSyncing = true;
      syncMetaCacheOnly(writeLog).then(() => {
        isSyncing = false;
      }).catch(err => {
        console.error('[Scheduler] Error en inicio de meta sync:', err);
        isSyncing = false;
      });
    } else {
      checkAndRunMetaSync(writeLog);
    }
  }, 5000);
  
  // Intervalo de comprobación cada 15 minutos (15 * 60 * 1000 ms)
  const CHECK_INTERVAL = 15 * 60 * 1000;
  setInterval(() => {
    checkAndRunMetaSync(writeLog);
  }, CHECK_INTERVAL);
}
