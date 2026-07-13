// src/lib/engine/itemEngine.ts
import { ENRICHED_DB, ITEMS_DB } from './dataProvider.js';
import { NAME_TO_ID } from './constants.js';
import { hydrateAsset } from './hydrator.js';
import { analyzeComposition } from './compositionAnalyzer.js';
import assetsMap from '../data/assets-map.json' with { type: 'json' };

export interface RuneOption {
  Id?: number;
  id?: number;
  winrate: number;
  pickrate: number;
  games?: number;
}

export interface RunesData {
  primaryRuneId?: RuneOption[];
  primaryRuneId2?: RuneOption[];
  primaryRuneId3?: RuneOption[];
  primaryRuneId4?: RuneOption[];
  secondaryRuneId?: RuneOption[];
  perksStat1?: RuneOption[];
  perksStat2?: RuneOption[];
  perksStat3?: RuneOption[];
}

export interface BuildCluster {
  pivotItem: number;
  representativeCore: number[];
  totalPickrate: number;
  weightedWinrate: number;
  damageType: 'AD' | 'AP' | 'Hybrid';
}

export interface EnrichedChampion {
  name: string;
  class: string;
  tacticRole: string;
  damageType: 'AD' | 'AP' | 'Hybrid';
  builds?: any[];
  buildData?: any;
  dpmData?: any;
  [key: string]: any;
}

// Categorías de respaldo si ITEMS_DB no está cargado aún en el cliente
const HARDCODED_CATEGORIES = {
  ARMOR_PEN: [3035, 3036, 3071, 6694, 3153, 6692, 3033, 223035, 223036, 223071, 226692, 226694, 223153, 223033],
  MAGIC_PEN: [3135, 6653, 3001, 3165, 3137, 223135, 226653, 223165, 223137],
  GRIEVOUS_WOUNDS: [3033, 3165, 3075, 3181, 3011, 8020, 3123, 223033, 223165, 223075, 323075],
  MAGIC_RESIST: [3156, 2504, 3065, 4401, 3001, 3102, 3140, 3111, 223156, 222504, 223065, 224401, 223111],
  ARMOR: [3110, 3047, 3143, 3075, 3026, 6333, 3053, 6662, 3157, 223110, 223047, 223143, 223075, 223026, 223157, 223053, 226662, 323075, 323110],
  TENACITY: [3111, 3140, 223111]
};

// Definición dinámica de grupos de items para scoring y adaptación
export const ITEM_CATEGORIES = {
  get ARMOR_PEN(): number[] {
    const dynamic = Object.values(ITEMS_DB)
      .filter(item => item.categories.includes('ArmorPenetration') && item.gold >= 1500)
      .map(item => item.id);
    return dynamic.length > 0 ? dynamic : HARDCODED_CATEGORIES.ARMOR_PEN;
  },
  get MAGIC_PEN(): number[] {
    const dynamic = Object.values(ITEMS_DB)
      .filter(item => item.categories.includes('MagicPenetration') && item.gold >= 1500)
      .map(item => item.id);
    return dynamic.length > 0 ? dynamic : HARDCODED_CATEGORIES.MAGIC_PEN;
  },
  get GRIEVOUS_WOUNDS(): number[] {
    const dynamic = Object.values(ITEMS_DB)
      .filter(item => item.categories.includes('AntiHeal'))
      .map(item => item.id);
    return dynamic.length > 0 ? dynamic : HARDCODED_CATEGORIES.GRIEVOUS_WOUNDS;
  },
  get MAGIC_RESIST(): number[] {
    const dynamic = Object.values(ITEMS_DB)
      .filter(item => item.categories.includes('GivesMagicResist') && item.gold >= 1000)
      .map(item => item.id);
    return dynamic.length > 0 ? dynamic : HARDCODED_CATEGORIES.MAGIC_RESIST;
  },
  get ARMOR(): number[] {
    const dynamic = Object.values(ITEMS_DB)
      .filter(item => item.categories.includes('GivesArmor') && item.gold >= 1000)
      .map(item => item.id);
    return dynamic.length > 0 ? dynamic : HARDCODED_CATEGORIES.ARMOR;
  },
  get TENACITY(): number[] {
    const dynamic = Object.values(ITEMS_DB)
      .filter(item => item.categories.includes('Tenacity'))
      .map(item => item.id);
    return dynamic.length > 0 ? dynamic : HARDCODED_CATEGORIES.TENACITY;
  }
};

// Blacklists de ítems e incompatibilidades por cluster
export const CLUSTER_ITEM_BLACKLIST: Record<string, number[]> = {
  AD: [
    3071,  // Black Cleaver — bruiser, no asesino
    3053,  // Sterak's Gage
    6653,  // Liandry's — AP, no AD
    3152,  // Hextech Rocketbelt — AP
    4645,  // Shadowflame — AP
    3135,  // Void Staff — AP penetración mágica
    3165,  // Morellonomicon — AP
    3157,  // Zhonya's — AP
    3089,  // Rabadon's — AP
    3040,  // Archangel's — AP
    3102,  // Banshee's Veil — AP
    3001,  // Abyssal Mask — AP/tank
    3143,  // Randuin's Omen  
    3110,  // Frozen Heart
    3083,  // Warmog's Armor
    4632,  // Verdant Barrier
    3190,  // Locket of the Iron Solari
    2502,  // Unending Despair
  ],
  AP: [
    3071,  // Black Cleaver — AD bruiser
    3036,  // Lord Dominik's — AD armor pen
    3033,  // Mortal Reminder — AD armor pen
    6692,  // Draktharr — AD lethality
    6699,  // Hubris — AD lethality
    6676,  // The Collector — AD lethality
    3031,  // Infinity Edge — AD crit
    3142,  // Youmuu's — AD lethality
    3179,  // Voltaic Cyclosword — AD lethality
    6694,  // Edge of Night — AD lethality
    6695,  // Serpent's Fang — AD lethality
  ]
};

// Blacklist de botas por clase y cluster
export const BOOTS_BLACKLIST: Record<string, number[]> = {
  AD_ASSASSIN: [
    3006,  // Berserker's Greaves
  ],
  AP: [
    3006,  // Berserker's Greaves
    3047,  // Plated Steelcaps
  ],
  AD_FIGHTER: []
};

// Mapeos de coherencia para runas
export const KEYSTONE_DAMAGE_TYPE: Record<number, 'AD' | 'AP' | 'Hybrid'> = {
  // AD / Physical
  
  // AP / Magic
  8229: 'AP',   // Arcane Comet
  8214: 'AP',   // Phase Rush
  8230: 'AP',   // Summon Aery
  8351: 'AP',   // Glacial Augment
  8360: 'AP',   // Unsealed Spellbook
  
  // Hybrid / Adaptive (usable by both AD and AP classes)
  8010: 'Hybrid', // Conqueror / Conquistador (adaptive force)
  8008: 'Hybrid', // Lethal Tempo / Compás Letal
  8021: 'Hybrid', // Fleet Footwork / Sobre la marcha (adaptive stats/healing)
  8005: 'Hybrid', // Press the Attack / Estrategia Ofensiva (amplifies all damage types)
  8000: 'Hybrid', // Precision Style
  8128: 'Hybrid', // Dark Harvest
  8112: 'Hybrid', // Electrocute
  8992: 'Hybrid', // Grasp of the Undying
  8437: 'Hybrid', // Guardian
  8465: 'Hybrid', // Aftershock
  9923: 'Hybrid', // Hail of Blades (second ID)
  8369: 'Hybrid', // First Strike
};

export const RUNE_TREE_DAMAGE_TYPE: Record<number, 'AD' | 'AP' | 'Hybrid'> = {
  8000: 'AD',     // Precision
  8100: 'Hybrid', // Domination  
  8200: 'AP',     // Sorcery
  8300: 'Hybrid', // Inspiration
  8400: 'Hybrid', // Resolve
};

export const PLAYSTYLE_KEYSTONES: Record<string, number[]> = {
  'AD Letalidad': [9923, 8112, 8128, 8369],      // Hail of Blades, Electrocute, Dark Harvest, First Strike
  'AD Crítico': [8008, 9923, 8005, 8021, 8010],    // Lethal Tempo, Hail of Blades, Press the Attack, Fleet, Conqueror
  'AD Combatiente': [8010, 8005, 8992, 8008],     // Conqueror, Press the Attack, Grasp, Lethal Tempo
  'AP Quemado': [8229, 8230, 8128, 8992],         // Comet, Aery, Dark Harvest, Grasp
  'AP Ráfaga': [8112, 8128, 8369, 8229, 8214],    // Electrocute, Dark Harvest, First Strike, Comet, Phase Rush
  'AP Mágico': [8229, 8112, 8128, 8230],          // Comet, Electrocute, Dark Harvest, Aery
  'AD Físico': [8005, 8008, 8010, 9923, 8021],    // Press the Attack, Lethal Tempo, Conqueror, Hail of Blades, Fleet
  'Híbrido': [8128, 8112, 9923, 8369],            // Dark Harvest, Electrocute, Hail of Blades, First Strike
};

export const PLAYSTYLE_SECONDARY_STYLES: Record<string, number[]> = {
  'AD Letalidad': [8000, 8200],      // Precision, Sorcery
  'AD Crítico': [8300, 8100, 8400],  // Inspiration, Domination, Resolve
  'AD Combatiente': [8400, 8300, 8000], // Resolve, Inspiration, Precision
  'AP Quemado': [8300, 8000, 8400],     // Inspiration, Precision, Resolve
  'AP Ráfaga': [8200, 8300],         // Sorcery, Inspiration
  'AP Mágico': [8300, 8100, 8200],   // Inspiration, Domination, Sorcery
  'AD Físico': [8300, 8000, 8100],   // Inspiration, Precision, Domination
  'Híbrido': [8300, 8000, 8200],     // Inspiration, Precision, Sorcery
};

// Fallbacks seguros de items para rellenar rutas de continuación vacías por clase
const AD_ASSASSIN_FALLBACKS = {
  offensive: [3031, 6676, 6699, 3142], // IE, Collector, Voltaic Cyclosword, Youmuu's Ghostblade
  balanced: [3814, 6695, 3156, 3072],  // Edge of Night, Serpent's Fang, Maw, Bloodthirster
  defensive: [3026, 2504, 3111, 3047]  // GA, Kaenic Rookern, Mercury, Tabi
};

const AD_FIGHTER_FALLBACKS = {
  offensive: [3078, 3053, 6631, 3074], // Trinity, Sterak, Stridebreaker, Ravenous Hydra
  balanced: [3071, 3156, 6333, 3072],  // Black Cleaver, Maw, Death's Dance, Bloodthirster
  defensive: [3075, 2504, 3110, 3143]  // Thornmail, Kaenic Rookern, Frozen Heart, Randuin
};

const AP_FALLBACKS = {
  offensive: [3089, 3135, 3137, 3020], // Rabadon, Void, Criptoflora, Botas Hechicero
  balanced: [3157, 3102, 6653, 3001],  // Zhonya, Banshee, Liandry, Máscara Abisal
  defensive: [2504, 3065, 3110, 3143]  // Kaenic, Apariencia Espiritual, Corazón de Hielo, Randuin
};

// Helper para obtener nombre del campeón por ID
export function getNameFromId(id: number): string | undefined {
  return Object.keys(NAME_TO_ID).find(key => NAME_TO_ID[key] === id);
}

/**
 * Determina si un item es coherente con el damageType del cluster activo.
 * Usa ITEMS_DB para leer las categorías del item.
 * @param itemId - ID del item.
 * @param clusterDamageType - Tipo de daño del cluster.
 * @returns Coherente o no.
 */
