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
import { fetchDpmChampionStats } from '../sources/dpm-champion-stats.source.js';
import { fetchOpggMetaByPosition } from '../sources/opgg-meta.source.js';

import { scrapeSingleChampion } from '../sync/scrape-champion.js';
import { buildChampionRecord } from '../sync/build-champion-record.js';

export { scrapeSingleChampion, buildChampionRecord };

// --- COMPROBAR SI LA BUILD ESTÁ AL DÍA EN TODOS SUS CARRILES ---
function isChampionBuildUpToDate(champId: number, version: string, syncPeriodDays: number, playLanes: string[]): boolean {
  try {
    if (playLanes.length === 0) return false;

    const stmt = dbInstance.prepare('SELECT patch, special_notes FROM builds WHERE champion_id = ? AND lane = ? AND is_default = 1 LIMIT 1');
    for (const lane of playLanes) {
      const row = stmt.get(champId, lane) as { patch: string; special_notes: string } | undefined;
      if (!row) return false;
      
      // 1. Verificar parche
      if (row.patch !== version) return false;

      // 2. Verificar antigüedad de la build
      const notes = JSON.parse(row.special_notes || '{}');
      if (!notes.last_update) return false;

      const lastDate = new Date(notes.last_update);
      if (isNaN(lastDate.getTime())) return false;

      const diffMs = Date.now() - lastDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= syncPeriodDays) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

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

  const dbPath = './src/lib/data/counter-synergies.json';
  let db: any = {};
  try {
    if (fs.existsSync(dbPath)) {
      db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }
  } catch (err) {
    db = {};
  }

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
 
     if (db[baseChamp.name]) {
       db[baseChamp.name].lane = primaryLane;
     }
 
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
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (err) {
    writeLog(`[OPGG-SYNC] Error escribiendo counter-synergies: ${err}`);
  }

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
  forceSync = false,
  onProgress?: (current: number, total: number, phase: 'opgg' | 'puppeteer' | 'done') => void
): Promise<string> {
  const dbPath = './src/lib/data/counter-synergies.json';
  const cachePath = './src/lib/data/meta-cache.json';
  let db: any = {};
  try {
    if (fs.existsSync(dbPath)) {
      db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }
  } catch (e) {
    db = {};
  }

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

  // Recargar db desde archivo por si cambió
  let updatedDb;
  try {
    updatedDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (e) {
    updatedDb = {};
  }
  Object.keys(db).forEach(k => delete db[k]);
  Object.assign(db, updatedDb);

  const syncPeriodSetting = parseInt(configRepo.getConfig('sync_period_days') || '3') || 3;

  // --- COMPROBAR CAMPEONES A SINCRONIZAR (Sync Diferencial) ---
  const pendingChamps = champions.filter(name => {
    const id = nameIdMap[normalizeKey(name)];
    if (!id) return false;
    if (forceSync) return true;

    // Obtener carriles jugables desde la BD
    const laneRow = dbInstance.prepare('SELECT play_lanes FROM champions WHERE id = ?').get(id) as { play_lanes: string } | undefined;
    const playLanes = JSON.parse(laneRow?.play_lanes || '[]');

    return !isChampionBuildUpToDate(id, version, syncPeriodSetting, playLanes);
  });

  const skippedCount = champions.length - pendingChamps.length;
  if (skippedCount > 0) {
    writeLog(`[SKIP] Omitiendo ${skippedCount} campeones ya actualizados para el parche ${version}.`);
  }

  if (pendingChamps.length === 0) {
    writeLog("[DONE] Todos los campeones estan al dia. Sincronizacion finalizada.");
    onProgress?.(0, 0, 'done');
    return "Sincronización al día";
  }

  writeLog(`[FLARESOLVERR] Iniciando procesamiento de ${pendingChamps.length} campeones.`);
  onProgress?.(0, pendingChamps.length, 'puppeteer');

  // --- PARTE 2: DPM.LOL (CONCURRENCIA PARALELA CON FLARESOLVERR) ---
  const concurrencySetting = parseInt(configRepo.getConfig('puppeteer_concurrency') || '3') || 3;
  // Concurrencia de trabajadores
  const concurrency = Math.min(Math.max(concurrencySetting, 1), 6); 

  writeLog(`[FLARESOLVERR] Concurrencia: ${concurrency} trabajadores simultáneos.`);

  let index = 0;
  let savedCount = 0;

  const worker = async (workerId: number) => {
    while (index < pendingChamps.length) {
      if (checkAbort()) break;
      
      const name = pendingChamps[index++];
      if (!name) break;

      writeLog(`[W-${workerId}] Descargando build y matchups: ${name} (${index}/${pendingChamps.length})`);
      
      try {
        await scrapeSingleChampion(name, version, db, nameIdMap, writeLog);
        savedCount++;
        onProgress?.(savedCount, pendingChamps.length, 'puppeteer');

        // Guardar preventivamente cada 5 campeones en JSON (fallback opcional)
        if (savedCount % 5 === 0) {
          try {
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          } catch (e) {
            // Ignorado en producción si el sistema de archivos es de solo lectura (SQLite es la fuente primaria)
          }
        }
      } catch (e: any) {
        writeLog(`[ERROR] [W-${workerId}] Error procesando ${name}: ${e.message || e}`);
      }

      // Delay de cortesía para no sobrecargar el proxy/dpm.lol
      await new Promise(r => setTimeout(r, 800));
    }
  };

  // Lanzar todos los workers en paralelo
  await Promise.all(Array.from({ length: concurrency }).map((_, i) => worker(i + 1)));

  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    // Ignorado de forma segura en producción
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
  onProgress?.(pendingChamps.length, pendingChamps.length, 'done');
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
