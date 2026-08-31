// src/lib/engine/itemEngine.ts
import { ENRICHED_DB, ITEMS_DB } from './core/dataProvider.js';
import { NAME_TO_ID } from './core/constants.js';
import { hydrateAsset } from './core/hydrator.js';
import { analyzeComposition } from './picks/compositionAnalyzer.js';
import { calculateSkillMaxOrder } from './tacticalEngine.js';
import { evidenceScore, isReliableVariant } from './statisticalScoring.js';
import { scoreBuildVariant, scoreEvidence100, scoreItemOption, scoreRunePage } from './recommendationScoring.js';
import { chooseSecondaryPair, isValidRunePage } from './rune-validation.js';
import type { EnrichedChampion } from './core/types.js';
import assetsMap from '../data/assets-map.json' with { type: 'json' };

export interface RuneOption {
  Id?: number;
  id?: number;
  winrate: number;
  pickrate: number;
  games?: number;
}

export interface RunesData {
  pages?: RunePage[];
  primaryRuneId?: RuneOption[];
  primaryRuneId2?: RuneOption[];
  primaryRuneId3?: RuneOption[];
  primaryRuneId4?: RuneOption[];
  secondaryRuneId?: RuneOption[];
  perksStat1?: RuneOption[];
  perksStat2?: RuneOption[];
  perksStat3?: RuneOption[];
}

export interface RunePage {
  primaryStyleId: number;
  subStyleId: number;
  selections: number[];
  shards: number[];
  winrate?: number;
  pickrate?: number;
  games?: number;
}

