// src/lib/engine/dataProvider.ts
import { object } from 'astro:schema';
import { CHAMPIONS_DB, type ChampionData } from '../data/championdb';
import counterSynergies from '../data/counter-synergies.json';
import metaCache from '../data/meta-cache.json';

export const normalizeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const ENRICHED_DB: any = {};

export interface EnrichedChampion extends ChampionData {
  // Data estratégica del Super JSON
  lane: string;
  tags: string[]; // De DataDragon (Assassin, Tank, etc.)
  combat: {
    damageComposition: { physical: number; magic: number; true: number };
    winrateCurve: number[];
  };
  counters: Array<{ name: string; winrate: string }>;
  godMatchups: Array<{ name: string; winrate: string; goldDiff: string; xpDiff: string }>;
  synergies: Record<string, Array<{ name: string; delta: string }>>;

  // Data volátil de OPGG
  meta: {
    winRate: number;
    tier: number;
  };
  
  // Atributo calculado para el Engine
  scalingType: 'Early' | 'Mid' | 'Late';
}

const CHAMPION_ALIAS: Record<string, string> = {
    "Maestro Yi": "MasterYi",
    "Nunu y Willump": "Nunu",
    "Bardo": "Bard",
    "Renata Glasc": "Renata"
};



export function initializeEngineData() {
    // 1. Creamos un mapa del Super JSON con llaves normalizadas
    const normalizedSynergies: any = {};
    Object.keys(counterSynergies).forEach(key => {
        normalizedSynergies[normalizeKey(key)] = (counterSynergies as any)[key];
    });

  console.log("🧬 Sincronizando datos masivos al Engine...");

  Object.values(CHAMPIONS_DB).forEach((baseChamp) => {
    const name = baseChamp.name;

    const internalName = CHAMPION_ALIAS[name] || name;

    const extra = normalizedSynergies[normalizeKey(internalName)];
    const opgg = findInMetaCache(name);

    if (!extra) {
        console.warn(`⚠️ No hay data extra para ${name} (buscado como ${internalName}).`);
    }
    
    
    // Calculamos el scaling basado en la curva que scrapeamos
    const curve = extra?.combat?.winrateCurve || [];
    const scaling = calculateScalingType(curve);


    ENRICHED_DB[name] = {
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
  });

  console.log(`✅ Engine listo: ${Object.keys(ENRICHED_DB).length} campeones cargados.`);
}


function calculateScalingType(curve: any[]): 'Early' | 'Mid' | 'Late' {
    if (!curve || curve.length < 6) return 'Mid';

    // Extraemos solo los valores numéricos si vienen como objetos {time, value}
    const values = curve.map(p => typeof p === 'object' ? p.value : p);

    /**
     * Mapeo de Índices basado en tu observación:
     * [2] 900s  = 15 min (Early)
     * [4] 1500s = 25 min (Mid)
     * [7] 2400s = 40 min (Late Real)
     * [8+] > 40 min (Ruido estadístico)
     */
    const earlyWR = values[2] || 50; // Poder al minuto 15
    const lateWR = values[7] || values[values.length - 2] || 50; // Poder al minuto 40

    const delta = earlyWR - lateWR;

    // Umbral de 1.5% para clasificar la tendencia
    if (delta > 1.5) return 'Early';  // El winrate cae con el tiempo (ej. Lee Sin)
    if (delta < -1.5) return 'Late'; // El winrate sube con el tiempo (ej. Kayle)
    
    return 'Mid';
}

function findInMetaCache(name: string) {
    const nName = normalizeKey(name);
    const rolesData = Object.values(metaCache);
    
    for (const championList of rolesData) {
      if (!Array.isArray(championList)) continue;

      const found = championList.find((champ: any) => normalizeKey(champ.name) === nName);
      if (found) {
        return found;
      }
    }
    return null;
}

export { ENRICHED_DB };