// src/lib/engine/core/dataProvider.ts
import { CHAMPIONS_DB } from '../../data/championdb.js';
import { normalizeKey, normalizeRole } from './constants.js';
import type { EnrichedChampion, ItemAsset, ScalingType } from './types.js';
import fs from 'fs';
import path from 'path';

let defaultCounterSynergies: any = {};
let defaultMetaCache: any = {};

try {
  const syncPath = path.resolve(process.cwd(), 'src/lib/data/counter-synergies.json');
  if (fs.existsSync(syncPath)) {
    defaultCounterSynergies = JSON.parse(fs.readFileSync(syncPath, 'utf8'));
  }
} catch (e) {
  // Ignorado en entorno cliente
}

try {
  const metaPath = path.resolve(process.cwd(), 'src/lib/data/meta-cache.json');
  if (fs.existsSync(metaPath)) {
    defaultMetaCache = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  }
} catch (e) {
  // Ignorado en entorno cliente
}

let loadedMetaCache: any = defaultMetaCache;

export const ENRICHED_DB: Record<string, EnrichedChampion> = {};

export const ITEMS_DB: Record<number, ItemAsset> = {};

export function initializeItemsData(itemsData: any) {
  Object.keys(ITEMS_DB).forEach(key => delete (ITEMS_DB as any)[key]);
  
  if (itemsData) {
    Object.entries(itemsData).forEach(([id, item]: [string, any]) => {
      ITEMS_DB[Number(id)] = item;
    });
    console.log(`[CORE] ItemsDB listo: ${Object.keys(ITEMS_DB).length} items cargados en memoria.`);
  }
}

const CHAMPION_ALIAS: Record<string, string> = {
  "Maestro Yi": "MasterYi",
  "Nunu y Willump": "Nunu",
  "Bardo": "Bard",
  "Renata Glasc": "Renata",
  "Wukong": "MonkeyKing"
};

export const DATA_BY_LANE: Record<string, EnrichedChampion[]> = {
  "TOP": [], "JUNGLE": [], "MIDDLE": [], "BOTTOM": [], "UTILITY": []
};

export function initializeEngineData(customChamps?: any[]) {
  // Limpiar previo
  Object.keys(DATA_BY_LANE).forEach(lane => DATA_BY_LANE[lane] = []);
  Object.keys(ENRICHED_DB).forEach(key => delete ENRICHED_DB[key]);
  
  if (customChamps && Array.isArray(customChamps)) {
    console.log(`[CORE] Cargando datos al motor desde SQLite (${customChamps.length} campeones)...`);
    customChamps.forEach((champ) => {
      ENRICHED_DB[champ.name] = champ;
      
      const primaryLane = normalizeRole(champ.lane, "MIDDLE");
      if (DATA_BY_LANE[primaryLane]) {
        DATA_BY_LANE[primaryLane].push(champ);
      }

      // Soportar play_lanes secundarios
      const playLanes: string[] = champ.playLanes || champ.play_lanes || [];
      if (Array.isArray(playLanes)) {
        playLanes.forEach(l => {
          const normL = normalizeRole(l, "MIDDLE");
          if (normL !== primaryLane && DATA_BY_LANE[normL] && !DATA_BY_LANE[normL].some(c => c.name === champ.name)) {
            DATA_BY_LANE[normL].push(champ);
          }
        });
      }
    });
  } else {
    console.log("[CORE] Cargando datos al motor desde archivos JSON de respaldo...");
    let counterSynergies: any = defaultCounterSynergies;
    let activeMetaCache: any = defaultMetaCache;

    if (typeof window === 'undefined') {
      const getFilePath = (fileName: string) => path.resolve(process.cwd(), 'src/lib/data', fileName);

      try {
        const synergiesPath = getFilePath('counter-synergies.json');
        if (fs && fs.existsSync && fs.existsSync(synergiesPath)) {
          counterSynergies = JSON.parse(fs.readFileSync(synergiesPath, 'utf-8'));
        }
      } catch (e: any) {
        console.error("Error cargando counter-synergies dinámico:", e);
      }

      try {
        const cachePath = getFilePath('meta-cache.json');
        if (fs && fs.existsSync && fs.existsSync(cachePath)) {
          activeMetaCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        }
      } catch (e: any) {
        console.error("Error cargando meta-cache dinámico:", e);
      }
    }

    loadedMetaCache = activeMetaCache;
    
    const normalizedSynergies: any = {};
    Object.keys(counterSynergies).forEach(key => {
      normalizedSynergies[normalizeKey(key)] = (counterSynergies as any)[key];
    });

    Object.values(CHAMPIONS_DB).forEach((baseChamp) => {
      const name = baseChamp.name;
      const internalName = CHAMPION_ALIAS[name] || name;
      const extra = normalizedSynergies[normalizeKey(internalName)];
      const opgg = findInMetaCache(name); 

      const curve = extra?.combat?.winrateCurve || [];
      const scaling = calculateScalingType(curve);

      const enrichedChamp: EnrichedChampion = {
        ...baseChamp,
        lane: extra?.lane || "UNKNOWN",
        tags: extra?.tags || baseChamp.tags || [],
        combat: {
          damageComposition: extra?.combat?.damageComposition || { physical: 50, magic: 50, true: 0 },
          winrateCurve: curve
        },
        buildData: extra?.buildData || null,
        counters: extra?.counters || [],
        synergies: extra?.synergies || {},
        godMatchups: extra?.godMatchups || [],
        meta: {
          winRate: opgg ? parseFloat(opgg.winRate) : 50.0,
          tier: opgg ? parseInt(opgg.rank) : 5
        },
        scalingType: scaling
      };

      ENRICHED_DB[name] = enrichedChamp;

      const laneKey = normalizeRole(enrichedChamp.lane, "MIDDLE");
      if (DATA_BY_LANE[laneKey]) {
        DATA_BY_LANE[laneKey].push(enrichedChamp);
      }
    });
  }

  Object.keys(DATA_BY_LANE).forEach(lane => {
    DATA_BY_LANE[lane].sort((a, b) => (a.meta?.tier ?? 99) - (b.meta?.tier ?? 99));
  });

  if (typeof window !== 'undefined') {
    (window as any).__ENRICHED_DB = ENRICHED_DB;
  }

  console.log(`[CORE] Motor inicializado: ${Object.keys(ENRICHED_DB).length} campeones listos.`);
}

function calculateScalingType(curve: any[]): ScalingType {
  if (!curve || curve.length < 6) return 'Mid';
  const values = curve.map(p => typeof p === 'object' ? p.value : p);
  const earlyWR = values[2] || 50;
  const lateWR = values[7] || values[values.length - 2] || 50;
  const delta = earlyWR - lateWR;
  if (delta > 1.5) return 'Early';
  if (delta < -1.5) return 'Late';
  return 'Mid';
}

function findInMetaCache(name: string) {
  const nName = normalizeKey(name);
  const rolesData = Object.values(loadedMetaCache);
  
  for (const championList of rolesData) {
    if (!Array.isArray(championList)) continue;
    const found = championList.find((champ: any) => normalizeKey(champ.name) === nName);
    if (found) {
      return found;
    }
  }
  return null;
}
