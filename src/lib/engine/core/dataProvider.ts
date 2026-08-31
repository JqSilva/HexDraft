// src/lib/engine/core/dataProvider.ts
import { normalizeRole } from './constants.js';
import type { EnrichedChampion, ItemAsset } from './types.js';

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
      const lanesStats: Record<string, { tier: number; winRate: number }> = champ.lanesStats || champ.lanes_stats || {};
      const lanesPickrate: Record<string, number> = champ.lanesPickrate || champ.lanes_pickrate || {};

      const primaryStat = lanesStats[primaryLane];
      const primaryChamp: EnrichedChampion = {
        ...champ,
        lane: primaryLane,
        isSecondaryLane: false,
        lanePickRate: lanesPickrate[primaryLane] ?? 100,
        meta: {
          winRate: primaryStat?.winRate ?? champ.win_rate ?? champ.meta?.winRate ?? 50.0,
          tier: primaryStat?.tier ?? champ.tier ?? champ.meta?.tier ?? 3
        }
      };

      if (DATA_BY_LANE[primaryLane]) {
        DATA_BY_LANE[primaryLane].push(primaryChamp);
      }

      // Soportar play_lanes secundarios con sus estadísticas de línea específicas
      const playLanes: string[] = champ.playLanes || champ.play_lanes || [];
      if (Array.isArray(playLanes)) {
        playLanes.forEach(l => {
          const normL = normalizeRole(l, "MIDDLE");
          if (normL !== primaryLane && DATA_BY_LANE[normL] && !DATA_BY_LANE[normL].some(c => c.name === champ.name)) {
            const laneStat = lanesStats[normL];
            const lanePr = typeof lanesPickrate[normL] === 'number' 
              ? lanesPickrate[normL] 
              : parseFloat(String(lanesPickrate[normL] || '0'));
            const secondaryChamp: EnrichedChampion = {
              ...champ,
              lane: normL,
              isSecondaryLane: true,
              lanePickRate: lanePr,
              meta: {
                winRate: laneStat?.winRate ?? champ.win_rate ?? champ.meta?.winRate ?? 50.0,
                tier: laneStat?.tier ?? (champ.tier ? Math.max(champ.tier + 10, 15) : 25)
              }
            };
            DATA_BY_LANE[normL].push(secondaryChamp);
          }
        });
      }
    });
  } else {
    console.log("[CORE] No se proporcionaron datos de SQLite; el motor queda vacío hasta cargarlos.");
  }

  Object.keys(DATA_BY_LANE).forEach(lane => {
    DATA_BY_LANE[lane].sort((a, b) => (a.meta?.tier ?? 99) - (b.meta?.tier ?? 99));
  });

  if (typeof window !== 'undefined') {
    (window as any).__ENRICHED_DB = ENRICHED_DB;
  }

  console.log(`[CORE] Motor inicializado: ${Object.keys(ENRICHED_DB).length} campeones listos.`);
}