export interface BuildCluster {
  pivotItem: number;
  representativeCore: number[];
  totalPickrate: number;
  weightedWinrate: number;
  games?: number;
  damageType: 'AD' | 'AP' | 'Hybrid';
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
 * Valida si un ítem en particular es coherente con el tipo de daño del cluster activo (AD o AP).
 * Evita configuraciones incoherentes (ej. ítems AP en builds puramente AD).
 * 
 * @param itemId - ID del ítem a comprobar.
 * @param clusterDamageType - Tipo de daño del cluster activo ('AD' | 'AP' | 'Hybrid').
 * @returns true si el ítem es coherente con el daño del cluster, o false si está en blacklist o tiene tags incompatibles.
 * 
 * @modifica Para ajustar qué ítems se bloquean de forma estática en cada cluster, modificar `CLUSTER_ITEM_BLACKLIST` en {@link file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L97-L131}.
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

/**
 * Clasifica un ítem específico según sus categorías estadísticas en una rama ofensiva, balanceada o defensiva.
 * 
 * @param itemId - ID del ítem a clasificar.
 * @returns Categoría del ítem: 'offensive', 'balanced' o 'defensive'.
 * 
 * @modifica La clasificación depende de las categorías que expone `ITEMS_DB` para cada ítem, así como de un mapeo estático de fallbacks y excepciones dentro de la misma función.
 */
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
    selections = selections.map((runeId: number, idx: number) => {
      if (idx >= 4 && PRECISION_BLACKLIST_ASSASSIN.includes(runeId)) {
        const otherIdx = idx === 4 ? 5 : 4;
        const otherRune = selections[otherIdx];
        return otherRune === 8014 ? 9111 : 8014;
      }
      return runeId;
    });
  }

  // Shards: evitar Attack Speed (5005) en asesinos y AP
  shards = shards.map((shardId: number) => {
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
    isAdapted: finalBootId !== bootId || cleanCoreIds.some((id: number, idx: number) => {
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
      skillOrder: calculateSkillMaxOrder(champ.buildData?.skills)
    }
  };
}


/**
 * Genera ramas de compra estáticas para tres condiciones de partida (snowball, neutral, behind) para campeones sin datos LoLalytics completos.
 * 
 * @param slotItems - Opciones de ítems del campeón.
 * @param coreItemIds - IDs de los ítems del core.
 * @param damageType - Tipo de daño del cluster.
 * @param adaptedBootId - ID de las botas adaptadas seleccionadas.
 * @param isAssassin - true si el campeón es asesino para aplicar fallbacks correctos.
 * @returns Objeto con las tres ramas conteniendo IDs de ítems.
 * 
 * @modifica En caso de no tener ítems suficientes en el pool, se usan los arreglos de fallback estáticos (`AD_ASSASSIN_FALLBACKS`, `AD_FIGHTER_FALLBACKS`, `AP_FALLBACKS`).
 */
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

/**
 * Genera de forma dinámica las rutas de continuación de la build (item 4 y item 5) adaptadas a la composición y contexto del equipo enemigo.
 * Califica ítems del pool según sus efectos defensivos, heridas graves o penetración necesarios en la partida.
 * 
 * @param slotItems - Todos los ítems mapeados en ranuras históricas para este campeón.
 * @param coreItemIds - Los ítems que conforman el núcleo de la build (core).
 * @param damageType - Tipo de daño del cluster activo.
 * @param adaptedBootId - ID de las botas ya adaptadas.
 * @param enemyContext - Métricas de contexto de la composición enemiga (conteos de AD, AP, tanques, CC, curadores).
 * @param isAssassin - Si el campeón se clasifica como asesino para fallbacks tácticos.
 * @returns Objeto con las tres ramas de compra (`snowball`, `neutral`, `behind`) con dos ítems recomendados por rama.
 * 
 * @modifica Para ajustar el umbral de filtrado inicial de pickrate de ítems, editar `minPr` en esta función.
 */
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

  // Item 4/5/6 son alternativas contextuales; no se concatenan como core fijo.
  const slotsToCheck = ['item4', 'item5', 'item6', 'item3'];
  
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
    let score = scoreItemOption(cand).score;

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
    minChampPickrate: 8.0,
    maxCoreDisruption: 1,
  },
  tankPen: {
    minTankCount: 2,
    minChampPickrate: 10.0,
  },
  defensiveItem: {
    minThreatCount: 2,
    minChampPickrate: 10.0,
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

/**
 * Determina si un ítem calificado como contramedida táctica es viable e históricamente usado por el campeón.
 * Estricto y cerrado: solo aprueba si el ítem tiene presencia real documentada (PR >= minPickrateThreshold).
 * Sin fallback permisivo por tipo de daño.
 */
export function isItemViableForChamp(
  itemId: number,
  champName: string,
  minPickrateThreshold: number = 10.0
): boolean {
  const champData = ENRICHED_DB[champName];
  if (!champData) return false;

  const baseId = itemId > 220000 ? itemId % 220000 : itemId;

  // Recolectar todos los ítems de las ranuras históricas del campeón
  const allSlotItems = Object.values(champData.buildData?.slotItems || {}).flat();
  const statsItems = Object.values(champData.buildData?.statsData?.items || {}).flat();
  const combinedItems = [...allSlotItems, ...statsItems];

  const inPool = combinedItems.find((i: any) => {
    const iId = Number(i.Id || i.id || i.itemId);
    const cleanId = iId > 220000 ? iId % 220000 : iId;
    return cleanId === baseId;
  }) as any;

  if (inPool) {
    const pickrate = parseFloat(inPool.pickrate || inPool.pickRate || 0);
    if (pickrate >= minPickrateThreshold) {
      return true;
    }
  }

  // ELIMINADO EL FALLBACK PERMISIVO: Si no supera el umbral en el pool real, retorna false.
  return false;
}

export interface CoreItemSwap {
  replaceItem: number;
  withItem: number;
  reason: string;
  priority: 'critical' | 'recommended' | 'optional';
}

/**
 * Propone reemplazos en los core items recomendados adaptándolos al draft enemigo.
 * Filtra rigurosamente con umbrales de viabilidad (PR >= 10%, o >= 8% para anti-curación).
 * No emite swaps forzados si ninguna alternativa viable califica.
 */
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
  champProfile: any,
  enemies: string[] = []
): CoreItemSwap[] {
  const swaps: CoreItemSwap[] = [];
  const champName = champProfile.name;
  const isAP = champProfile.damageType === 'AP';
  const cleanCore = [...coreItems];
  if (cleanCore.length === 0) return [];

  // Detectar amenazas de asesinos/burst enemigos
  const enemyAssassinCount = enemies.filter(enemyName => {
    const e = ENRICHED_DB[enemyName];
    if (!e) return false;
    const role = e.tacticRole || e.tactic_role || '';
    return role === 'burst' || role === 'assassin' || role === 'dive' || e.class === 'Assassin';
  }).length;

  // 1. SWAP CONTRA ASESINOS / BURST AD (Supervivencia defensiva) - Umbral PR >= 10.0%
  if (enemyAssassinCount >= 2) {
    const defensiveCandidates = isAP
      ? [3157, 3102] // Zhonya's, Banshee's
      : [6333, 3156, 3026, 3143, 2504]; // Death's Dance, Maw, GA, Randuin, Kaenic

    const viableDef = defensiveCandidates.find(id => 
      !cleanCore.includes(id) && 
      isItemViableForChamp(id, champName, 10.0) && 
      isItemCoherentWithCluster(id, champProfile.damageType)
    );

    if (viableDef) {
      const replaceIdx = cleanCore.length >= 3 ? 2 : cleanCore.length - 1;
      const replaceItem = cleanCore[replaceIdx];
      swaps.push({
        replaceItem,
        withItem: viableDef,
        reason: `${enemyAssassinCount} asesinos/burst en el equipo rival. Supervivencia defensiva prioritaria.`,
        priority: 'critical'
      });
      return swaps;
    }
  }

  // 2. SWAP CONTRA CURACIÓN (Heridas Graves) - Umbral PR >= 8.0%
  const hasAntiHeal = cleanCore.some(id => ITEM_CATEGORIES.GRIEVOUS_WOUNDS.includes(id));
  if (!hasAntiHeal && enemyContext.enemyHealerCount >= ADAPTATION_THRESHOLDS.antiHeal.minHealerCount) {
    const antiHealCandidates = isAP
      ? [3165] // Morellonomicon
      : (champProfile.class === 'Tank' ? [3075] : [3033, 3181, 3075]); // Mortal Reminder, Chempunk, Thornmail

    const viableAntiHeal = antiHealCandidates.find(id =>
      !cleanCore.includes(id) &&
      isItemViableForChamp(id, champName, ADAPTATION_THRESHOLDS.antiHeal.minChampPickrate) &&
      isItemCoherentWithCluster(id, champProfile.damageType)
    );

    if (viableAntiHeal) {
      const replaceIdx = cleanCore.length >= 3 ? 2 : cleanCore.length - 1;
      const replaceItem = cleanCore[replaceIdx];
      swaps.push({
        replaceItem,
        withItem: viableAntiHeal,
        reason: `${enemyContext.enemyHealerCount} fuentes de curación en el rival. Heridas Graves requeridas.`,
        priority: 'critical'
      });
      return swaps;
    }
  }

  // 3. SWAP CONTRA TANQUES (Penetración Porcentual) - Umbral PR >= 10.0%
  const realTanksCount = enemyContext.realTanks !== undefined ? enemyContext.realTanks : enemyContext.enemyTankCount;
  const hasPen = cleanCore.some(id => 
    ITEM_CATEGORIES.ARMOR_PEN.includes(id) || ITEM_CATEGORIES.MAGIC_PEN.includes(id)
  );

  if (!hasPen && realTanksCount >= ADAPTATION_THRESHOLDS.tankPen.minTankCount) {
    const penCandidates = isAP
      ? [3135, 3137] // Void Staff, Cryptbloom
      : [3036, 3071, 3033, 6694]; // LDR, Black Cleaver, Mortal Reminder, Serylda

    const viablePen = penCandidates.find(id =>
      !cleanCore.includes(id) &&
      isItemViableForChamp(id, champName, ADAPTATION_THRESHOLDS.tankPen.minChampPickrate) &&
      isItemCoherentWithCluster(id, champProfile.damageType)
    );

    if (viablePen) {
      const replaceIdx = cleanCore.length >= 3 ? 2 : cleanCore.length - 1;
      const replaceItem = cleanCore[replaceIdx];
      swaps.push({
        replaceItem,
        withItem: viablePen,
        reason: `${realTanksCount} tanques enemigos con resistencias. Penetración porcentual requerida.`,
        priority: 'recommended'
      });
      return swaps;
    }
  }

  return swaps;
}