export function isItemCoherentWithCluster(
  itemId: number,
  clusterDamageType: 'AD' | 'AP' | 'Hybrid'
): boolean {
  if (!clusterDamageType || clusterDamageType === 'Hybrid') return true;

  const baseId = itemId > 220000 ? itemId % 220000 : itemId;

  // Verificar blacklist estática primero
  const blacklist = CLUSTER_ITEM_BLACKLIST[clusterDamageType] || [];
  if (blacklist.includes(baseId)) {
    return false;
  }

  const dbItem = ITEMS_DB[baseId];
  if (!dbItem || !dbItem.categories || dbItem.categories.length === 0) {
    return true;
  }

  const cats = dbItem.categories;

  // 1. Si es AD y tiene SpellDamage (y no tiene Damage/AttackDamage), filtrar
  if (clusterDamageType === 'AD' && cats.includes('SpellDamage') && !cats.includes('Damage') && !cats.includes('AttackDamage')) {
    return false;
  }

  // 2. Si es AP y tiene Damage/AttackDamage/CriticalStrike (y no tiene SpellDamage), filtrar
  if (clusterDamageType === 'AP' && (cats.includes('Damage') || cats.includes('AttackDamage') || cats.includes('CriticalStrike')) && !cats.includes('SpellDamage')) {
    return false;
  }

  return true;
}

// Clasificador de un item individual
export function classifyItem(itemId: number): 'offensive' | 'balanced' | 'defensive' {
  const baseId = itemId > 220000 ? itemId % 220000 : itemId;

  const dbItem = ITEMS_DB[baseId];
  if (dbItem) {
    const cats = dbItem.categories || [];
    const hasOffense = cats.some(c => ['Damage', 'AttackSpeed', 'CriticalStrike', 
                                       'SpellDamage', 'ArmorPenetration', 
                                       'MagicPenetration'].includes(c));
    const hasDefense = cats.some(c => ['GivesArmor', 'GivesMagicResist', 
                                       'GivesHealth', 'Tenacity'].includes(c));
    if (hasOffense && !hasDefense) return 'offensive';
    if (hasDefense && !hasOffense) return 'defensive';
    return 'balanced';
  }

  if (HARDCODED_CATEGORIES.MAGIC_RESIST.includes(baseId) || HARDCODED_CATEGORIES.ARMOR.includes(baseId)) {
    const balancedIds = [3053, 3156, 3157, 6333, 6692, 6631, 3078, 6673, 3072, 3074, 3748, 6653, 223053, 223156, 223157, 226692, 226631, 223078, 226673, 223072, 223074, 223748, 226653];
    if (balancedIds.includes(baseId)) {
      return 'balanced';
    }
    return 'defensive';
  }

  const balancedUtilityIds = [3071, 6653, 3001, 223071, 226653];
  if (balancedUtilityIds.includes(baseId)) {
    return 'balanced';
  }

  return 'offensive';
}

// Comprueba si un item está en un grupo determinado
function isItemInGroup(itemId: number, group: number[]): boolean {
  const baseId = itemId > 220000 ? itemId % 220000 : itemId;
  return group.includes(baseId);
}

// Fallback estático en caso de que no existan builds en SQLite
// Fallback estático en caso de que no existan builds en SQLite con filtros de coherencia
// Fallback estático en caso de que no existan builds en SQLite con filtros de coherencia
export function getFallbackStaticBuild(champ: any, myRole: string = 'jungle'): any {
  const b = champ.buildData || { runes: {}, items: { starter: [], boots: { id: 3047 }, core: [] }, summoners: [4, 12] };

  // Obtener coreIds primero para poder deducir el tipo de daño si es 'Adaptive' o 'Hybrid'
  let coreIds = b.items?.core || [];
  if (coreIds.length === 0 && b.items?.coreSlots) {
    coreIds = b.items.coreSlots;
  }
  if (Array.isArray(coreIds)) {
    coreIds = coreIds.map((i: any) => typeof i === 'object' ? Number(i.id || i.itemId) : Number(i));
  }

  let damageType = champ.damageType || 'AD';
  if (damageType === 'Adaptive' || damageType === 'Hybrid') {
    let adCount = 0;
    let apCount = 0;
    coreIds.forEach((id: number) => {
      const dbItem = ITEMS_DB[id];
      if (dbItem && dbItem.categories) {
        const cats = dbItem.categories;
        const isApItem = cats.includes('SpellDamage') && !cats.includes('Damage') && !cats.includes('AttackDamage');
        const isAdItem = (cats.includes('Damage') || cats.includes('AttackDamage') || cats.includes('CriticalStrike')) && !cats.includes('SpellDamage');
        if (isApItem) apCount++;
        else if (isAdItem) adCount++;
      }
    });
    damageType = apCount > adCount ? 'AP' : 'AD';
  }
  
  const tacticRole = champ.tacticRole || champ.tactic_role || 'teamfight';
  const champClass = champ.class || '';
  const isAssassin = tacticRole === 'burst' || tacticRole === 'assassin' || champClass === 'Assassin';

  // 1. Botas: filtrar si están blacklisteadas y reemplazarlas si es necesario
  const bootId = typeof b.items?.boots === 'object'
    ? (b.items.boots.id || b.items.boots.itemId)
    : (Number(b.items?.boots) || 3047);

  // Mismos filtros de selectBootsForCluster
  const BOOTS_BLACKLIST_BY_ROLE: Record<string, number[]> = {
    burst:    [3006],  // no attack speed en asesinos
    dive:     [3006],
    assassin: [3006],
  };
  const blacklisted = BOOTS_BLACKLIST_BY_ROLE[tacticRole] || [];
  
  let category = 'AD_FIGHTER';
  if (damageType === 'AP') {
    category = 'AP';
  } else if (damageType === 'AD') {
    category = isAssassin ? 'AD_ASSASSIN' : 'AD_FIGHTER';
  }
  const categoryBlacklist = BOOTS_BLACKLIST[category] || [];
  const combinedBlacklist = [...new Set([...blacklisted, ...categoryBlacklist])];

  let finalBootId = bootId;
  let bootSelectionReason = "Botas estándar de tu build recomendada";
  if (combinedBlacklist.includes(bootId)) {
    if (category === 'AD_ASSASSIN') {
      finalBootId = 3158; // Ionian Boots of Lucidity
      bootSelectionReason = "Botas adaptadas: se evitaron Berserker's en asesino";
    } else if (category === 'AP') {
      finalBootId = 3020; // Sorcerer's Shoes
      bootSelectionReason = "Botas adaptadas: se evitaron incompatibles en AP";
    } else {
      finalBootId = 3047; // Plated Steelcaps
      bootSelectionReason = "Botas adaptadas: fallback seguro";
    }
  }

  // 2. Starter
  let starter = b.items?.starter || [];
  if (Array.isArray(starter)) {
    starter = starter.map((i: any) => typeof i === 'object' ? Number(i.id || i.itemId) : Number(i));
  }
  if (myRole.toLowerCase() === 'utility' && !starter.includes(3858)) {
    starter = [3858, ...starter.filter((id: number) => id !== 3858)];
  }

  // 3. Core Items: filtrar items incoherentes (AP en AD, Black Cleaver en asesino, etc.)
  const cleanCoreIds = coreIds.filter((id: number) => isItemCoherentWithCluster(id, damageType as any));

  // 4. Paths: filtrar y asegurar coherencia
  const paths = b.items?.paths;
  const finalSnowball = (paths?.snowball || []).map((i: any) => typeof i === 'object' ? i.id : i);
  const finalNeutral = (paths?.neutral || []).map((i: any) => typeof i === 'object' ? i.id : i);
  const finalBehind = (paths?.behind || []).map((i: any) => typeof i === 'object' ? i.id : i);

  const cleanSnowball = finalSnowball
    .map(Number)
    .filter((id: number) => isItemCoherentWithCluster(id, damageType as any) && !cleanCoreIds.includes(id) && id !== finalBootId);
  const cleanNeutral = finalNeutral
    .map(Number)
    .filter((id: number) => isItemCoherentWithCluster(id, damageType as any) && !cleanCoreIds.includes(id) && id !== finalBootId);
  const cleanBehind = finalBehind
    .map(Number)
    .filter((id: number) => isItemCoherentWithCluster(id, damageType as any) && !cleanCoreIds.includes(id) && id !== finalBootId);

  // Asegurar relleno de ramas
  const fillBranch = (list: number[], type: 'offensive' | 'balanced' | 'defensive'): number[] => {
    const uniqueList = [...new Set(list)];
    const branchFallbacks = damageType === 'AP' 
      ? AP_FALLBACKS[type] 
      : (isAssassin ? AD_ASSASSIN_FALLBACKS[type] : AD_FIGHTER_FALLBACKS[type]);
    
    for (const item of branchFallbacks) {
      if (uniqueList.length >= 2) break;
      if (!cleanCoreIds.includes(item) && item !== finalBootId && !uniqueList.includes(item) && isItemCoherentWithCluster(item, damageType as any)) {
        uniqueList.push(item);
      }
    }
    return uniqueList.slice(0, 2);
  };

  const finalCleanSnowball = fillBranch(cleanSnowball, 'offensive');
  const finalCleanNeutral = fillBranch(cleanNeutral, 'balanced');
  const finalCleanBehind = fillBranch(cleanBehind, 'defensive');

  // Rellenar cleanCoreIds a 5 si quedó corto por el filtrado
  for (const id of finalCleanNeutral) {
    if (cleanCoreIds.length >= 5) break;
    if (!cleanCoreIds.includes(id)) {
      cleanCoreIds.push(id);
    }
  }
  const fallbacks = damageType === 'AP' 
    ? AP_FALLBACKS 
    : (isAssassin ? AD_ASSASSIN_FALLBACKS : AD_FIGHTER_FALLBACKS);
  const genericFallbacks = [...fallbacks.offensive, ...fallbacks.balanced];
  for (const id of genericFallbacks) {
    if (cleanCoreIds.length >= 5) break;
    if (!cleanCoreIds.includes(id) && isItemCoherentWithCluster(id, damageType as any) && id !== finalBootId) {
      cleanCoreIds.push(id);
    }
  }

  // 5. Runas y Shards: filtrar y sanitizar
  let selections = (b.runes?.selections || []).map((id: any) => typeof id === 'object' ? Number(id.id) : Number(id));
  let shards = (b.runes?.shards || []).map((id: any) => typeof id === 'object' ? Number(id.id) : Number(id));
  const primaryStyle = b.runes?.primaryStyleId || 8000;
  const secondaryStyle = b.runes?.subStyleId || 8400;

  // Evitar runa Precision (9104, 9101) secundaria en asesinos
  if (secondaryStyle === 8000 && isAssassin) {
    const PRECISION_BLACKLIST_ASSASSIN = [9104, 9101];
    selections = selections.map((runeId, idx) => {
      if (idx >= 4 && PRECISION_BLACKLIST_ASSASSIN.includes(runeId)) {
        const otherIdx = idx === 4 ? 5 : 4;
        const otherRune = selections[otherIdx];
        return otherRune === 8014 ? 9111 : 8014;
      }
      return runeId;
    });
  }

  // Shards: evitar Attack Speed (5005) en asesinos y AP
  shards = shards.map((shardId) => {
    if (shardId === 5005 && (isAssassin || damageType === 'AP')) {
      return 5008; // Adaptive Force
    }
    return shardId;
  });

  const supportEvolution = selectSupportItemEvolution(champ.name, myRole);
  let hydratedSupportEvolution = null;
  if (supportEvolution) {
    hydratedSupportEvolution = {
      item: hydrateAsset('items', supportEvolution.itemId),
      reason: supportEvolution.reason
    };
  }

  return {
    name: champ.name,
    isAdapted: finalBootId !== bootId || cleanCoreIds.some((id, idx) => {
      const orig = coreIds[idx];
      return orig !== id;
    }),
    bootsSelection: {
      bootId: finalBootId,
      reason: bootSelectionReason
    },
    supportEvolution: hydratedSupportEvolution,
    coreItemSwaps: [],
    scoredClusters: [], // Fallback: sin datos de clusters dinámicos
    build: {
      summoners: b.summoners?.map((id: number) => hydrateAsset('summoners', id)) || [hydrateAsset('summoners', 4), hydrateAsset('summoners', 12)],
      runes: {
        primaryStyle,
        secondaryStyle,
        keystone: hydrateAsset('runes', selections[0] || 8010),
        shards: shards.map((id: number) => hydrateAsset('shards', id)),
        selections: selections.map((id: number) => hydrateAsset('runes', id))
      },
      items: {
        starter: starter.map((id: number) => hydrateAsset('items', id)),
        boots: hydrateAsset('items', finalBootId),
        core: cleanCoreIds.map((id: number) => hydrateAsset('items', id)),
        paths: {
          snowball: finalCleanSnowball.map((id: number) => hydrateAsset('items', id)),
          neutral: finalCleanNeutral.map((id: number) => hydrateAsset('items', id)),
          behind: finalCleanBehind.map((id: number) => hydrateAsset('items', id))
        }
      },
      skillOrder: "Q > W > E"
    }
  };
}


