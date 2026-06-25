// src/lib/engine/dataProvider.ts
import { CHAMPIONS_DB, type ChampionData } from '../data/championdb';
import fs from 'fs';
import path from 'path';

// Carga dinámica de los JSON de respaldo para evitar que Vite reinicie (reload) el dev server
// en caliente al escribir los archivos en disco durante la sincronización.
let defaultCounterSynergies: any = {};
let defaultMetaCache: any = {};

try {
  const syncPath = path.resolve(process.cwd(), 'src/lib/data/counter-synergies.json');
  if (fs.existsSync(syncPath)) {
    defaultCounterSynergies = JSON.parse(fs.readFileSync(syncPath, 'utf8'));
  }
} catch (e) {}

try {
  const metaPath = path.resolve(process.cwd(), 'src/lib/data/meta-cache.json');
  if (fs.existsSync(metaPath)) {
    defaultMetaCache = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  }
} catch (e) {}

let loadedMetaCache: any = defaultMetaCache;

export const normalizeKey = (name: string) => name.toLowerCase()
  .replace(/\s+&\s+/g, ' y ')
  .replace(/\s+and\s+/g, ' y ')
  .replace(/[^a-z0-9]/g, "");

const ENRICHED_DB: any = {};

export const ITEMS_DB: Record<number, { id: number; name: string; gold: number; epicness: string; categories: string[]; iconPath: string }> = {};

export function initializeItemsData(itemsData: any) {
    // Limpiar previo
    Object.keys(ITEMS_DB).forEach(key => delete (ITEMS_DB as any)[key]);
    
    // Rellenar
    if (itemsData) {
        Object.entries(itemsData).forEach(([id, item]: [string, any]) => {
            ITEMS_DB[Number(id)] = item;
        });
        console.log(`✅ ItemsDB listo: ${Object.keys(ITEMS_DB).length} items cargados en memoria.`);
    }
}

export interface MatchupData {
  name: string;
  winrate: string;
  goldDiff: string;
  xpDiff: string;
  csDiff: string;
  count: number;
  laneTag: "Good Lane" | "Bad Lane";
  dominanceScore: number; 
}


export interface EnrichedChampion extends ChampionData {
  lane: string;
  tags: string[];
  combat: {
    damageComposition: { physical: number; magic: number; true: number };
    winrateCurve: number[];
  };
  counters: MatchupData[]; 
  godMatchups: MatchupData[];
  
  synergies: Record<string, Array<{ name: string; delta: string }>>;

  meta: {
    winRate: number;
    tier: number;
  };
  
  scalingType: 'Early' | 'Mid' | 'Late';
  buildData?: any;
  builds?: any[];
  tactic_role?: string;
  is_frontline?: number;
  is_hypercarry?: number;
  has_hard_cc?: number;
  has_sustain?: number;
}

const CHAMPION_ALIAS: Record<string, string> = {
    "Maestro Yi": "MasterYi",
    "Nunu y Willump": "Nunu",
    "Bardo": "Bard",
    "Renata Glasc": "Renata"
};

export const DATA_BY_LANE: Record<string, EnrichedChampion[]> = {
    "TOP": [], "JUNGLE": [], "MIDDLE": [], "BOTTOM": [], "UTILITY": []
};

export function initializeEngineData(customChamps?: any[]) {
    // 0. Limpiar datos previos para evitar duplicados en memoria
    Object.keys(DATA_BY_LANE).forEach(lane => DATA_BY_LANE[lane] = []);
    Object.keys(ENRICHED_DB).forEach(key => delete ENRICHED_DB[key]);
    
    if (customChamps && Array.isArray(customChamps)) {
        console.log(`🧬 Cargando datos al motor desde la base de datos local SQLite (${customChamps.length} campeones)...`);
        customChamps.forEach((champ) => {
            ENRICHED_DB[champ.name] = champ;
            
            const laneKey = champ.lane.toUpperCase();
            if (DATA_BY_LANE[laneKey]) {
                DATA_BY_LANE[laneKey].push(champ);
            }
        });
    } else {
        console.log("🧬 Cargando datos al motor desde archivos JSON (De Respaldo)...");
        // Cargar datos dinámicamente de los archivos si existen (solo del lado del servidor)
        let counterSynergies: any = defaultCounterSynergies;
        let activeMetaCache: any = defaultMetaCache;

        if (typeof window === 'undefined') {
            const getFilePath = (fileName: string) => {
                return path.resolve(process.cwd(), 'src/lib/data', fileName);
            };

            try {
                const synergiesPath = getFilePath('counter-synergies.json');
                if (fs && fs.existsSync && fs.existsSync(synergiesPath)) {
                    console.log("📂 Cargando counter-synergies desde disco...");
                    counterSynergies = JSON.parse(fs.readFileSync(synergiesPath, 'utf-8'));
                }
            } catch (e: any) {
                console.error("❌ Error cargando counter-synergies dinámico:", e);
            }

            try {
                const cachePath = getFilePath('meta-cache.json');
                if (fs && fs.existsSync && fs.existsSync(cachePath)) {
                    console.log("📂 Cargando meta-cache desde disco...");
                    activeMetaCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
                }
            } catch (e: any) {
                console.error("❌ Error cargando meta-cache dinámico:", e);
            }
        }

        loadedMetaCache = activeMetaCache;
        
        // Mapeo de sinergias con llaves normalizadas
        const normalizedSynergies: any = {};
        Object.keys(counterSynergies).forEach(key => {
            normalizedSynergies[normalizeKey(key)] = (counterSynergies as any)[key];
        });

        Object.values(CHAMPIONS_DB).forEach((baseChamp) => {
            const name = baseChamp.name;
            const internalName = CHAMPION_ALIAS[name] || name;
            const extra = normalizedSynergies[normalizeKey(internalName)];
            const opgg = findInMetaCache(name); 

            // Cálculo del tipo de escalado del campeón
            const curve = extra?.combat?.winrateCurve || [];
            const scaling = calculateScalingType(curve);

            // Creación del objeto de datos enriquecido
            const enrichedChamp = {
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

            // Registro en el almacén de datos global
            ENRICHED_DB[name] = enrichedChamp;

            // Clasificación por carril
            const laneKey = enrichedChamp.lane.toUpperCase();
            if (DATA_BY_LANE[laneKey]) {
                DATA_BY_LANE[laneKey].push(enrichedChamp);
            }
        });
    }

    // Ordenamiento de campeones por tier para optimizar el rendimiento en consultas
    Object.keys(DATA_BY_LANE).forEach(lane => {
        DATA_BY_LANE[lane].sort((a, b) => a.meta.tier - b.meta.tier);
    });

    if (typeof window !== 'undefined') {
        (window as any).__ENRICHED_DB = ENRICHED_DB;
    }

    console.log(`✅ Engine listo: ${Object.keys(ENRICHED_DB).length} campeones cargados.`);
}


function calculateScalingType(curve: any[]): 'Early' | 'Mid' | 'Late' {
    if (!curve || curve.length < 6) return 'Mid';

    // Extraemos solo los valores numéricos si vienen como objetos {time, value}
    const values = curve.map(p => typeof p === 'object' ? p.value : p);

    /**
     * Mapeo de Índices para análisis de curvas de winrate:
     * - Índice [2] (900s) = Juego temprano (~15 min)
     * - Índice [4] (1500s) = Juego medio (~25 min)
     * - Índice [7] (2400s) = Juego tardío (~40 min)
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

export { ENRICHED_DB };