export const SUPPORT_EVOLUTIONS = {
  DREAM_MAKER: { id: 3870, name: "Creador de Sueños", archetype: "Enchanter" },
  ZAZZAK: { id: 3871, name: "Púa de Reino de Zaz'Zak", archetype: "Mage" },
  CELESTIAL: { id: 3869, name: "Oposición Celestial", archetype: "Tank" },
  SOLSTICE: { id: 3876, name: "Trineo del Solsticio", archetype: "Engage" },
  BLOODSONG: { id: 3877, name: "Canción de Sangre", archetype: "AD" }
};

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
  const tacticRole = champ.tacticRole || champ.tactic_role || '';
  const damageType = champ.damageType || 'AD';
  const champClass = champ.class || '';

  // 1. AD / Asesinos / Skirmish / Tiradores en soporte (Senna, Pyke, Pantheon, Ashe, etc.)
  if (damageType === 'AD' || champ.tags?.includes('Assassin') || champClass === 'Assassin' || champClass === 'Marksman' || tacticRole === 'skirmish') {
    return {
      itemId: SUPPORT_EVOLUTIONS.BLOODSONG.id,
      reason: "Soporte AD / Hostigamiento — Canción de Sangre aplica Exponer Debilidad y amplifica el daño"
    };
  }

  // 2. Magos / Poke / Daño Mágico (Brand, Zyra, Vel'Koz, Lux, Xerath, Swain, etc.)
  if (damageType === 'AP' && (tacticRole === 'poke' || champClass === 'Mage' || (tacticRole === 'burst' && !champ.isFrontline))) {
    return {
      itemId: SUPPORT_EVOLUTIONS.ZAZZAK.id,
      reason: "Soporte mágico / Poke — Púa de Zaz'Zak maximiza el hostigamiento y daño porcentual"
    };
  }

  // 3. Iniciación / Tanque de Engage con CC (Nautilus, Leona, Rell, Alistar, Blitzcrank, Thresh, Rakan)
  if (tacticRole === 'engage' || champ.teamProvides?.includes('engage') || (champ.isFrontline && champ.hasHardCC) || champClass === 'Vanguard') {
    return {
      itemId: SUPPORT_EVOLUTIONS.SOLSTICE.id,
      reason: "Soporte de iniciación — Trineo del Solsticio aporta aceleración y vida extra al aplicar CC"
    };
  }

  // 4. Tanques / Frontline defensiva pura (Braum, Taric, Tahm Kench, Shen, Poppy)
  if (champClass === 'Tank' || champ.isFrontline) {
    return {
      itemId: SUPPORT_EVOLUTIONS.CELESTIAL.id,
      reason: "Tanque / Frontline — Oposición Celestial aporta reducción masiva de daño inicial"
    };
  }

  // 5. Encantadoras / Curación / Escudos / Utilidad pura (Zilean, Lulu, Janna, Milio, Soraka, Sona, Nami, Yuumi, Karma, Seraphine)
  if (tacticRole === 'peel' || champ.teamProvides?.includes('healing') || champ.teamProvides?.includes('shielding') || champClass === 'Enchanter' || tacticRole === 'utility') {
    return {
      itemId: SUPPORT_EVOLUTIONS.DREAM_MAKER.id,
      reason: "Encantadora / Utilidad — Creador de Sueños potencia escudos y mitigación de daño aliada"
    };
  }

  return {
    itemId: SUPPORT_EVOLUTIONS.DREAM_MAKER.id,
    reason: "Evolución de soporte para utilidad"
  };
}

/**
 * Ponderación de consenso meta donde el Pickrate es el factor dominante sobre el Winrate.
 */
export function consensusScore(pickrate: number, winrate: number): number {
  const pr = Math.max(0, pickrate || 0);
  const wr = winrate || 50.0;
  return scoreEvidence100({ pickrate: pr, winrate: wr }).score;
}

// Alias para compatibilidad
export const viabilityScore = consensusScore;

/**
 * Clasifica un grupo de ítems (como el representativeCore) para determinar si la build es de daño físico (AD), mágico (AP) o híbrido (Hybrid).
 * 
 * @param itemIds - Lista de IDs de ítems en el core.
 * @returns Tipo de daño determinado ('AD' | 'AP' | 'Hybrid').
 * 
 * @modifica Para forzar que ciertos ítems se consideren AP o AD de forma directa, editar las listas estáticas `apItems` y `adItems` definidas en esta función.
 */