export function getPathsForBuild(
  slotItems: any,
  coreItemIds: number[],
  damageType: string,
  adaptedBootId: number,
  isAssassin: boolean = false
): { snowball: number[], neutral: number[], behind: number[] } {
  const itemPoolMap = new Map<number, { id: number, pickrate: number, winrate: number }>();

  Object.keys(slotItems || {}).forEach(slotKey => {
    const arr = slotItems[slotKey] || [];
    arr.forEach((item: any) => {
      const id = Number(item.Id || item.id);
      if (!id) return;
      const existing = itemPoolMap.get(id);
      if (!existing || item.pickrate > existing.pickrate) {
        itemPoolMap.set(id, { id, pickrate: item.pickrate, winrate: item.winrate });
      }
    });
  });

  const candidates: { id: number, pickrate: number, winrate: number }[] = [];
  const coreSet = new Set(coreItemIds);
  const bootSet = new Set([3047, 3111, 3020, 3006, 3158, 3009, 3117, 223047, 223111]);

  itemPoolMap.forEach(cand => {
    if (coreSet.has(cand.id)) return;
    if (bootSet.has(cand.id)) return;
    if (!isItemCoherentWithCluster(cand.id, damageType as any)) return;
    const asset = hydrateAsset('items', cand.id);
    if (!asset || asset.gold === undefined || asset.gold < 1500) return;
    candidates.push(cand);
  });

  let minPickrate = 10.0;
  let filteredCandidates = candidates.filter(c => c.pickrate >= minPickrate);
  if (filteredCandidates.length < 4) {
    minPickrate = 3.0;
    filteredCandidates = candidates.filter(c => c.pickrate >= minPickrate);
  }
  if (filteredCandidates.length < 2) {
    filteredCandidates = candidates;
  }

  const offensiveCandidates: number[] = [];
  const balancedCandidates: number[] = [];
  const defensiveCandidates: number[] = [];

  filteredCandidates.forEach(cand => {
    const type = classifyItem(cand.id);
    if (type === 'offensive') offensiveCandidates.push(cand.id);
    else if (type === 'balanced') balancedCandidates.push(cand.id);
    else if (type === 'defensive') defensiveCandidates.push(cand.id);
  });

  const fillBranch = (currentList: number[], type: 'offensive' | 'balanced' | 'defensive'): number[] => {
    const list = [...new Set(currentList)];
    const fallbacks = damageType === 'AP' 
      ? AP_FALLBACKS[type] 
      : (isAssassin ? AD_ASSASSIN_FALLBACKS[type] : AD_FIGHTER_FALLBACKS[type]);
    
    for (const item of fallbacks) {
      if (list.length >= 2) break;
      if (!coreSet.has(item) && item !== adaptedBootId && !list.includes(item) && isItemCoherentWithCluster(item, damageType as any)) {
        list.push(item);
      }
    }
    return list.slice(0, 2);
  };

  return {
    snowball: fillBranch(offensiveCandidates, 'offensive'),
    neutral: fillBranch(balancedCandidates, 'balanced'),
    behind: fillBranch(defensiveCandidates, 'defensive')
  };
}

export function getDynamicPaths(
  slotItems: any,
  coreItemIds: number[],
  damageType: string,
  adaptedBootId: number,
  enemyContext: {
    enemyADCount: number;
    enemyAPCount: number;
    enemyTankCount: number;
    enemyCCCount: number;
    enemyHealerCount: number;
    realTanks?: number;
  },
  isAssassin: boolean = false
): { snowball: number[], neutral: number[], behind: number[] } {
  const candidatesMap = new Map<number, { id: number; pickrate: number; winrate: number }>();

  const slotsToCheck = ['item4', 'item5', 'item3'];
  
  slotsToCheck.forEach(slotKey => {
    const arr = slotItems?.[slotKey] || [];
    arr.forEach((item: any) => {
      const id = Number(item.Id || item.id);
      if (!id) return;
      
      const existing = candidatesMap.get(id);
      const pickrate = parseFloat(item.pickrate || item.pickRate || 0);
      const winrate = parseFloat(item.winrate || item.winRate || 0);
      
      if (!existing || pickrate > existing.pickrate) {
        candidatesMap.set(id, { id, pickrate, winrate });
      }
    });
  });

  const coreSet = new Set(coreItemIds);
  const bootSet = new Set([3047, 3111, 3020, 3006, 3158, 3009, 3117, 223047, 223111]);

  // Filtramos los candidatos que son estructuralmente válidos y coherentes
  const eligibleCandidates = Array.from(candidatesMap.values()).filter(cand => {
    if (coreSet.has(cand.id)) return false;
    if (bootSet.has(cand.id)) return false;
    if (!isItemCoherentWithCluster(cand.id, damageType as any)) return false;
    const asset = hydrateAsset('items', cand.id);
    if (!asset || asset.gold === undefined || asset.gold < 1500) return false;
    return true;
  });

  // Filtrado por pickrate usando un umbral dinámico adaptativo
  let minPr = 2.0; // Umbral inicial de pickrate para evitar trolls / off-meta
  let prFiltered = eligibleCandidates.filter(c => c.pickrate >= minPr);
  if (prFiltered.length < 4) {
    minPr = 1.0; // Bajar el umbral si hay pocas opciones
    prFiltered = eligibleCandidates.filter(c => c.pickrate >= minPr);
  }
  if (prFiltered.length < 2) {
    prFiltered = eligibleCandidates; // Fallback absoluto
  }

  const candidates: { id: number; pickrate: number; winrate: number; score: number }[] = [];

  prFiltered.forEach(cand => {
    let score = cand.winrate + cand.pickrate * 0.5;

    // 1. Grievous Wounds
    if (ITEM_CATEGORIES.GRIEVOUS_WOUNDS.includes(cand.id)) {
      if (enemyContext.enemyHealerCount >= 1) {
        score += 15.0 * enemyContext.enemyHealerCount;
      } else {
        score -= 15.0;
      }
    }

    // 2. Penetración
    if (ITEM_CATEGORIES.ARMOR_PEN.includes(cand.id)) {
      if (damageType === 'AD') {
        const realTanksCount = enemyContext.realTanks !== undefined ? enemyContext.realTanks : enemyContext.enemyTankCount;
        if (realTanksCount >= 2) {
          score += 12.0 * realTanksCount;
        } else {
          score -= 10.0;
        }
      } else {
        score -= 25.0;
      }
    }
    if (ITEM_CATEGORIES.MAGIC_PEN.includes(cand.id)) {
      if (damageType === 'AP') {
        if (enemyContext.enemyTankCount >= 1) {
          score += 12.0 * enemyContext.enemyTankCount;
        } else {
          score -= 5.0;
        }
      } else {
        score -= 25.0;
      }
    }

    // 3. Resistencia Mágica
    if (ITEM_CATEGORIES.MAGIC_RESIST.includes(cand.id)) {
      if (enemyContext.enemyAPCount >= 3) {
        score += 15.0;
      } else if (enemyContext.enemyAPCount === 2) {
        score += 5.0;
      } else {
        score -= 10.0;
      }
    }

    // 4. Armadura
    if (ITEM_CATEGORIES.ARMOR.includes(cand.id)) {
      if (enemyContext.enemyADCount >= 3) {
        score += 15.0;
      } else if (enemyContext.enemyADCount === 2) {
        score += 5.0;
      } else {
        score -= 10.0;
      }
    }

    // 5. Tenacidad
    if (ITEM_CATEGORIES.TENACITY.includes(cand.id)) {
      if (enemyContext.enemyCCCount >= 2) {
        score += 10.0;
      }
    }

    candidates.push({ ...cand, score });
  });

  const offensive: number[] = [];
  const balanced: number[] = [];
  const defensive: number[] = [];

  candidates.sort((a, b) => b.score - a.score);

  candidates.forEach(c => {
    const type = classifyItem(c.id);
    if (type === 'offensive') offensive.push(c.id);
    else if (type === 'balanced') balanced.push(c.id);
    else if (type === 'defensive') defensive.push(c.id);
  });

  const fillBranch = (currentList: number[], type: 'offensive' | 'balanced' | 'defensive'): number[] => {
    const list = [...new Set(currentList)];
    const fallbacks = damageType === 'AP' 
      ? AP_FALLBACKS[type] 
      : (isAssassin ? AD_ASSASSIN_FALLBACKS[type] : AD_FIGHTER_FALLBACKS[type]);
    
    for (const item of fallbacks) {
      if (list.length >= 2) break;
      if (!coreSet.has(item) && item !== adaptedBootId && !list.includes(item) && isItemCoherentWithCluster(item, damageType as any)) {
        list.push(item);
      }
    }
    return list.slice(0, 2);
  };

  return {
    snowball: fillBranch(offensive, 'offensive'),
    neutral: fillBranch(balanced, 'balanced'),
    behind: fillBranch(defensive, 'defensive')
  };
}

// --- CONSTANTES Y CONFIGURACIÓN DE UMBRALES DE ADAPTACIÓN ---
export const ADAPTATION_THRESHOLDS = {
  antiHeal: {
    minHealerCount: 2,
    minChampPickrate: 3.0,
    maxCoreDisruption: 1,
  },
  tankPen: {
    minTankCount: 2,
    minChampPickrate: 2.0,
  },
  defensiveItem: {
    minThreatCount: 3,
    minChampPickrate: 1.5,
  }
};

const SUPPORT_ITEM_IDS = [3869, 3870, 3871, 3876, 3877];
const SUPPORT_ITEM_QUEST_IDS = [3850, 3851, 3853, 3855, 3858, 3859, 3860, 3862, 3864];

export function getItemsByCategory(category: string): number[] {
  if (category === 'AntiHeal' || category === 'GrievousWounds') {
    return ITEM_CATEGORIES.GRIEVOUS_WOUNDS;
  }
  if (category === 'ArmorPen') {
    return ITEM_CATEGORIES.ARMOR_PEN;
  }
  if (category === 'MagicPen') {
    return ITEM_CATEGORIES.MAGIC_PEN;
  }
  if (category === 'Armor') {
    return ITEM_CATEGORIES.ARMOR;
  }
  if (category === 'MagicResist') {
    return ITEM_CATEGORIES.MAGIC_RESIST;
  }
  if (category === 'Tenacity') {
    return ITEM_CATEGORIES.TENACITY;
  }
  return [];
}

