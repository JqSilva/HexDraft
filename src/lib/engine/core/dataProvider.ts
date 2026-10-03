import { getRoleBuild } from '../draftContext.js';
// src/lib/engine/core/dataProvider.ts
import { normalizeRole, registerChampionNames } from './constants.js';
import type { EnrichedChampion, ItemAsset } from './types.js';
import { getChampionTopRoleRanks, getProbuildstatsTopPicksSnapshot, setProbuildstatsTopPicksSnapshot, type MetaLane } from '../../meta/probuildstatsTopPicks.js';

export const ENRICHED_DB: Record<string, EnrichedChampion> = {};

export const ITEMS_DB: Record<number, ItemAsset> = {};

export function initializeItemsData(itemsData: any) {
  Object.keys(ITEMS_DB).forEach(key => delete (ITEMS_DB as any)[key]);
  
  if (itemsData) {
    Object.entries(itemsData).forEach(([id, item]: [string, any]) => {
      // Normalize Data Dragon tags to the engine vocabulary without losing source tags.
      const aliases: Record<string, string> = { Armor: 'GivesArmor', SpellBlock: 'GivesMagicResist', Health: 'GivesHealth' };
      const categories: string[] = item.categories || [];
      ITEMS_DB[Number(id)] = { ...item, categories: [...new Set([...categories, ...categories.map(c => aliases[c]).filter(Boolean)])] };
    });
    console.log(`[CORE] ItemsDB listo: ${Object.keys(ITEMS_DB).length} items cargados en memoria.`);
  }
}
export const DATA_BY_LANE: Record<string, EnrichedChampion[]> = {
  "TOP": [], "JUNGLE": [], "MIDDLE": [], "BOTTOM": [], "UTILITY": []
};

export function initializeEngineData(customChamps?: any[], topPicksSnapshot?: unknown) {
  // Limpiar previo
  Object.keys(DATA_BY_LANE).forEach(lane => DATA_BY_LANE[lane] = []);
  Object.keys(ENRICHED_DB).forEach(key => delete ENRICHED_DB[key]);

  if (topPicksSnapshot) setProbuildstatsTopPicksSnapshot(topPicksSnapshot);
  const snapshot = getProbuildstatsTopPicksSnapshot();
  
  if (customChamps && Array.isArray(customChamps)) {
    registerChampionNames(customChamps);
    console.log(`[CORE] Cargando datos al motor desde SQLite (${customChamps.length} campeones)...`);
    customChamps.forEach((champ) => {
      const topRoles = getChampionTopRoleRanks(Number(champ.id));
      const metaRanksByRole = Object.fromEntries(topRoles.map(({ lane, rank }) => [lane, rank]));
      const primaryLane = topRoles[0]?.lane || normalizeRole(champ.lane, "MIDDLE");
      const enrichedChamp: EnrichedChampion = {
        ...champ,
        lane: primaryLane,
        buildData: getRoleBuild(champ, primaryLane),
        playLanes: topRoles.length ? topRoles.map(role => role.lane) : (champ.playLanes || champ.play_lanes || []),
        metaRanksByRole,
        metaRank: metaRanksByRole[primaryLane]
      };
      ENRICHED_DB[champ.name] = enrichedChamp;
    });

    const championsById = new Map<number, EnrichedChampion>(
      Object.values(ENRICHED_DB).map(champ => [Number(champ.id), champ] as const)
    );
    for (const lane of Object.keys(DATA_BY_LANE) as MetaLane[]) {
      for (const entry of snapshot.roles[lane]) {
        const champ = championsById.get(entry.championId);
        if (!champ) continue;
        DATA_BY_LANE[lane].push({
          ...champ,
          lane,
          buildData: getRoleBuild(champ, lane),
          metaRank: entry.rank,
          metaRanksByRole: { ...(champ.metaRanksByRole || {}), [lane]: entry.rank },
          isSecondaryLane: false
        });
      }
    }
  } else {
    console.log("[CORE] No se proporcionaron datos de SQLite; el motor queda vacío hasta cargarlos.");
  }

  Object.keys(DATA_BY_LANE).forEach(lane => {
    DATA_BY_LANE[lane].sort((a, b) => (a.metaRank ?? 99) - (b.metaRank ?? 99));
  });

  if (typeof window !== 'undefined') {
    (window as any).__ENRICHED_DB = ENRICHED_DB;
  }

  console.log(`[CORE] Motor inicializado: ${Object.keys(ENRICHED_DB).length} campeones listos.`);
}