export function classifyItemsDamageType(itemIds: number[]): 'AD' | 'AP' | 'Hybrid' {
  const apItems = [
    3089, 3152, 3115, 3102, 3157, 3165, 6653, 3001, 3003, 3007, 3092, 3100, 3118, 3185, 4629, 3135, 3137, 4633, 2510, 4645, 3124,
    2065, 4005, 3107, 3222, 3504, 6617, 6620, 3174, 3870, 3871 // Ítems de soporte de utilidad y AP
  ];
  const adItems = [6697, 6699, 6696, 3179, 3814, 3142, 6695, 6698, 6693, 6692, 3071, 6333, 3053, 3156, 3161, 3078, 6610, 6631, 3074, 6609, 3026, 2501, 3031, 3046, 3094, 3085, 3091, 3153, 6672, 3033, 3035, 3036, 4642, 3877];

  let apScore = 0;
  let adScore = 0;

  for (const itemId of itemIds) {
    const baseId = itemId > 220000 ? itemId % 220000 : itemId;
    const item = ITEMS_DB[baseId];
    if (item) {
      const cats = item.categories || [];
      const isAp = cats.some(c => ['SpellDamage', 'MagicPenetration', 'AbilityPower', 'SpellVamp', 'ManaRegen'].includes(c)) || apItems.includes(baseId);
      const isAd = cats.some(c => ['Damage', 'AttackDamage', 'Lethality', 'ArmorPenetration', 'CriticalStrike', 'LifeSteal'].includes(c)) || adItems.includes(baseId);
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
  return 'AP';
}

/**
 * Analiza el LoLalytics del campeón y detecta clusters de builds basándose directamente en combinaciones completas de 3 ítems (`coreItem3`)
 * ordenadas por consenso meta (Pickrate dominante sobre Winrate).
 * 
 * @param statsData - Datos de LoLalytics del scraper/base de datos para el campeón.
 * @returns Lista de clusters ordenados por consenso.
 */
export function detectBuildClusters(statsData: any): BuildCluster[] {
  if (!statsData || !statsData.coreBuilds) return [];

  const coreItem3 = statsData.coreBuilds.coreItem3 || [];
  const coreItem2 = statsData.coreBuilds.coreItem2 || [];
  const clusters: BuildCluster[] = [];
  const seenSignatures = new Set<string>();

  // 1. Priorizar triplete de coreItem3 evaluado por consensusScore
  if (Array.isArray(coreItem3) && coreItem3.length > 0) {
    const candidatesCore3 = [...coreItem3]
      .filter((c: any) => Array.isArray(c.itemIds) && c.itemIds.length >= 3);
    const hasSampleCounts = candidatesCore3.some((c: any) => Number(c.games || c.count || 0) > 0);
    const reliableCore3 = hasSampleCounts
      ? candidatesCore3.filter((c: any) => isReliableVariant(c, 100))
      : candidatesCore3;
    const sortedCore3 = [...(reliableCore3.length > 0 ? reliableCore3 : [])]
      .sort((a: any, b: any) => {
        const scoreA = evidenceScore(a);
        const scoreB = evidenceScore(b);
        return scoreB - scoreA;
      });

    for (const c of sortedCore3) {
      const representativeCore = c.itemIds.slice(0, 3);
      const sig = [...representativeCore].sort().join('-');
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);

      const pivotItem = representativeCore[1] || representativeCore[0];
        const totalPickrate = c.pickrate || 0;
        const weightedWinrate = c.winrate || 50.0;
      const damageType = classifyItemsDamageType(representativeCore);

      clusters.push({
        pivotItem,
        representativeCore,
          totalPickrate,
          weightedWinrate,
          games: Number(c.games || c.count || 0) || undefined,
          damageType
      });
      if (clusters.length >= 6) break;
    }
  }

  // 2. Si no hay triplete disponible, completar desde coreItem2 con ítems estadísticamente viables (PR >= 10%)
  if (clusters.length === 0 && Array.isArray(coreItem2) && coreItem2.length > 0) {
    const candidatesCore2 = [...coreItem2]
      .filter((pair: any) => Array.isArray(pair.itemIds) && pair.itemIds.length >= 2);
    const hasSampleCounts = candidatesCore2.some((pair: any) => Number(pair.games || pair.count || 0) > 0);
    const reliableCore2 = hasSampleCounts
      ? candidatesCore2.filter((pair: any) => isReliableVariant(pair, 100))
      : candidatesCore2;
    const sortedCore2 = [...(reliableCore2.length > 0 ? reliableCore2 : [])]
      .sort((a: any, b: any) => {
        const scoreA = evidenceScore(a);
        const scoreB = evidenceScore(b);
        return scoreB - scoreA;
      });

    for (const pair of sortedCore2) {
      const pairIds = pair.itemIds.slice(0, 2);
      const pivotItem = pairIds[1] || pairIds[0];
      const damageType = classifyItemsDamageType(pairIds);

      // Buscar 3er ítem viable en slotItems / statsData.items
      let thirdItem = 0;
      const slotItemsArr = [
        ...(statsData.items?.item3 || []),
        ...(statsData.items?.item4 || []),
        ...(statsData.items?.item5 || [])
      ];

      const viable3rd = slotItemsArr
        .filter((item: any) => {
          const id = Number(item.Id || item.id);
          return id && !pairIds.includes(id) && isItemCoherentWithCluster(id, damageType) && (item.pickrate || 0) >= 10.0;
        })
        .sort((a: any, b: any) => scoreItemOption(b).score - scoreItemOption(a).score);

      if (viable3rd.length > 0) {
        thirdItem = Number(viable3rd[0].Id || viable3rd[0].id);
      } else {
        const fallbacks = damageType === 'AP' ? AP_FALLBACKS.offensive : AD_FIGHTER_FALLBACKS.offensive;
        thirdItem = fallbacks.find(id => !pairIds.includes(id)) || (damageType === 'AP' ? 3089 : 3031);
      }

      const representativeCore = [...pairIds, thirdItem];
      const sig = [...representativeCore].sort().join('-');
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);

      clusters.push({
        pivotItem,
        representativeCore,
        totalPickrate: pair.pickrate || 0,
        weightedWinrate: pair.winrate || 50.0,
        games: Number(pair.games || pair.count || 0) || undefined,
        damageType
      });
      if (clusters.length >= 6) break;
    }
  }

  return clusters.sort((a, b) => {
    const scoreA = evidenceScore({ pickrate: a.totalPickrate, winrate: a.weightedWinrate, games: a.games });
    const scoreB = evidenceScore({ pickrate: b.totalPickrate, winrate: b.weightedWinrate, games: b.games });
    return scoreB - scoreA;
  });
}