export function isItemViableForChamp(itemId: number, champName: string): boolean {
  const champData = ENRICHED_DB[champName];
  if (!champData) return false;
  
  let minPickrate = 3.0;
  
  if (ITEM_CATEGORIES.GRIEVOUS_WOUNDS.includes(itemId)) {
    minPickrate = ADAPTATION_THRESHOLDS.antiHeal.minChampPickrate;
  } else if (ITEM_CATEGORIES.ARMOR_PEN.includes(itemId) || ITEM_CATEGORIES.MAGIC_PEN.includes(itemId)) {
    minPickrate = ADAPTATION_THRESHOLDS.tankPen.minChampPickrate;
  } else if (ITEM_CATEGORIES.ARMOR.includes(itemId) || ITEM_CATEGORIES.MAGIC_RESIST.includes(itemId) || ITEM_CATEGORIES.TENACITY.includes(itemId)) {
    minPickrate = ADAPTATION_THRESHOLDS.defensiveItem.minChampPickrate;
  }
  
  const allSlotItems = Object.values(champData.buildData?.slotItems || {}).flat();
  const inPool = allSlotItems.find((i: any) => 
    Number(i.Id || i.id) === itemId
  ) as any;
  
  if (inPool) {
    const pickrate = parseFloat(inPool.pickrate || inPool.pickRate || 0);
    if (pickrate >= minPickrate) return true;
  }
  
  const item = ITEMS_DB[itemId];
  const champDmgType = champData.damageType;
  const itemCats = item?.categories || [];
  
  if (champDmgType === 'AD' && itemCats.includes('SpellDamage') && !itemCats.includes('Damage')) 
    return false;
  if (champDmgType === 'AP' && itemCats.includes('AttackDamage') && !itemCats.includes('SpellDamage')) 
    return false;
  
  return true;
}

export interface CoreItemSwap {
  replaceItem: number;
  withItem: number;
  reason: string;
  priority: 'critical' | 'recommended' | 'optional';
}

export function getCoreItemSwaps(
  coreItems: number[],
  enemyContext: {
    enemyADCount: number;
    enemyAPCount: number;
    enemyTankCount: number;
    enemyCCCount: number;
    enemyHealerCount: number;
    realTanks?: number;
  },
  champProfile: any
): CoreItemSwap[] {
  const swaps: CoreItemSwap[] = [];
  const champName = champProfile.name;

  if (coreItems.includes(3135) && enemyContext.enemyTankCount === 0) {
    const targetItem = 4645;
    if (isItemViableForChamp(targetItem, champName) && isItemCoherentWithCluster(targetItem, champProfile.damageType)) {
      swaps.push({
        replaceItem: 3135,
        withItem: targetItem,
        reason: "No hay tanques que justifiquen Void Staff. Shadowflame maximiza el burst contra objetivos blandos.",
        priority: 'recommended'
      });
    }
  }

  if (swaps.length >= ADAPTATION_THRESHOLDS.antiHeal.maxCoreDisruption) {
    return swaps;
  }

  const hasAntiHeal = coreItems.some(id => ITEM_CATEGORIES.GRIEVOUS_WOUNDS.includes(id));
  if (!hasAntiHeal && enemyContext.enemyHealerCount >= ADAPTATION_THRESHOLDS.antiHeal.minHealerCount) {
    const isAP = champProfile.damageType === 'AP';
    let bestAntiHeal = isAP ? 3165 : 3033;
    
    if (champProfile.class === 'Tank') bestAntiHeal = 3075;
    else if (champProfile.class === 'Fighter' && !isAP) bestAntiHeal = 3181;
    
    let viableAntiHeal: number | null = bestAntiHeal;
    if (!isItemViableForChamp(bestAntiHeal, champName)) {
      const alternatives = getItemsByCategory('AntiHeal')
        .filter(id => isItemViableForChamp(id, champName));
      
      if (alternatives.length === 0) {
        viableAntiHeal = null;
      } else {
        const classPref: number[] = [];
        if (champProfile.class === 'Tank') classPref.push(3075);
        if (champProfile.class === 'Fighter') classPref.push(3181, 3075);
        if (isAP) classPref.push(3165);
        else classPref.push(3033, 3181);
        
        const sortedAlternatives = [...alternatives].sort((a, b) => {
          const idxA = classPref.indexOf(a);
          const idxB = classPref.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return 0;
        });
        viableAntiHeal = sortedAlternatives[0] || null;
      }
    }
    
    if (viableAntiHeal !== null && isItemCoherentWithCluster(viableAntiHeal, champProfile.damageType)) {
      swaps.push({
        replaceItem: coreItems[coreItems.length - 1],
        withItem: viableAntiHeal,
        reason: `${enemyContext.enemyHealerCount} fuentes de curación en el enemigo. Obligatorio comprar Heridas Graves.`,
        priority: 'critical'
      });
    }
  }

  if (swaps.length >= ADAPTATION_THRESHOLDS.antiHeal.maxCoreDisruption) {
    return swaps;
  }

  const hasPen = coreItems.some(id => 
    ITEM_CATEGORIES.ARMOR_PEN.includes(id) || ITEM_CATEGORIES.MAGIC_PEN.includes(id)
  );
  if (!hasPen) {
    const isAP = champProfile.damageType === 'AP';
    if (isAP) {
      if (enemyContext.enemyTankCount >= ADAPTATION_THRESHOLDS.tankPen.minTankCount) {
        const bestPen = 3135;
        let viablePen: number | null = bestPen;
        if (!isItemViableForChamp(bestPen, champName)) {
          const alternatives = ITEM_CATEGORIES.MAGIC_PEN.filter(id => isItemViableForChamp(id, champName));
          viablePen = alternatives[0] || null;
        }
        if (viablePen !== null && isItemCoherentWithCluster(viablePen, champProfile.damageType)) {
          swaps.push({
            replaceItem: coreItems[coreItems.length - 1],
            withItem: viablePen,
            reason: `${enemyContext.enemyTankCount} tanques enemigos. Se requiere penetración para infligir daño.`,
            priority: 'recommended'
          });
        }
      }
    } else {
      const realTanksCount = enemyContext.realTanks !== undefined ? enemyContext.realTanks : enemyContext.enemyTankCount;
      if (realTanksCount >= 2) {
        const bestPen = 3036;
        let viablePen: number | null = bestPen;
        if (!isItemViableForChamp(bestPen, champName)) {
          const alternatives = ITEM_CATEGORIES.ARMOR_PEN.filter(id => isItemViableForChamp(id, champName));
          viablePen = alternatives[0] || null;
        }
        if (viablePen !== null && isItemCoherentWithCluster(viablePen, champProfile.damageType)) {
          swaps.push({
            replaceItem: coreItems[coreItems.length - 1],
            withItem: viablePen,
            reason: `${realTanksCount} tanques reales enemigos. Se requiere penetración de armadura para infligir daño.`,
            priority: 'recommended'
          });
        }
      }
    }
  }

  return swaps;
}

export function champUsesQuestItem(champName: string, myRole: string): boolean {
  if (myRole.toLowerCase() === 'utility' || myRole.toLowerCase() === 'support') {
    return true;
  }
  const champData = ENRICHED_DB[champName];
  const starter = champData?.buildData?.starter || [];
  return starter.some((id: number) => SUPPORT_ITEM_QUEST_IDS.includes(id));
}

export function selectSupportItemEvolution(champName: string, myRole: string): { itemId: number, reason: string } | null {
  if (!champUsesQuestItem(champName, myRole)) return null;
  
  const champ = ENRICHED_DB[champName];
  if (!champ) return null;
  const tacticRole = champ.tacticRole;
  const damageType = champ.damageType;
  
  if (tacticRole === 'peel' || champ.teamProvides?.includes('healing') || champ.teamProvides?.includes('shields') || champ.class === 'Enchanter')
    return { itemId: 3869, reason: "Encantadora con heal/shield — Hoja Zelote maximiza el uptime de protección" };
  
  if (tacticRole === 'engage' || champ.isFrontline || champ.class === 'Tank')
    return { itemId: 3876, reason: "Support de iniciación — Oposición Celestial aporta resistencias para sobrevivir el engage" };
  
  if (damageType === 'AP' && (tacticRole === 'poke' || champ.class === 'Mage'))
    return { itemId: 3877, reason: "Support de daño — Canción de Sangre amplifica el burst mágico" };
  
  if (tacticRole === 'skirmish' || champ.tags?.includes('Assassin') || champ.class === 'Assassin')
    return { itemId: 3871, reason: "Support de roam — Media Luna maximiza el control de visión y la movilidad" };
  
  return { itemId: 3870, reason: "Evolución estándar de utilidad para supports de control" };
}

/**
 * Calculates a combined viability score weighting winrate by pickrate confidence.
 * @param winrate - Win rate percentage.
 * @param pickrate - Pick rate percentage.
 * @returns Viability score.
 */
export function viabilityScore(winrate: number, pickrate: number): number {
  const confidence = pickrate < 2 ? pickrate / 2 : Math.min(pickrate / 10, 1.0);
  return (winrate - 50) * 2 * confidence;
}

/**
 * Classifies a list of item IDs to determine their overall damage type.
 * @param itemIds - Array of item IDs.
 * @returns 'AD' | 'AP' | 'Hybrid'
 */
export function classifyItemsDamageType(itemIds: number[]): 'AD' | 'AP' | 'Hybrid' {
  const apItems = [3089, 3152, 3115, 3102, 3157, 3165, 6653, 3001, 3003, 3007, 3092, 3100, 3118, 3185, 4629, 3135, 3137, 4633, 2510, 4645, 3124];
  const adItems = [6697, 6699, 6696, 3179, 3814, 3142, 6695, 6698, 6693, 6692, 3071, 6333, 3053, 3156, 3161, 3078, 6610, 6631, 3074, 6609, 3026, 2501, 3031, 3046, 3094, 3085, 3091, 3153, 6672, 3033, 3035, 3036, 4642];

  let apScore = 0;
  let adScore = 0;

  for (const itemId of itemIds) {
    const baseId = itemId > 220000 ? itemId % 220000 : itemId;
    const item = ITEMS_DB[baseId];
    if (item) {
      const cats = item.categories || [];
      const isAp = cats.some(c => ['SpellDamage', 'MagicPenetration', 'AbilityPower', 'SpellVamp'].includes(c));
      const isAd = cats.some(c => ['Damage', 'AttackDamage', 'Lethality', 'ArmorPenetration', 'CriticalStrike', 'LifeSteal'].includes(c));
      if (isAp && isAd) {
        apScore++;
        adScore++;
      } else if (isAp) {
        apScore++;
      } else if (isAd) {
        adScore++;
      }
    } else {
      if (apItems.includes(baseId)) apScore++;
      else if (adItems.includes(baseId)) adScore++;
    }
  }

  if (apScore > 0 && adScore > 0) {
    if (apScore >= 2 * adScore) return 'AP';
    if (adScore >= 2 * apScore) return 'AD';
    return 'Hybrid';
  }
  if (apScore > 0) return 'AP';
  if (adScore > 0) return 'AD';
  return 'AD';
}

/**
 * Detects distinct build clusters for a champion using coreItem2 fingerprint.
 * @param dpmData - Raw DPM data for the champion.
 * @returns Ordered array of detected clusters.
 */