/**
 * Evalúa y califica un cluster de build en el contexto de la partida actual. Aplica bonos por sinergia y penalizaciones tácticas.
 */
export function scoreClusterInContext(
  cluster: BuildCluster,
  allies: string[],
  enemies: string[],
  champData: any
): number {
  const pr = Math.max(0, cluster.totalPickrate || 0);
  const wr = cluster.weightedWinrate || 50.0;

  // Pesa con prioridad de consenso meta (Pickrate dominante)
  const prContrib = pr * 0.75;
  const wrContrib = (wr - 50.0) * 0.5;
  const baseScore = scoreBuildVariant({ pickrate: pr, winrate: wr, games: cluster.games }).score;
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

  // Penalización por sobrecarga de tipo de daño aliado
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

  // Adjuntar desglose al objeto retornado para debug
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
 * Calcula la puntuación adicional contextual para un par de botas frente al equipo enemigo.
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
    const isFrontline = Boolean(e.isFrontline || e.is_frontline);
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
 * Selecciona las mejores botas de entre las opciones históricas del campeón ponderando consenso y adaptabilidad.
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
    burst:    [3006],
    dive:     [3006],
    skirmish: [],
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

  let bestBootId = 3047;
  let maxScore = -9999;

  bootPool.forEach(b => {
    const id = Number(b.itemId || b.id);
    const wr = b.winrate || 50.0;
    const pr = b.pickrate || 0;
    
    const score = consensusScore(pr, wr) + calcBootContextBonus(id, cluster, enemies, champData);

    if (score > maxScore) {
      maxScore = score;
      bestBootId = id;
    }
  });

  return bestBootId;
}

/**
 * Selecciona una página de runas completa y coherente (tupla completa) asociada al cluster y playstyle
 * directamente desde el dataset de partidas reales sin generar combinaciones híbridas artificiales.
 * 
 * @param runesData - Estructura de runas del scraper/LoLalytics.
 * @param cluster - El cluster de build activo.
 * @param champData - Datos de perfil enriquecido del campeón.
 * @returns Estructura con la página de runas completa coherente.
 */