export function detectBuildClusters(dpmData: any): BuildCluster[] {
  const coreItem2 = dpmData?.coreBuilds?.coreItem2;
  if (!Array.isArray(coreItem2) || coreItem2.length === 0) {
    return [];
  }

  const relevantPairs = coreItem2.filter((c: any) => c.itemIds && c.itemIds.length >= 1 && (c.pickrate || 0) >= 3.0);

  const groups: Record<number, any[]> = {};
  relevantPairs.forEach((pair: any) => {
    const pivot = pair.itemIds[0];
    if (!groups[pivot]) {
      groups[pivot] = [];
    }
    groups[pivot].push(pair);
  });

  const clusters: BuildCluster[] = [];

  Object.keys(groups).forEach(pivotKey => {
    const pivotItem = Number(pivotKey);
    const clusterItems = groups[pivotItem];

    let totalPickrate = 0;
    let totalGames = 0;
    let weightedWinrateSum = 0;

    clusterItems.forEach((pair: any) => {
      const pr = pair.pickrate || 0;
      const wr = pair.winrate || 50.0;
      const games = pair.games || 0;
      totalPickrate += pr;
      
      const weight = games > 0 ? games : (pr > 0 ? pr : 1);
      totalGames += weight;
      weightedWinrateSum += wr * weight;
    });

    const weightedWinrate = totalGames > 0 ? (weightedWinrateSum / totalGames) : 50.0;

    let representativeCore: number[] = [];
    const coreItem3 = dpmData?.coreBuilds?.coreItem3 || [];
    const matchingCore3 = coreItem3
      .filter((c: any) => c.itemIds && c.itemIds.includes(pivotItem))
      .sort((a: any, b: any) => (b.pickrate || 0) - (a.pickrate || 0));

    if (matchingCore3.length > 0) {
      representativeCore = matchingCore3[0].itemIds;
    } else {
      const bestPair = [...clusterItems].sort((a, b) => (b.pickrate || 0) - (a.pickrate || 0))[0];
      representativeCore = bestPair ? [...bestPair.itemIds] : [pivotItem];
    }

    const damageType = classifyItemsDamageType(representativeCore);

    clusters.push({
      pivotItem,
      representativeCore,
      totalPickrate,
      weightedWinrate,
      damageType
    });
  });

  return clusters.sort((a, b) => b.totalPickrate - a.totalPickrate);
}

/**
 * Scores a build cluster in the context of the draft.
 * @param cluster - Cluster object.
 * @param allies - Array of ally champion names.
 * @param enemies - Array of enemy champion names.
 * @param champData - Champion profile data.
 * @returns Score.
 */
export function scoreClusterInContext(
  cluster: BuildCluster,
  allies: string[],
  enemies: string[],
  champData: any
): number {
  const wrContrib = (cluster.weightedWinrate - 50) * 2;
  const prContrib = Math.log10(cluster.totalPickrate || 1) * 2;
  const baseScore = wrContrib + prContrib;
  let score = baseScore;

  const bonuses: { label: string; value: number }[] = [];

  const enemyEnriched = enemies.map(name => ENRICHED_DB[name]).filter(Boolean);
  const enemyComp = analyzeComposition(enemies);

  const healersCount = enemyComp.healerCount;

  let highMrCount = 0;
  enemyEnriched.forEach(e => {
    const isTankClass = e.class === 'Tank';
    const coreItems = e.buildData?.items?.core || [];
    const hasMrItem = coreItems.some((id: number) => {
      const baseId = id > 220000 ? id % 220000 : id;
      const item = ITEMS_DB[baseId];
      if (!item) return false;
      return item.categories.includes('GivesMagicResist') && item.gold >= 2000;
    });
    const isSquishy = ['Marksman', 'Assassin', 'Mage'].includes(e.class);
    if ((isTankClass || hasMrItem) && !isSquishy) {
      highMrCount++;
    }
  });

  // Healers bonus for AP
  if (cluster.damageType === 'AP' && healersCount > 0) {
    let healerBonus = 0;
    if (healersCount === 1) healerBonus = 1.0;
    else if (healersCount === 2) healerBonus = 3.0;
    else healerBonus = 5.0;
    score += healerBonus;
    bonuses.push({ label: `AP healer bonus (${healersCount} healers)`, value: healerBonus });
  }

  // High MR penalty for AP
  if (cluster.damageType === 'AP' && highMrCount > 0) {
    let mrPenalty = 0;
    if (highMrCount === 1) mrPenalty = -2.0;
    else if (highMrCount === 2) mrPenalty = -6.0;
    else if (highMrCount === 3) mrPenalty = -12.0;
    else mrPenalty = -18.0;
    score += mrPenalty;
    bonuses.push({ label: `AP highMR penalty (${highMrCount} MR enemies)`, value: mrPenalty });
  }

  // High Armor penalty for AD
  let highArmorCount = 0;
  enemyEnriched.forEach(e => {
    const isTankClass = e.class === 'Tank';
    const coreItems = e.buildData?.items?.core || [];
    const hasArmorItem = coreItems.some((id: number) => {
      const baseId = id > 220000 ? id % 220000 : id;
      const item = ITEMS_DB[baseId];
      if (!item) return false;
      return item.categories.includes('GivesArmor') && item.gold >= 2000;
    });
    const isSquishy = ['Marksman', 'Assassin', 'Mage'].includes(e.class);
    if ((isTankClass || hasArmorItem) && !isSquishy) {
      highArmorCount++;
    }
  });

  if (cluster.damageType === 'AD' && highArmorCount > 0) {
    let armorPenalty = 0;
    if (highArmorCount === 1) armorPenalty = -2.0;
    else if (highArmorCount === 2) armorPenalty = -6.0;
    else if (highArmorCount === 3) armorPenalty = -12.0;
    else armorPenalty = -18.0;
    score += armorPenalty;
    bonuses.push({ label: `AD highArmor penalty (${highArmorCount} Armor enemies)`, value: armorPenalty });
  }

  // Penalización por sobrecarga de tipo de daño aliado (evitar stacking defensivo enemigo)
  const allyComp = analyzeComposition(allies);
  if (cluster.damageType === 'AD' && allyComp.adCount >= 3) {
    const penalty = allyComp.adCount === 3 ? -6.0 : -16.0;
    score += penalty;
    bonuses.push({ label: `AD ally overload penalty (${allyComp.adCount} AD allies)`, value: penalty });
  }
  if (cluster.damageType === 'AP' && allyComp.apCount >= 3) {
    const penalty = allyComp.apCount === 3 ? -6.0 : -16.0;
    score += penalty;
    bonuses.push({ label: `AP ally overload penalty (${allyComp.apCount} AP allies)`, value: penalty });
  }

  // Adjuntar desglose al objeto retornado para debug (se imprime desde getAdaptedBuild)
  (cluster as any).__scoreDebug = {
    wrContrib: +wrContrib.toFixed(3),
    prContrib: +prContrib.toFixed(3),
    baseScore: +baseScore.toFixed(3),
    bonuses,
    finalScore: +score.toFixed(3)
  };

  return score;
}

/**
 * Calcula el bonus contextual de botas según enemigos, cluster y rol.
 * @param bootId - ID de botas.
 * @param cluster - Cluster activo.
 * @param enemies - Lista de nombres de enemigos.
 * @param champData - Datos enriquecidos del campeón.
 * @returns Score bonus.
 */
export function calcBootContextBonus(
  bootId: number,
  cluster: BuildCluster,
  enemies: string[],
  champData?: EnrichedChampion
): number {
  const enemyComp = analyzeComposition(enemies);
  const ccCount = enemyComp.ccCount;
  const adCount = enemyComp.adCount;

  // Calcular tanques reales
  const realTanks = enemies.filter(name => {
    const e = ENRICHED_DB[name];
    if (!e) return false;
    const isFrontline = e.isFrontline === true || e.isFrontline === 1;
    const isTank = e.class === 'Tank';
    const physicalDmg = e.combat?.damageComposition?.physical !== undefined 
      ? e.combat.damageComposition.physical 
      : 100;
    return isFrontline && isTank && physicalDmg < 40;
  }).length;

  let category = 'AD_FIGHTER';
  if (cluster.damageType === 'AP') {
    category = 'AP';
  } else if (cluster.damageType === 'AD') {
    const tacticRole = champData?.tacticRole || champData?.tactic_role || '';
    const champClass = champData?.class || '';
    const isAssassin = tacticRole === 'burst' || tacticRole === 'assassin' || champClass === 'Assassin';
    category = isAssassin ? 'AD_ASSASSIN' : 'AD_FIGHTER';
  }

  let bonus = 0;
  if (bootId === 3111 && ccCount >= 3) {
    bonus += 5.0;
  }
  if (bootId === 3047) {
    if (realTanks >= 2 || adCount >= 3) {
      bonus += 3.0;
    } else {
      bonus -= 2.0;
    }
  }
  if (bootId === 3020 && cluster.damageType === 'AP') {
    bonus += 2.5;
  }
  if (bootId === 3158 && category === 'AD_ASSASSIN') {
    bonus += 2.5;
  }

  return bonus;
}

/**
 * Selects the most appropriate boots for the cluster.
 * @param boots - Array of boots options.
 * @param cluster - Cluster object.
 * @param enemies - Array of enemy champion names.
 * @param tacticRole - Champion tactic role.
 * @param champClass - Champion class.
 * @param champData - Champion profile data.
 * @returns Selected boot ID.
 */
export function selectBootsForCluster(
  boots: any[],
  cluster: BuildCluster,
  enemies: string[],
  tacticRole?: string,
  champClass?: string,
  champData?: EnrichedChampion
): number {
  if (!Array.isArray(boots) || boots.length === 0) {
    return 3047;
  }

  const BOOTS_BLACKLIST_BY_ROLE: Record<string, number[]> = {
    burst:    [3006],  // no attack speed en asesinos
    dive:     [3006],
    skirmish: [],      // fighters pueden llevarlas
    poke:     [3006],
    siege:    [3006],
  };

  const champRole = champData?.tacticRole || tacticRole || 'teamfight';
  const blacklisted = BOOTS_BLACKLIST_BY_ROLE[champRole] || [];

  let category = 'AD_FIGHTER';
  if (cluster.damageType === 'AP') {
    category = 'AP';
  } else if (cluster.damageType === 'AD') {
    const isAssassin = tacticRole === 'burst' || tacticRole === 'assassin' || champClass === 'Assassin';
    category = isAssassin ? 'AD_ASSASSIN' : 'AD_FIGHTER';
  }

  const categoryBlacklist = BOOTS_BLACKLIST[category] || [];
  const combinedBlacklist = [...new Set([...blacklisted, ...categoryBlacklist])];

  const filteredBoots = boots.filter(b => {
    const id = Number(b.itemId || b.id);
    return !combinedBlacklist.includes(id);
  });
  const bootPool = filteredBoots.length > 0 ? filteredBoots : boots;

  // Log de debug solicitado
  console.log('[BOOTS DEBUG] Scores calculados:', 
    bootPool.map(b => {
      const id = Number(b.itemId || b.id);
      const wr = b.winrate || 50.0;
      const pr = b.pickrate || 0;
      const viability = viabilityScore(wr, pr);
      const contextBonus = calcBootContextBonus(id, cluster, enemies, champData);
      return {
        id,
        viability,
        contextBonus,
        total: viability + contextBonus
      };
    })
  );

  let bestBootId = 3047;
  let maxScore = -9999;

  bootPool.forEach(b => {
    const id = Number(b.itemId || b.id);
    const wr = b.winrate || 50.0;
    const pr = b.pickrate || 0;
    
    const viability = viabilityScore(wr, pr);
    const contextBonus = calcBootContextBonus(id, cluster, enemies, champData);
    const score = viability + contextBonus;

    if (score > maxScore) {
      maxScore = score;
      bestBootId = id;
    }
  });

  return bestBootId;
}