export function selectRunesForCluster(
  runesData: RunesData,
  cluster: BuildCluster,
  champData?: EnrichedChampion
): {
  primaryStyleId: number;
  subStyleId: number;
  selections: number[];
  shards: number[];
} {
  const clusterDamageType = cluster.damageType || 'Hybrid';
  const runeToStyle = (assetsMap.runeToStyle || {}) as Record<number, number>;
  const basePrimaryStyleId = Number(champData?.buildData?.runes?.primaryStyleId) || 0;
  const baseSubStyleId = Number(champData?.buildData?.runes?.subStyleId) || 0;

  const sourcePages = Array.isArray(runesData.pages) ? [...runesData.pages]
    .sort((a, b) => scoreRunePage(b).score - scoreRunePage(a).score) : [];
  for (const page of sourcePages) {
    if (!page.selections || page.selections.length < 6) continue;
    const pageKeystoneType = KEYSTONE_DAMAGE_TYPE[page.selections[0]] || 'Hybrid';
    const damageCompatible = pageKeystoneType === 'Hybrid'
      || pageKeystoneType === clusterDamageType
      || clusterDamageType === 'Hybrid';
    if (damageCompatible && isValidRunePage(
      page.selections,
      page.primaryStyleId,
      page.subStyleId,
      runeToStyle
    )) {
      return {
        primaryStyleId: page.primaryStyleId,
        subStyleId: page.subStyleId,
        selections: page.selections.slice(0, 6),
        shards: page.shards?.slice(0, 3) || [5008, 5008, 5002]
      };
    }
  }

  // 1. Si champData tiene una build por defecto con página de runas completa coherente con el daño, reutilizarla
  if (champData?.buildData?.runes?.selections && champData.buildData.runes.selections.length >= 6) {
    const baseSelections = champData.buildData.runes.selections.map((r: any) => typeof r === 'object' ? Number(r.id || r.Id) : Number(r));
    const keystoneId = baseSelections[0];
    const keystoneType = KEYSTONE_DAMAGE_TYPE[keystoneId] || 'Hybrid';
    if (
      (keystoneType === 'Hybrid' || keystoneType === clusterDamageType || clusterDamageType === 'Hybrid')
      && isValidRunePage(baseSelections, basePrimaryStyleId || Number(runeToStyle[keystoneId]) || 8000, baseSubStyleId || 8400, runeToStyle)
    ) {
      const primaryStyleId = basePrimaryStyleId || Number(runeToStyle[keystoneId]) || 8000;
      const subStyleId = baseSubStyleId || 8400;
      const shards = (champData.buildData.runes.shards || [5008, 5008, 5002]).map((s: any) => typeof s === 'object' ? Number(s.id || s.Id) : Number(s));
      return {
        primaryStyleId,
        subStyleId,
        selections: baseSelections,
        shards
      };
    }
  }

  // 2. Extraer la keystone con mayor consensusScore coherente con el tipo de daño
  const rawKeystones = runesData.primaryRuneId || [];
  const filteredKeystones = rawKeystones.filter(r => {
    const id = Number(r.Id || r.id);
    const kType = KEYSTONE_DAMAGE_TYPE[id] || 'Hybrid';
    if (clusterDamageType === 'AD') return kType === 'AD' || kType === 'Hybrid';
    if (clusterDamageType === 'AP') return kType === 'AP' || kType === 'Hybrid';
    return true;
  });

  const candidatesKeystones = filteredKeystones.length > 0 ? filteredKeystones : rawKeystones;
  const sortedKeystones = [...candidatesKeystones].sort((a, b) => {
    return evidenceScore(b) - evidenceScore(a);
  });

  const primaryRuneId = Number(sortedKeystones[0]?.Id || sortedKeystones[0]?.id || 8010);
  const primaryStyleId = Number(runeToStyle[primaryRuneId]) || 8000;

  // 3. Extraer perks de las ranuras 2, 3 y 4 que pertenezcan estrictamente al árbol primario seleccionado
  const selectSlotRune = (slotOptions: RuneOption[] | undefined): number => {
    if (!Array.isArray(slotOptions) || slotOptions.length === 0) return 0;
    const sameStyle = slotOptions.filter(r => {
      const id = Number(r.Id || r.id);
      return Number(runeToStyle[id]) === primaryStyleId;
    });
    const pool = sameStyle.length > 0 ? sameStyle : slotOptions;
    const sorted = [...pool].sort((a, b) => evidenceScore(b) - evidenceScore(a));
    return Number(sorted[0]?.Id || sorted[0]?.id || 0);
  };

  const primaryRuneId2 = selectSlotRune(runesData.primaryRuneId2);
  const primaryRuneId3 = selectSlotRune(runesData.primaryRuneId3);
  const primaryRuneId4 = selectSlotRune(runesData.primaryRuneId4);

  // 4. Seleccionar árbol secundario cerrado: agrupar por estilo secundario, sumar consenso conjunto de sus 2 mejores runas
  const rawSecondary = runesData.secondaryRuneId || [];
  const secondaryByStyle: Record<number, RuneOption[]> = {};
  rawSecondary.forEach(r => {
    const id = Number(r.Id || r.id);
    const style = Number(runeToStyle[id]);
    if (style && style !== primaryStyleId && id !== 0) {
      if (!secondaryByStyle[style]) secondaryByStyle[style] = [];
      secondaryByStyle[style].push(r);
    }
  });

  let bestSubStyleId = 8400; // Resolve fallback
  let maxSubScore = -9999;
  let bestSubRunes: [number, number] = [0, 0];

  Object.entries(secondaryByStyle).forEach(([styleKey, opts]) => {
    const styleId = Number(styleKey);
    const pair = chooseSecondaryPair(opts, evidenceScore);
    if (pair) {
      const [r1, r2] = pair;
      const score = evidenceScore(r1) + evidenceScore(r2);
      if (score > maxSubScore) {
        maxSubScore = score;
        bestSubStyleId = styleId;
        bestSubRunes = [Number(r1.Id || r1.id), Number(r2.Id || r2.id)];
      }
    }
  });

  // 5. Seleccionar shards por consenso
  const selectBestShard = (shardOpts: RuneOption[] | undefined, defaultShard: number): number => {
    if (!Array.isArray(shardOpts) || shardOpts.length === 0) return defaultShard;
    const sorted = [...shardOpts].sort((a, b) => consensusScore(b.pickrate || 0, b.winrate || 50.0) - consensusScore(a.pickrate || 0, a.winrate || 50.0));
    return Number(sorted[0]?.Id || sorted[0]?.id || defaultShard);
  };

  const shards = [
    selectBestShard(runesData.perksStat1, 5008), // Adaptive Force
    selectBestShard(runesData.perksStat2, 5008), // Adaptive Force
    selectBestShard(runesData.perksStat3, 5002)  // Armor
  ];

  return {
    primaryStyleId,
    subStyleId: bestSubStyleId,
    selections: [
      primaryRuneId,
      primaryRuneId2,
      primaryRuneId3,
      primaryRuneId4,
      bestSubRunes[0],
      bestSubRunes[1]
    ],
    shards
  };
}