/**
 * Helper to select the best rune from options.
 */
function selectBestRune(options: RuneOption[], isKeystone: boolean = false, clusterDmgType?: 'AD' | 'AP' | 'Hybrid', playstyle?: string): number {
  if (!Array.isArray(options) || options.length === 0) return 0;
  
  const filtered = options.filter(o => (o.pickrate || 0) >= 1.0);
  const candidates = filtered.length > 0 ? filtered : options;

  let bestId = 0;
  let maxScore = -9999;

  candidates.forEach(o => {
    const id = Number(o.Id || o.id);
    const wr = o.winrate || 50.0;
    const pr = o.pickrate || 0;
    
    let score = viabilityScore(wr, pr);

    if (isKeystone && playstyle) {
      const preferred = PLAYSTYLE_KEYSTONES[playstyle] || [];
      const prefIdx = preferred.indexOf(id);
      if (prefIdx !== -1) {
        // Bonificación decreciente según la prioridad del playstyle
        // Ejemplo: 1er elemento = +25.0, 2do = +20.0, 3er = +15.0, etc.
        const bonus = Math.max(5.0, 25.0 - prefIdx * 5.0);
        score += bonus;
      }
    } else if (isKeystone && clusterDmgType) {
      const apKeystones = [8112, 8128, 8229, 8214];
      const adKeystones = [8010, 8128, 8008, 9923]; // Corregido: incluye 9923 (Hail of Blades) y remueve 8000
      
      if (clusterDmgType === 'AP' && apKeystones.includes(id)) {
        score += 2.0;
      } else if (clusterDmgType === 'AD' && adKeystones.includes(id)) {
        score += 2.0;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestId = id;
    }
  });

  return bestId;
}

/**
 * Filtra keystones por coherencia de cluster.
 * @param keystones - Opciones de keystones.
 * @param clusterDamageType - Daño del cluster.
 * @returns Lista filtrada de keystones.
 */
export function filterKeystonesByCluster(
  keystones: RuneOption[],
  clusterDamageType: 'AD' | 'AP' | 'Hybrid'
): RuneOption[] {
  const filtered = keystones.filter(rune => {
    const id = Number(rune.Id || rune.id);
    const runeType = KEYSTONE_DAMAGE_TYPE[id];
    
    if (!runeType) return true;
    if (runeType === 'Hybrid') return true;
    
    if (clusterDamageType === 'AD') return runeType === 'AD';
    if (clusterDamageType === 'AP') return runeType === 'AP';
    
    return true;
  });

  return filtered.length > 0 ? filtered : keystones;
}

/**
 * Filtra las opciones del árbol primario para que coincidan con el estilo de la keystone elegida.
 * @param runeOptions - Opciones de runas.
 * @param keystoneId - ID de la keystone elegida.
 * @param runeToStyle - Mapa de runa a estilo.
 * @returns Opciones filtradas.
 */
export function filterPrimaryTreeByKeystone(
  runeOptions: RuneOption[],
  keystoneId: number,
  runeToStyle: Record<number, number>
): RuneOption[] {
  const keystoneStyle = runeToStyle[keystoneId];
  if (!keystoneStyle) return runeOptions;
  
  const filtered = runeOptions.filter(rune => {
    const id = Number(rune.Id || rune.id);
    return runeToStyle[id] === keystoneStyle;
  });
  
  return filtered.length >= 1 ? filtered : runeOptions;
}

/**
 * Selecciona el mejor árbol secundario coherente con el cluster y excluyendo incompatibles.
 * @param secondaryRunes - Opciones de runas secundarias.
 * @param primaryStyleId - Estilo del árbol primario.
 * @param clusterDamageType - Daño del cluster.
 * @param runeToStyle - Mapa de runa a estilo.
 * @param champData - Datos enriquecidos del campeón.
 * @returns Estilo secundario y runas elegidas.
 */
export function getBestSecondaryRunesForCluster(
  secondaryRunes: RuneOption[],
  primaryStyleId: number,
  clusterDamageType: 'AD' | 'AP' | 'Hybrid',
  runeToStyle: Record<number, number>,
  champData?: EnrichedChampion,
  playstyle?: string
): { styleId: number; runes: RuneOption[] } {
  const EXCLUDED_SECONDARY_TREES: Record<string, number[]> = {
    AD: [8200],     // Sorcery
    AP: [8000],     // Precision
    Hybrid: [],
  };

  const excluded = EXCLUDED_SECONDARY_TREES[clusterDamageType] || [];

  const filterAndGroup = (runesList: RuneOption[], applyExclusions: boolean) => {
    const filtered = runesList.filter((o: any) => {
      const id = Number(o.Id || o.id);
      const styleId = Number(runeToStyle[id]);
      if (!styleId) return false;
      if (styleId === primaryStyleId) return false;
      if (id === 0) return false;

      // Exclusión por blacklist de asesinos en Precision (8000)
      if (styleId === 8000 && champData) {
        const tacticRole = champData.tacticRole || champData.tactic_role || '';
        if (['burst', 'dive'].includes(tacticRole)) {
          const PRECISION_BLACKLIST_ASSASSIN = [9104, 9101];
          if (PRECISION_BLACKLIST_ASSASSIN.includes(id)) {
            return false;
          }
        }
      }

      if (applyExclusions && excluded.includes(styleId)) return false;

      return (o.pickrate || 0) >= 1.0;
    });

    const groups: Record<number, RuneOption[]> = {};
    filtered.forEach((o: any) => {
      const id = Number(o.Id || o.id);
      const styleId = Number(runeToStyle[id]);
      if (!groups[styleId]) groups[styleId] = [];
      groups[styleId].push(o);
    });

    return groups;
  };

  let styleGroups = filterAndGroup(secondaryRunes, true);

  const findBestStyle = (groups: Record<number, RuneOption[]>) => {
    let bestId = 0;
    let maxScore = -9999;
    Object.entries(groups).forEach(([styleKey, opts]) => {
      const styleId = Number(styleKey);
      if (opts.length < 2) return;
      
      // Calcular los scores individuales de todas las opciones en este árbol
      const individualScores = opts.map((o: any) => viabilityScore(o.winrate || 50.0, o.pickrate || 0));
      
      // Ordenar de mayor a menor
      individualScores.sort((a, b) => b - a);
      
      // Sumar solo los 2 mejores, que es el número real de runas elegibles secundarias
      let totalScore = individualScores[0] + individualScores[1];

      if (playstyle) {
        const preferredStyles = PLAYSTYLE_SECONDARY_STYLES[playstyle] || [];
        const prefIdx = preferredStyles.indexOf(styleId);
        if (prefIdx !== -1) {
          // Bonificación decreciente según la prioridad del playstyle
          // Ejemplo: 1er elemento = +15.0, 2do = +10.0, etc.
          const bonus = Math.max(2.0, 15.0 - prefIdx * 5.0);
          totalScore += bonus;
        }
      }

      if (totalScore > maxScore) {
        maxScore = totalScore;
        bestId = styleId;
      }
    });
    return bestId;
  };

  let bestSecStyleId = findBestStyle(styleGroups);

  if (bestSecStyleId === 0) {
    styleGroups = filterAndGroup(secondaryRunes, false);
    bestSecStyleId = findBestStyle(styleGroups);
  }

  if (bestSecStyleId === 0) {
    const allSecOptions = secondaryRunes.filter((o: any) => {
      const id = Number(o.Id || o.id);
      const styleId = Number(runeToStyle[id]);
      
      // Exclusión por blacklist de asesinos en Precision
      if (styleId === 8000 && champData) {
        const tacticRole = champData.tacticRole || champData.tactic_role || '';
        if (['burst', 'dive'].includes(tacticRole)) {
          const PRECISION_BLACKLIST_ASSASSIN = [9104, 9101];
          if (PRECISION_BLACKLIST_ASSASSIN.includes(id)) {
            return false;
          }
        }
      }

      return styleId && styleId !== primaryStyleId && id !== 0;
    });

    const fallbackGroups: Record<number, RuneOption[]> = {};
    allSecOptions.forEach((o: any) => {
      const id = Number(o.Id || o.id);
      const styleId = Number(runeToStyle[id]);
      if (!fallbackGroups[styleId]) fallbackGroups[styleId] = [];
      fallbackGroups[styleId].push(o);
    });

    const sortedFallbackStyles = Object.entries(fallbackGroups).sort((a, b) => {
      const sumA = a[1].reduce((sum, o) => sum + (o.pickrate || 0), 0);
      const sumB = b[1].reduce((sum, o) => sum + (o.pickrate || 0), 0);
      return sumB - sumA;
    });

    const bestFallbackStyle = sortedFallbackStyles[0];
    if (bestFallbackStyle) {
      const styleId = Number(bestFallbackStyle[0]);
      const sortedOpts = bestFallbackStyle[1].sort((a, b) => (b.pickrate || 0) - (a.pickrate || 0));
      return {
        styleId,
        runes: sortedOpts.slice(0, 2)
      };
    }

    return {
      styleId: 8400,
      runes: []
    };
  }

  const sortedOpts = styleGroups[bestSecStyleId].sort((a, b) => {
    const scoreA = viabilityScore(a.winrate || 50.0, a.pickrate || 0);
    const scoreB = viabilityScore(b.winrate || 50.0, b.pickrate || 0);
    return scoreB - scoreA;
  });

  return {
    styleId: bestSecStyleId,
    runes: sortedOpts.slice(0, 2)
  };
}

/**
 * Selecciona los shards coherentes con el cluster.
 * @param shardsData - Datos de shards por slot.
 * @param clusterDamageType - Daño del cluster.
 * @param champData - Datos enriquecidos del campeón.
 * @returns Tres IDs de shards.
 */
export function selectShardsForCluster(
  shardsData: { stat1: RuneOption[]; stat2: RuneOption[]; stat3: RuneOption[] },
  clusterDamageType: 'AD' | 'AP' | 'Hybrid',
  champData?: EnrichedChampion
): number[] {
  const AP_INCOMPATIBLE_SHARDS = [5005];
  const incompatible = [...(clusterDamageType === 'AP' ? AP_INCOMPATIBLE_SHARDS : [])];

  if (champData) {
    const tacticRole = champData.tacticRole || champData.tactic_role || '';
    const SHARD_BLACKLIST_BY_ROLE: Record<string, number[]> = {
      burst:    [5005],  // attack speed inútil en asesinos one-shot
      dive:     [5005],
      poke:     [5005],
      skirmish: [],
      teamfight:[],
    };
    const roleBlacklist = SHARD_BLACKLIST_BY_ROLE[tacticRole] || [];
    roleBlacklist.forEach(id => {
      if (!incompatible.includes(id)) {
        incompatible.push(id);
      }
    });
  }

  const selectShard = (options: RuneOption[]): number => {
    if (!options || options.length === 0) return 0;
    const filtered = options.filter(o => !incompatible.includes(Number(o.Id || o.id)));
    const viable = filtered.length > 0 ? filtered : options;

    const sorted = [...viable].sort((a, b) => {
      const wrA = a.winrate || 50.0;
      const prA = a.pickrate || 0;
      const wrB = b.winrate || 50.0;
      const prB = b.pickrate || 0;
      return viabilityScore(wrB, prB) - viabilityScore(wrA, prA);
    });

    return Number(sorted[0]?.Id || sorted[0]?.id || 0);
  };

  return [
    selectShard(shardsData.stat1),
    selectShard(shardsData.stat2),
    selectShard(shardsData.stat3),
  ];
}

/**
 * Selecciona runes para un cluster aplicando coherencia.
 * @param runesData - Datos crudos de runas.
 * @param cluster - Cluster de build.
 * @param champData - Datos enriquecidos del campeón.
 * @returns Estructura de runas adaptadas.
 */
export function selectRunesForCluster(
  runesData: RunesData,
  cluster: BuildCluster,
  champData?: EnrichedChampion
): any {
  const clusterDamageType = cluster.damageType || 'Hybrid';
  const runeToStyle = assetsMap.runeToStyle as Record<number, number>;

  // Deducir playstyle usando getClusterTitle
  const coreItemIds = cluster.representativeCore || [];
  const playstyle = getClusterTitle(coreItemIds, clusterDamageType);

  // 1. Filtrar y seleccionar keystone
  const keystones = runesData.primaryRuneId || [];
  const filteredKeystones = filterKeystonesByCluster(keystones, clusterDamageType);
  const primaryRuneId = selectBestRune(filteredKeystones, true, clusterDamageType, playstyle);
  const primaryStyleId = Number(runeToStyle[primaryRuneId]) || 8000;

  // 2. Filtrar y seleccionar árbol primario
  const rawPrimary2 = runesData.primaryRuneId2 || [];
  const rawPrimary3 = runesData.primaryRuneId3 || [];
  const rawPrimary4 = runesData.primaryRuneId4 || [];

  const filteredPrimary2 = filterPrimaryTreeByKeystone(rawPrimary2, primaryRuneId, runeToStyle);
  const filteredPrimary3 = filterPrimaryTreeByKeystone(rawPrimary3, primaryRuneId, runeToStyle);
  const filteredPrimary4 = filterPrimaryTreeByKeystone(rawPrimary4, primaryRuneId, runeToStyle);

  const primaryRuneId2 = selectBestRune(filteredPrimary2);
  const primaryRuneId3 = selectBestRune(filteredPrimary3);
  const primaryRuneId4 = selectBestRune(filteredPrimary4);

  // 3. Filtrar y seleccionar árbol secundario
  const secondaryRunesRaw = runesData.secondaryRuneId || [];
  const bestSec = getBestSecondaryRunesForCluster(
    secondaryRunesRaw,
    primaryStyleId,
    clusterDamageType,
    runeToStyle,
    champData,
    playstyle
  );

  // 4. Filtrar y seleccionar shards
  const shardsData = {
    stat1: runesData.perksStat1 || [],
    stat2: runesData.perksStat2 || [],
    stat3: runesData.perksStat3 || [],
  };
  const shards = selectShardsForCluster(shardsData, clusterDamageType, champData);

  return {
    primaryStyleId,
    subStyleId: bestSec.styleId,
    selections: [
      primaryRuneId,
      primaryRuneId2,
      primaryRuneId3,
      primaryRuneId4,
      Number(bestSec.runes[0]?.Id || bestSec.runes[0]?.id || 0),
      Number(bestSec.runes[1]?.Id || bestSec.runes[1]?.id || 0)
    ],
    shards
  };
}

/**
 * Selects the starter items for the cluster.
 * @param startItems - Starter items options.
 * @param cluster - Cluster object.
 * @returns Selected starter item IDs.
 */
export function selectStarterForCluster(
  startItems: any[],
  cluster: BuildCluster
): number[] {
  if (!Array.isArray(startItems) || startItems.length === 0) {
    return [1055];
  }

  let bestStarter: number[] = [];
  let maxScore = -9999;

  startItems.forEach(s => {
    const ids = s.startItems || [];
    const wr = s.winrate || 50.0;
    const pr = s.pickrate || 0;
    const score = viabilityScore(wr, pr);

    if (score > maxScore) {
      maxScore = score;
      bestStarter = ids;
    }
  });

  return bestStarter;
}

/**
 * Selects summoners.
 * @param summoners - Summoner options.
 * @param role - Role string.
 * @returns Summoner IDs.
 */
export function selectSummonersForCluster(
  summoners: any[],
  role: string
): number[] {
  if (!Array.isArray(summoners) || summoners.length === 0) {
    return [4, 12];
  }

  const filtered = summoners.filter(s => (s.pickrate || 0) >= 5.0);
  const candidates = filtered.length > 0 ? filtered : summoners;

  let bestSumms: number[] = [];
  let maxScore = -9999;

  candidates.forEach(s => {
    const wr = s.winrate || 50.0;
    const pr = s.pickrate || 0;
    const score = viabilityScore(wr, pr);

    if (score > maxScore) {
      maxScore = score;
      bestSumms = [s.summonerId1, s.summonerId2];
    }
  });

  if (bestSumms.length < 2) {
    bestSumms = [4, 12];
  }

  return bestSumms;
}

function getPivotItemName(pivotId: number): string | null {
  const item = ITEMS_DB[pivotId];
  if (!item || !item.name) return null;
  const name = item.name as string;
  if (name.length <= 14) return name;
  if (name.includes("'")) return name.split("'")[0] + "'s";
  return name.split(" ")[0];
}



function getClusterTitle(coreItems: number[], damageType: string): string {
  if (damageType === 'AP') {
    const hasBurn = coreItems.some(id => [6653, 2503].includes(id));
    if (hasBurn) return 'AP Burn';
    const hasBurst = coreItems.some(id => [3089, 3100, 3139, 3152, 6657].includes(id));
    if (hasBurst) return 'AP Burst';
    return 'AP Magic';
  } else if (damageType === 'AD') {
    const lethalityItems = [6697, 6699, 6696, 3179, 3142, 6695, 6698];
    const critItems = [3031, 6676, 3036, 3508, 3094, 3085];
    const bruiserItems = [3071, 3078, 3053, 6333, 3153, 6610, 6631, 3074];
    
    let lethalityCount = 0;
    let critCount = 0;
    let bruiserCount = 0;
    
    coreItems.forEach(id => {
      const numId = Number(id);
      if (lethalityItems.includes(numId)) lethalityCount++;
      if (critItems.includes(numId)) critCount++;
      if (bruiserItems.includes(numId)) bruiserCount++;
    });
    
    if (lethalityCount > critCount && lethalityCount > bruiserCount) return 'AD Lethality';
    if (critCount > lethalityCount && critCount > bruiserCount) return 'AD Critical';
    if (bruiserCount > lethalityCount && bruiserCount > critCount) return 'AD Bruiser';
    return 'AD Physical';
  }
  return 'Hybrid';
}

function buildOutputForCluster(
  c: any,
  champ: any,
  dpmData: any,
  rawBoots: any,
  rawRunes: any,
  rawStarters: any,
  rawSummoners: any,
  myRole: string,
  enemyNames: string[],
  enemyContext: any,
  isAssassin: boolean,
  defaultBuild: any
): any {
  const coreItemIds = c.representativeCore || [];
  const chosenBootId = selectBootsForCluster(rawBoots, c, enemyNames, champ.tacticRole || champ.tactic_role, champ.class, champ);
  const chosenRunes = selectRunesForCluster(rawRunes, c, champ);

  const chosenStarterIds = selectStarterForCluster(rawStarters, c);
  const chosenSummoners = selectSummonersForCluster(rawSummoners, myRole);

  const dynamicPaths = getDynamicPaths(
    dpmData.items || {},
    coreItemIds,
    c.damageType,
    chosenBootId,
    enemyContext,
    isAssassin
  );

  const starter = chosenStarterIds.map((id: number) => hydrateAsset('items', id));
  const boots = hydrateAsset('items', chosenBootId);

  // Swaps de core items dinámicos
  const swapsRaw = getCoreItemSwaps(coreItemIds, enemyContext, champ);
  const coreItemSwaps = swapsRaw.map(s => ({
    replaceItem: hydrateAsset('items', s.replaceItem),
    withItem: hydrateAsset('items', s.withItem),
    reason: s.reason,
    priority: s.priority
  }));

  // Completar core items a 5 finalizados
  const fullCoreIds = [...coreItemIds];
  for (const id of dynamicPaths.neutral) {
    if (fullCoreIds.length >= 5) break;
    if (!fullCoreIds.includes(id)) {
      fullCoreIds.push(id);
    }
  }
  const core = fullCoreIds.map((id: number) => hydrateAsset('items', id));

  const paths = {
    snowball: dynamicPaths.snowball.map((id: number) => hydrateAsset('items', id)),
    neutral: dynamicPaths.neutral.map((id: number) => hydrateAsset('items', id)),
    behind: dynamicPaths.behind.map((id: number) => hydrateAsset('items', id))
  };

  const skillOrder = defaultBuild?.skills || champ.buildData?.skills;
  const fullOrder = skillOrder
    ? [
        { key: "Q", pos: skillOrder.skillLevelUp1 || 1 },
        { key: "W", pos: skillOrder.skillLevelUp2 || 2 },
        { key: "E", pos: skillOrder.skillLevelUp3 || 3 }
      ]
      .sort((a, b) => a.pos - b.pos)
      .map(s => s.key)
      .join(" > ")
    : "Q > W > E";

  return {
    build: {
      summoners: chosenSummoners.map((id: number) => hydrateAsset('summoners', id)),
      runes: {
        primaryStyle: chosenRunes.primaryStyleId,
        secondaryStyle: chosenRunes.subStyleId,
        keystone: hydrateAsset('runes', chosenRunes.selections[0]),
        shards: chosenRunes.shards.map((id: number) => hydrateAsset('shards', id)),
        selections: chosenRunes.selections.map((id: number) => hydrateAsset('runes', id))
      },
      items: {
        starter,
        boots,
        core,
        paths
      },
      skillOrder: fullOrder
    },
    coreItemSwaps,
    chosenBootId,
    fullCoreIds
  };
}

/**
 * Orquestra el motor de builds adaptativas basadas en clusters y draft.
 * @param championId - ID de campeón.
 * @param myTeamIds - IDs de aliados.
 * @param theirTeamIds - IDs de enemigos.
 * @param myRole - Rol.
 * @returns Build adaptada final.
 */
export function getAdaptedBuild(
  championId: number,
  myTeamIds: number[] = [],
  theirTeamIds: number[] = [],
  myRole: string = 'jungle'
): any {
  const name = getNameFromId(championId);
  if (!name) return null;
  const champ = ENRICHED_DB[name];
  if (!champ) return null;

  const tacticRole = champ.tacticRole || champ.tactic_role || 'teamfight';
  const champClass = champ.class || '';
  const isAssassin = tacticRole === 'burst' || tacticRole === 'assassin' || champClass === 'Assassin';

  const roleUpper = myRole?.toUpperCase() || '';
  const defaultBuild = champ.builds?.find((b: any) => b.is_default && b.lane?.toUpperCase() === roleUpper && b.special_notes?.dpmData)
    || champ.builds?.find((b: any) => b.is_default && b.special_notes?.dpmData)
    || champ.builds?.find((b: any) => b.is_default && b.lane?.toUpperCase() === roleUpper)
    || champ.builds?.find((b: any) => b.is_default)
    || champ.buildData;
  // La ruta varía según la fuente de datos:
  // - SQLite → special_notes.dpmData (guardado por sync.service)
  // - JSON (counter-synergies.json) → buildData.dpmData (ruta directa del scraper)
  const dpmData = defaultBuild?.special_notes?.dpmData
    || champ.buildData?.special_notes?.dpmData
    || champ.buildData?.dpmData  // ← ruta directa del JSON
    || champ.dpmData;

  console.log(`\n🔍 [ENGINE] getAdaptedBuild → ${name} (ID: ${championId})`);
  console.log(`   tacticRole: ${tacticRole} | class: ${champClass} | isAssassin: ${isAssassin}`);
  console.log(`   hasDpmData: ${!!(dpmData && dpmData.coreBuilds)} | builds count: ${champ.builds?.length ?? 0}`);
  console.log(`   allies: [${myTeamIds.join(', ')}] | enemies: [${theirTeamIds.join(', ')}]`);

  // Fallback si no hay dpmData para campeones sin scrapeo completo
  if (!dpmData || !dpmData.coreBuilds) {
    console.log(`   ⚠️  Sin dpmData → usando getFallbackStaticBuild`);
    return getFallbackStaticBuild(champ, myRole);
  }

  const clusters = detectBuildClusters(dpmData);
  if (clusters.length === 0) {
    return getFallbackStaticBuild(champ, myRole);
  }

  const allyNames = myTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];
  const enemyNames = theirTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];

  const scoredClusters = clusters.map(cluster => {
    const score = scoreClusterInContext(cluster, allyNames, enemyNames, champ);
    return { ...cluster, score };
  });

  scoredClusters.sort((a, b) => b.score - a.score);

  // Log detallado de puntajes de clusters
  console.log(`\n╔══ [CLUSTER SCORING] ${champ.name} ════════════════════════`);
  scoredClusters.forEach((c, i) => {
    const d = (c as any).__scoreDebug || {};
    const winner = i === 0 ? '🏆 GANADOR' : '  ';
    console.log(`║ ${winner} Cluster ${c.damageType} (pivot: ${c.pivotItem})`);
    console.log(`║    WR: ${c.weightedWinrate.toFixed(2)}% → wrContrib: ${(d.wrContrib ?? 0).toFixed(3)}`);
    console.log(`║    PR: ${c.totalPickrate.toFixed(2)}% → prContrib: ${(d.prContrib ?? 0).toFixed(3)}`);
    console.log(`║    baseScore: ${(d.baseScore ?? 0).toFixed(3)}`);
    if (d.bonuses && d.bonuses.length > 0) {
      d.bonuses.forEach((b: any) => {
        const sign = b.value >= 0 ? '+' : '';
        console.log(`║    [bonus] ${b.label}: ${sign}${b.value.toFixed(3)}`);
      });
    } else {
      console.log(`║    [bonus] ninguno`);
    }
    console.log(`║    ► FINAL: ${(d.finalScore ?? c.score).toFixed(3)}`);
  });
  console.log(`╚════════════════════════════════════════════════════════`);

  const winningCluster = scoredClusters[0];
  const losingLogs = scoredClusters.slice(1).map(c => `cluster_${c.damageType} (score: ${c.score.toFixed(2)})`).join(", ");
  console.log(`✅ [CLUSTER] ${champ.name} → cluster_${winningCluster.damageType} (score: ${winningCluster.score.toFixed(2)})${losingLogs ? ` sobre ${losingLogs}` : ""}`);

  const rawBoots = dpmData.boots || [];
  const rawRunes = dpmData.runes || {};
  const rawStarters = dpmData.startItems || [];
  const rawSummoners = dpmData.summoners || [];
  const supportEvolution = selectSupportItemEvolution(name, myRole);
  let hydratedSupportEvolution = null;
  if (supportEvolution) {
    hydratedSupportEvolution = {
      item: hydrateAsset('items', supportEvolution.itemId),
      reason: supportEvolution.reason
    };
  }

  // Analizar comp enemiga
  const enemyComp = analyzeComposition(enemyNames);
  const realTanks = enemyNames.filter(name => {
    const e = ENRICHED_DB[name];
    if (!e) return false;
    const isFrontline = e.isFrontline === true || e.isFrontline === 1;
    const isTank = e.class === 'Tank';
    const physicalDmg = e.combat?.damageComposition?.physical !== undefined 
      ? e.combat.damageComposition.physical 
      : 100;
    return isFrontline && isTank && physicalDmg < 40;
  }).length;

  const enemyContext = {
    enemyADCount: enemyComp.adCount,
    enemyAPCount: enemyComp.apCount,
    enemyTankCount: enemyComp.tankCount,
    enemyCCCount: enemyComp.ccCount,
    enemyHealerCount: enemyComp.healerCount,
    realTanks
  };

  // Filtrado de clusters similares (máximo 4)
  const getCommonCount = (arr1: number[], arr2: number[]) => {
    const set2 = new Set(arr2);
    return arr1.filter(x => set2.has(x)).length;
  };

  const runFiltering = (threshold: number) => {
  const result: any[] = [];
  for (const c of scoredClusters) {
    if (result.length >= 4) break;

    const cBootId = selectBootsForCluster(
      rawBoots, c, enemyNames,
      champ.tacticRole || champ.tactic_role,
      champ.class, champ
    );
    const cDynamicPaths = getDynamicPaths(
      dpmData.items || {},
      c.representativeCore,
      c.damageType,
      cBootId,
      enemyContext,
      isAssassin
    );
    const cFullCoreIds = [...c.representativeCore];
    for (const id of cDynamicPaths.neutral) {
      if (cFullCoreIds.length >= 5) break;
      if (!cFullCoreIds.includes(id)) {
        cFullCoreIds.push(id);
      }
    }

    // FIX 1: comparar representativeCore original, NO fullCoreIds
    let isSimilar = false;
    for (const accepted of result) {
      const commonCount = getCommonCount(
        c.representativeCore,
        accepted.representativeCore  // ← era accepted.fullCoreIds
      );
      if (commonCount >= threshold) {
        isSimilar = true;
        break;
      }
    }

    if (!isSimilar) {
      const clusterBuildOutput = buildOutputForCluster(
        c, champ, dpmData, rawBoots, rawRunes,
        rawStarters, rawSummoners, myRole,
        enemyNames, enemyContext, isAssassin, defaultBuild
      );
      const title = getClusterTitle(c.representativeCore, c.damageType);

      result.push({
        pivotItem: c.pivotItem,
        representativeCore: c.representativeCore,  // ← nuevo, necesario para Fix 1
        damageType: c.damageType,
        totalPickrate: c.totalPickrate,
        weightedWinrate: c.weightedWinrate,
        score: +(c.score.toFixed(2)),
        isWinner: false,
        fullCoreIds: cFullCoreIds,
        title,
        build: clusterBuildOutput.build,
        coreItemSwaps: clusterBuildOutput.coreItemSwaps,
        chosenBootId: clusterBuildOutput.chosenBootId
      });
    }
  }
  return result;
};