/**
 * Selecciona los items iniciales para el cluster según consenso.
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
    const score = consensusScore(pr, wr);

    if (score > maxScore) {
      maxScore = score;
      bestStarter = ids;
    }
  });

  return bestStarter;
}

/**
 * Selecciona summoners según consenso.
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
    const score = consensusScore(pr, wr);

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
  const enchanterItems = [2065, 4005, 3504, 6617, 6620, 3107, 3222, 3870, 3876, 3190];
  if (coreItems.some(id => enchanterItems.includes(Number(id)))) {
    return 'Support Enchanter';
  }
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
  statsData: any,
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

  const isSupport = myRole?.toUpperCase() === 'UTILITY' || myRole?.toUpperCase() === 'SUPPORT' || champUsesQuestItem(champ.name, myRole);
  const supportEvolution = selectSupportItemEvolution(champ.name, myRole);

  // 1. Starter: Obligatoriamente Atlas Mundial (3865) + 2 pociones de vida si es soporte
  let chosenStarterIds: number[] = [];
  if (isSupport) {
    chosenStarterIds = [3865, 2003, 2003];
  } else {
    chosenStarterIds = selectStarterForCluster(rawStarters, c);
  }
  const chosenSummoners = selectSummonersForCluster(rawSummoners, myRole);

  const dynamicPaths = getDynamicPaths(
    statsData.items || {},
    coreItemIds,
    c.damageType,
    chosenBootId,
    enemyContext,
    isAssassin
  );

  const starter = chosenStarterIds.map((id: number) => hydrateAsset('items', id));
  const boots = hydrateAsset('items', chosenBootId);

  // Swaps de core items dinámicos
  const swapsRaw = getCoreItemSwaps(coreItemIds, enemyContext, champ, enemyNames);
  const coreItemSwaps = swapsRaw.map(s => ({
    replaceItem: hydrateAsset('items', s.replaceItem),
    withItem: hydrateAsset('items', s.withItem),
    reason: s.reason,
    priority: s.priority
  }));

  // 2. Construcción de Core Items
  let fullCoreIds: number[] = [];
  if (isSupport && supportEvolution) {
    // Slot 1: Evolución de Soporte recomendada
    fullCoreIds = [supportEvolution.itemId];

    // Slots siguientes: 2-3 ítems principales completados del campeón (máximo 3-4 ítems totales sumando soporte)
    for (const id of coreItemIds) {
      if (fullCoreIds.length >= 4) break;
      if (!fullCoreIds.includes(id) && !SUPPORT_ITEM_IDS.includes(id) && id !== 3865 && id !== chosenBootId) {
        fullCoreIds.push(id);
      }
    }

    // Si aún tiene menos de 3 ítems totales, completar con la rama neutral
    for (const id of dynamicPaths.neutral) {
      if (fullCoreIds.length >= 3) break;
      if (!fullCoreIds.includes(id) && !SUPPORT_ITEM_IDS.includes(id) && id !== 3865 && id !== chosenBootId) {
        fullCoreIds.push(id);
      }
    }
  } else {
    // Roles normales: completar a 5 finalizados
    fullCoreIds = [...coreItemIds];
    for (const id of dynamicPaths.neutral) {
      if (fullCoreIds.length >= 5) break;
      if (!fullCoreIds.includes(id)) {
        fullCoreIds.push(id);
      }
    }
  }

  const core = fullCoreIds.map((id: number) => hydrateAsset('items', id));

  const paths = {
    snowball: dynamicPaths.snowball.map((id: number) => hydrateAsset('items', id)),
    neutral: dynamicPaths.neutral.map((id: number) => hydrateAsset('items', id)),
    behind: dynamicPaths.behind.map((id: number) => hydrateAsset('items', id))
  };

  const skillsData = defaultBuild?.skills || statsData?.skills || champ.buildData?.skills;
  const fullOrder = calculateSkillMaxOrder(skillsData);

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
 * Orquesta y calcula la build adaptada para un campeón en el contexto de su rol y composición de ambos equipos en el draft.
 * Esta función es un **entrypoint principal** del motor de items invocado a través de `getSingleChampionBuild` desde `DraftPage.tsx`.
 * 
 * El flujo del algoritmo consiste en:
 * 1. Resolver el perfil y LoLalytics del campeón. Si no existen, invoca a `getFallbackStaticBuild`.
 * 2. Detectar los clusters de builds distintas con `detectBuildClusters`.
 * 3. Evaluar y puntuar cada cluster contra el draft enemigo y aliado con `scoreClusterInContext`.
 * 4. Filtrar clusters redundantes y seleccionar el cluster ganador.
 * 5. Adaptar botas, runas, iniciales y proponer swaps en el core.
 * 6. Generar las ramas dinámicas y retornar el resultado completo.
 * 
 * @param championId - ID o nombre del campeón a buildear.
 * @param myTeamIds - IDs de los aliados pickeados.
 * @param theirTeamIds - IDs de los enemigos pickeados.
 * @param myRole - Rol en el que jugará el campeón.
 * @returns La build adaptada final con el cluster ganador, botas, runas, iniciales, swaps propuestos y alternativas.
 * 
 * @modifica La lógica de fallback y resolución de LoLalytics de builds por base de datos se maneja al inicio de esta función.
 */