// FIX 2: thresholds ajustados para representativeCore de 2-3 items
let filteredClusters = runFiltering(2);

if (filteredClusters.length <= 1 && scoredClusters.length > 1) {
  filteredClusters = runFiltering(1);
}

// Último recurso: incluir todos sin filtrar (máx 4)
if (filteredClusters.length <= 1 && scoredClusters.length > 1) {
  filteredClusters = scoredClusters.slice(0, 4).map(c => {
    const clusterBuildOutput = buildOutputForCluster(
      c, champ, dpmData, rawBoots, rawRunes,
      rawStarters, rawSummoners, myRole,
      enemyNames, enemyContext, isAssassin, defaultBuild
    );
    const title = getClusterTitle(c.representativeCore, c.damageType);
    return {
      pivotItem: c.pivotItem,
      representativeCore: c.representativeCore,
      damageType: c.damageType,
      totalPickrate: c.totalPickrate,
      weightedWinrate: c.weightedWinrate,
      score: +(c.score.toFixed(2)),
      isWinner: false,
      fullCoreIds: clusterBuildOutput.fullCoreIds,
      title,
      build: clusterBuildOutput.build,
      coreItemSwaps: clusterBuildOutput.coreItemSwaps,
      chosenBootId: clusterBuildOutput.chosenBootId
    };
  });
}

// FIX 3: detectar títulos duplicados y diferenciarlos con nombre del pivot
const titleCounts: Record<string, number> = {};
filteredClusters.forEach(c => {
  titleCounts[c.title] = (titleCounts[c.title] || 0) + 1;
});

const titleIndices: Record<string, number> = {};
filteredClusters = filteredClusters.map(c => {
  if (titleCounts[c.title] > 1) {
    titleIndices[c.title] = (titleIndices[c.title] || 0) + 1;
    const pivotName = getPivotItemName(c.pivotItem);
    return {
      ...c,
      title: pivotName
        ? `${c.title} (${pivotName})`
        : `${c.title} ${titleIndices[c.title]}`
    };
  }
  return c;
});

if (filteredClusters.length > 0) {
  filteredClusters[0].isWinner = true;
}

// Log de verificación
console.log(`📑 [CLUSTERS FINALES] ${name}: ${filteredClusters.length} pestañas`);
filteredClusters.forEach((c, i) => {
  console.log(`   ${i + 1}. "${c.title}" | pivot: ${c.pivotItem} | score: ${c.score}`);
});

  const winningClusterData = filteredClusters[0];
  const chosenBootId = winningClusterData.chosenBootId;
  const coreItemSwaps = winningClusterData.coreItemSwaps;
  const build = winningClusterData.build;

  const defaultBootId = typeof defaultBuild?.items?.boots === 'object'
    ? (defaultBuild.items.boots.id || defaultBuild.items.boots.itemId)
    : (Number(defaultBuild?.items?.boots) || 3047);

  // Validación de coherencia y reporte de errores en consola
  if (winningClusterData.damageType === 'AD') {
    const NEVER_IN_AD_RUNES = [8229, 8214, 8230];
    const NEVER_IN_AD_ITEMS = [6653, 3152, 4645, 3135, 3165, 3071];
    const NEVER_IN_ASSASSIN_SHARDS = [5005];

    const selectedKeystone = Number(winningClusterData.build.runes.selections[0]?.id || 0);
    const finalCoreIds = winningClusterData.fullCoreIds.map(id => Number(id));
    const firstShard = Number(winningClusterData.build.runes.shards[0]?.id || 0);

    if (NEVER_IN_AD_RUNES.includes(selectedKeystone)) {
      console.error(`❌ [COHERENCE] Keystone AP en cluster AD: ${selectedKeystone}`);
    }
    NEVER_IN_AD_ITEMS.forEach(id => {
      if (finalCoreIds.includes(id)) {
        console.error(`❌ [COHERENCE] Item incoherente en cluster AD: ${id}`);
      }
    });

    const isAssassin = champ.tacticRole === 'burst' || champ.tacticRole === 'dive' || champ.class === 'Assassin';
    if (isAssassin && NEVER_IN_ASSASSIN_SHARDS.includes(firstShard)) {
      console.error(`❌ [COHERENCE] Shard incoherente para asesino: ${firstShard}`);
    }
  }

  return {
    name: name,
    isAdapted: chosenBootId !== defaultBootId || winningClusterData.pivotItem !== (defaultBuild?.items?.core?.[0] || 0) || coreItemSwaps.length > 0,
    bootsSelection: {
      bootId: chosenBootId,
      reason: chosenBootId === 3111 ? "CC crítico enemigo — Mercury adaptado" : (chosenBootId === 3047 ? "Composición AD pesada — Tabi adaptado" : "Botas coherentes con tu cluster")
    },
    supportEvolution: hydratedSupportEvolution,
    coreItemSwaps,
    // Clusters limpios con sus builds para que la UI pueda renderizarlos y alternar entre ellos
    scoredClusters: filteredClusters.map(c => ({
      pivotItem: c.pivotItem,
      damageType: c.damageType,
      totalPickrate: c.totalPickrate,
      weightedWinrate: c.weightedWinrate,
      score: c.score,
      isWinner: c.isWinner,
      title: c.title,
      build: c.build,
      coreItemSwaps: c.coreItemSwaps
    })),
    build
  };
}