export function getAdaptedBuild(
  championId: number | string,
  myTeamIds: number[] = [],
  theirTeamIds: number[] = [],
  myRole: string = 'jungle'
): any {
  let name = '';
  let champIdNum = 0;
  if (typeof championId === 'number') {
    champIdNum = championId;
    name = getNameFromId(championId) || '';
  } else {
    name = championId;
    champIdNum = NAME_TO_ID[name] || 0;
  }
  if (!name) return null;
  const champ = ENRICHED_DB[name];
  if (!champ) return null;

  const tacticRole = champ.tacticRole || champ.tactic_role || 'teamfight';
  const champClass = champ.class || '';
  const isAssassin = tacticRole === 'burst' || tacticRole === 'assassin' || champClass === 'Assassin';

  const roleUpper = myRole?.toUpperCase() || '';
  const defaultBuild = champ.builds?.find((b: any) => b.is_default && b.lane?.toUpperCase() === roleUpper && b.special_notes?.statsData)
    || champ.builds?.find((b: any) => b.is_default && b.special_notes?.statsData)
    || champ.builds?.find((b: any) => b.is_default && b.lane?.toUpperCase() === roleUpper)
    || champ.builds?.find((b: any) => b.is_default)
    || champ.buildData;
  // La ruta varía según la fuente de datos:
  // - SQLite → special_notes.statsData (guardado por sync.service)
  // - SQLite → buildData.statsData (ruta directa del scraper)
  const statsData = defaultBuild?.special_notes?.statsData
    || champ.buildData?.special_notes?.statsData
    || champ.buildData?.statsData  // ← ruta directa del JSON
    || champ.statsData;

  console.log(`\n🔍 [ENGINE] getAdaptedBuild → ${name} (ID: ${champIdNum})`);
  console.log(`   tacticRole: ${tacticRole} | class: ${champClass} | isAssassin: ${isAssassin}`);
  console.log(`   hasStatsData: ${!!(statsData && statsData.coreBuilds)} | builds count: ${champ.builds?.length ?? 0}`);
  console.log(`   allies: [${myTeamIds.join(', ')}] | enemies: [${theirTeamIds.join(', ')}]`);

  // Fallback si no hay statsData para campeones sin scrapeo completo
  if (!statsData || !statsData.coreBuilds) {
    console.log(`   ⚠️  Sin statsData → usando getFallbackStaticBuild`);
    return getFallbackStaticBuild(champ, myRole);
  }

  const clusters = detectBuildClusters(statsData);
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

  const rawBoots = statsData.boots || [];
  const rawRunes = statsData.runes || {};
  const rawStarters = statsData.startItems || [];
  const rawSummoners = statsData.summoners || [];
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
    const isFrontline = Boolean(e.isFrontline || e.is_frontline);
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

  const isSupport = myRole?.toUpperCase() === 'UTILITY' || myRole?.toUpperCase() === 'SUPPORT' || champUsesQuestItem(name, myRole);

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
      statsData.items || {},
      c.representativeCore,
      c.damageType,
      cBootId,
      enemyContext,
      isAssassin
    );
    let cFullCoreIds: number[] = [];
    if (isSupport && supportEvolution) {
      cFullCoreIds = [supportEvolution.itemId];
      for (const id of c.representativeCore) {
        if (cFullCoreIds.length >= 4) break;
        if (!cFullCoreIds.includes(id) && !SUPPORT_ITEM_IDS.includes(id) && id !== 3865 && id !== cBootId) {
          cFullCoreIds.push(id);
        }
      }
      for (const id of cDynamicPaths.neutral) {
        if (cFullCoreIds.length >= 3) break;
        if (!cFullCoreIds.includes(id) && !SUPPORT_ITEM_IDS.includes(id) && id !== 3865 && id !== cBootId) {
          cFullCoreIds.push(id);
        }
      }
    } else {
      cFullCoreIds = [...c.representativeCore];
      for (const id of cDynamicPaths.neutral) {
        if (cFullCoreIds.length >= 5) break;
        if (!cFullCoreIds.includes(id)) {
          cFullCoreIds.push(id);
        }
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
        c, champ, statsData, rawBoots, rawRunes,
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
        games: c.games,
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
      c, champ, statsData, rawBoots, rawRunes,
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
      games: c.games,
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

  const selectedRunePage = Array.isArray(rawRunes.pages)
    ? rawRunes.pages.find((page: any) => Array.isArray(page.selections) && page.selections.length >= 6 && page.selections.slice(0, 6).join(',') === winningClusterData.build.runes.selections.map((r: any) => Number(r?.id || r)).slice(0, 6).join(','))
    : null;
  const recommendationScores = {
    build: scoreBuildVariant({
      pickrate: winningClusterData.totalPickrate,
      winrate: winningClusterData.weightedWinrate,
      games: winningClusterData.games
    }),
    runes: scoreRunePage(selectedRunePage || {})
  };

  const situationalItems = ['item4', 'item5', 'item6'].reduce((result: any, slot: string) => {
    const options = (statsData.items?.[slot] || [])
      .map((item: any) => ({ ...item, itemId: Number(item.itemId || item.Id || item.id) }))
      .filter((item: any) => item.itemId > 0 && isItemCoherentWithCluster(item.itemId, winningClusterData.damageType))
      .sort((a: any, b: any) => scoreItemOption(b).score - scoreItemOption(a).score)
      .slice(0, 3)
      .map((item: any) => ({
        item: hydrateAsset('items', item.itemId),
        score: scoreItemOption(item).score,
        confidence: scoreItemOption(item).confidence,
        pickrate: Number(item.pickrate || item.pickRate || 0),
        winrate: Number(item.winrate || item.winRate || 50),
        games: Number(item.games || item.count || 0)
      }));
    result[slot] = options;
    return result;
  }, {} as Record<string, any[]>);

  const defaultBootId = typeof defaultBuild?.items?.boots === 'object'
    ? (defaultBuild.items.boots.id || defaultBuild.items.boots.itemId)
    : (Number(defaultBuild?.items?.boots) || 3047);

  // Validación de coherencia y reporte de errores en consola
  if (winningClusterData.damageType === 'AD') {
    const NEVER_IN_AD_RUNES = [8229, 8214, 8230];
    const NEVER_IN_AD_ITEMS = [6653, 3152, 4645, 3135, 3165, 3071];
    const NEVER_IN_ASSASSIN_SHARDS = [5005];

    const selectedKeystone = Number(winningClusterData.build.runes.selections[0]?.id || 0);
    const finalCoreIds = winningClusterData.fullCoreIds.map((id: any) => Number(id));
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
    id: championId,
    name: name,
    isAdapted: chosenBootId !== defaultBootId || winningClusterData.pivotItem !== (defaultBuild?.items?.core?.[0] || 0) || coreItemSwaps.length > 0,
    bootsSelection: {
      bootId: chosenBootId,
      reason: chosenBootId === 3111 ? "CC crítico enemigo — Mercury adaptado" : (chosenBootId === 3047 ? "Composición AD pesada — Tabi adaptado" : "Botas coherentes con tu cluster")
    },
    supportEvolution: hydratedSupportEvolution,
    coreItemSwaps,
    recommendationScores,
    situationalItems,
    // Clusters limpios con sus builds para que la UI pueda renderizarlos y alternar entre ellos
    scoredClusters: filteredClusters.map(c => ({
      pivotItem: c.pivotItem,
      damageType: c.damageType,
      totalPickrate: c.totalPickrate,
      weightedWinrate: c.weightedWinrate,
      games: c.games,
        score: c.score,
      isWinner: c.isWinner,
      title: c.title,
      build: c.build,
      coreItemSwaps: c.coreItemSwaps
    })),
    build
  };
}
