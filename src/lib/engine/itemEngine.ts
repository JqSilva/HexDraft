// src/lib/engine/itemEngine.ts
import { ENRICHED_DB, normalizeKey, ITEMS_DB } from './dataProvider.js';
import { NAME_TO_ID } from './constants.js';
import { hydrateAsset } from './hydrator.js';
import { analyzeComposition } from './compositionAnalyzer.js';

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

// Fallbacks seguros de items para rellenar rutas de continuación vacías
const AD_FALLBACKS = {
  offensive: [3031, 3036, 6701, 3072], // IE, LDR, Oportunidades, Sanguinaria
  balanced: [3071, 3053, 3156, 6333],  // Cuchilla Oscura, Sterak, Fauces, Baile de la Muerte
  defensive: [2504, 3075, 3110, 3143]  // Kaenic, Thornmail, Corazón de Hielo, Randuin
};

const AP_FALLBACKS = {
  offensive: [3089, 3135, 3137, 3020], // Rabadon, Void, Criptoflora, Botas Hechicero (representativo)
  balanced: [3157, 3102, 6653, 3001],  // Zhonya, Banshee, Liandry, Máscara Abisal
  defensive: [2504, 3065, 3110, 3143]  // Kaenic, Apariencia Espiritual, Corazón de Hielo, Randuin
};

// Lista de sanadores pesados para gatillar heridas graves
const HEAVY_HEALERS = new Set([
  "soraka", "yuumi", "sylas", "aatrox", "briar", "vladimir", "drmundo", 
  "warwick", "swain", "nami", "sona", "seraphine", "taric", "renekton", 
  "volibear", "illaoi", "fiddlesticks", "kayn", "nilah", "samira", "olaf"
]);

// Helper para obtener nombre del campeón por ID
export function getNameFromId(id: number): string | undefined {
  return Object.keys(NAME_TO_ID).find(key => NAME_TO_ID[key] === id);
}

// Clasificador de un item individual
export function classifyItem(itemId: number): 'offensive' | 'balanced' | 'defensive' {
  const baseId = itemId > 220000 ? itemId % 220000 : itemId;

  // Si existe en ITEMS_DB, hacemos la clasificación semántica
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

  // Fallback estático
  if (HARDCODED_CATEGORIES.MAGIC_RESIST.includes(baseId) || HARDCODED_CATEGORIES.ARMOR.includes(baseId)) {
    // Si da daño (como Zhonya, Sterak, Fauces, Death's Dance, Eclipse, Stridebreaker), es balanceado
    const balancedIds = [3053, 3156, 3157, 6333, 6692, 6631, 3078, 6673, 3072, 3074, 3748, 6653, 223053, 223156, 223157, 226692, 226631, 223078, 226673, 223072, 223074, 223748, 226653];
    if (balancedIds.includes(baseId)) {
      return 'balanced';
    }
    // Si es puro tanque, es defensivo
    return 'defensive';
  }

  // Si da penetración pero tiene HP/Resist (como Cuchilla Oscura, Liandry, Abyssal), es balanceado
  const balancedUtilityIds = [3071, 6653, 3001, 223071, 226653];
  if (balancedUtilityIds.includes(baseId)) {
    return 'balanced';
  }

  // De lo contrario, es ofensivo
  return 'offensive';
}

// Comprueba si un item está en un grupo determinado
function isItemInGroup(itemId: number, group: number[]): boolean {
  const baseId = itemId > 220000 ? itemId % 220000 : itemId;
  return group.includes(baseId);
}

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

  // Si no hay builds asociadas, fallback
  if (!champ.builds || champ.builds.length === 0) {
    return getFallbackStaticBuild(champ, myRole);
  }

  // --- ANALIZAR COMPOSICIÓN CON MODULE CENTRALIZADO ---
  const allyNames = myTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];
  const enemyNames = theirTeamIds.map(id => getNameFromId(id)).filter(Boolean) as string[];
  const myName = getNameFromId(championId) || "";

  const allyComp = analyzeComposition(allyNames);
  const enemyComp = analyzeComposition(enemyNames);

  const allyADCount = allyComp.adCount;
  const allyAPCount = allyComp.apCount;
  const hasOtherAllies = allyNames.filter(n => n !== myName).length > 0;

  const enemyADCount = enemyComp.adCount;
  const enemyAPCount = enemyComp.apCount;
  const enemyTankCount = enemyComp.tankCount;
  const enemyCCCount = enemyComp.ccCount;
  const enemyHealerCount = enemyComp.healerCount;

  const damageType = champ.damageType || 'AD';

  // --- 1. SELECCIÓN DEL CORE BUILD + RUNAS (SCORING UNIFICADO) ---
  let bestBuild = champ.builds.find((b: any) => b.is_default) || champ.builds[0];
  let maxScore = -9999;

  champ.builds.forEach((b: any) => {
    let score = 50.0;
    // Si tiene winrate/pickrate en las notas, úsalo de base
    const notes = b.special_notes || {};
    if (notes.winrate) score = parseFloat(notes.winrate);
    if (notes.pickrate) score += parseFloat(notes.pickrate) * 0.1;

    const tags = Array.isArray(b.tags) ? b.tags : [];
    const coreItems = b.items?.core || [];

    // Comprobar items específicos del core para afinar scoring
    const hasArmorPen = coreItems.some((id: number) => isItemInGroup(id, ITEM_CATEGORIES.ARMOR_PEN));
    const hasMagicPen = coreItems.some((id: number) => isItemInGroup(id, ITEM_CATEGORIES.MAGIC_PEN));
    const hasMR = coreItems.some((id: number) => isItemInGroup(id, ITEM_CATEGORIES.MAGIC_RESIST));
    const hasArmor = coreItems.some((id: number) => isItemInGroup(id, ITEM_CATEGORIES.ARMOR));
    const hasGrievous = coreItems.some((id: number) => isItemInGroup(id, ITEM_CATEGORIES.GRIEVOUS_WOUNDS));

    // Balanceo de daño del equipo aliado (Playstyle adecuado para la comp)
    if (hasOtherAllies) {
      // Si nuestro equipo no tiene daño mágico (0 AP), favorecer fuertemente builds AP
      if (allyAPCount === 0 && (tags.includes("ap") || tags.includes("AP"))) {
        score += 25.0;
      }
      // Si nuestro equipo no tiene daño físico (0 AD), favorecer fuertemente builds AD/Lethality/Bruiser
      if (allyADCount === 0 && (tags.includes("bruiser") || tags.includes("lethality") || tags.includes("on-hit"))) {
        score += 25.0;
      }
    }

    // Ajustes por Tanques enemigos
    if (enemyTankCount >= 1) {
      if (tags.includes("anti-tank") || tags.includes("vs_tank") || (damageType === 'AD' && hasArmorPen) || (damageType === 'AP' && hasMagicPen)) {
        score += 15.0 * enemyTankCount;
      }
    }

    // Ajustes por Squishies enemigos
    const enemySquishyCount = enemyComp.assassinCount + (enemyComp.damageProfile.isBalanced ? 1 : 2);
    if (enemySquishyCount >= 3) {
      if (tags.includes("vs_squishy") || tags.includes("lethality") || tags.includes("burst")) {
        score += 10.0;
      }
    }

    // Ajustes por Healers
    if (enemyHealerCount >= 1) {
      if (tags.includes("sustain") || hasGrievous) {
        score += 8.0 * enemyHealerCount;
      }
    }

    // Ajustes por composiciones full AD o AP
    if (enemyAPCount >= 3) {
      if (tags.includes("anti-AP") || hasMR) {
        score += 12.0;
      }
    }
    if (enemyADCount >= 3) {
      if (tags.includes("anti-AD") || hasArmor) {
        score += 12.0;
      }
    }

    // Adaptación específica de las RUNAS correspondientes a esta build
    if (b.runes) {
      const keystoneId = Number(b.runes.selections?.[0]);
      const primaryStyle = Number(b.runes.primaryStyleId);
      const secondaryStyle = Number(b.runes.subStyleId);

      // Si hay 2 o más tanques enemigos, Conqueror (8010) o PTA (8005) son óptimas
      if (enemyTankCount >= 2) {
        if (keystoneId === 8010 || keystoneId === 8005) {
          score += 10.0;
        }
        // Penalizar runas puramente de burst contra tanques
        if (keystoneId === 8112 || keystoneId === 9923) {
          score -= 6.0;
        }
      }

      // Si el enemigo no tiene tanques, favorecer runas de burst/asesinato rápido
      if (enemyTankCount === 0 && (enemyADCount + enemyAPCount) >= 3) {
        if (keystoneId === 8112 || keystoneId === 8369 || keystoneId === 8128 || keystoneId === 9923) {
          score += 8.0;
        }
      }

      // Si hay mucho CC enemigo, Phase Rush (8230) es una excelente vía de escape, o el árbol de Valor
      if (enemyCCCount >= 3) {
        if (keystoneId === 8230) {
          score += 12.0;
        }
        if (primaryStyle === 8400 || secondaryStyle === 8400) {
          score += 6.0;
        }
      }
    }

    // Favorecer levemente las builds por defecto si los puntajes están muy cerrados
    if (b.is_default) {
      score += 2.0;
    }

    if (score > maxScore) {
      maxScore = score;
      bestBuild = b;
    }
  });

  // Estructura de items del core ganador
  let coreItemIds = bestBuild.items?.core || [];
  if (coreItemIds.length === 0 && bestBuild.items?.coreSlots) {
    coreItemIds = bestBuild.items.coreSlots;
  }
  if (Array.isArray(coreItemIds)) {
    coreItemIds = coreItemIds.map((i: any) => typeof i === 'object' ? Number(i.id || i.itemId) : Number(i));
  }
  let starterIds = bestBuild.items?.starter || [];
  if (Array.isArray(starterIds)) {
    starterIds = starterIds.map((i: any) => typeof i === 'object' ? Number(i.id || i.itemId) : Number(i));
  }
  if (myRole.toLowerCase() === 'utility' && !starterIds.includes(3858)) {
    starterIds = [3858, ...starterIds.filter(id => id !== 3858)];
  }
  const defaultBootId = typeof bestBuild.items?.boots === 'object'
    ? (bestBuild.items.boots.id || bestBuild.items.boots.itemId)
    : (Number(bestBuild.items?.boots) || 3047);

  const enemyContext = {
    enemyADCount,
    enemyAPCount,
    enemyTankCount,
    enemyCCCount,
    enemyHealerCount
  };

  // --- 2. SELECCIÓN DE BOTAS ADAPTATIVA ---
  const bootSelectionResult = selectBoots(name, enemyContext);
  const adaptedBootId = bootSelectionResult.bootId;

  // --- 2.3 SOPORTE EVOLUCION ---
  const supportEvolution = selectSupportItemEvolution(name, myRole);
  let hydratedSupportEvolution = null;
  if (supportEvolution) {
    hydratedSupportEvolution = {
      item: hydrateAsset('items', supportEvolution.itemId),
      reason: supportEvolution.reason
    };
  }

  // --- 2.5 CORE ITEM SWAPS ---
  const swapsRaw = getCoreItemSwaps(coreItemIds, enemyContext, champ);
  const coreItemSwaps = swapsRaw.map(s => ({
    replaceItem: hydrateAsset('items', s.replaceItem),
    withItem: hydrateAsset('items', s.withItem),
    reason: s.reason,
    priority: s.priority
  }));

  // --- 3. SELECCIÓN/GENERACIÓN DE LAS 3 RAMAS DE CONTINUACIÓN ---
  let finalSnowball: number[] = [];
  let finalNeutral: number[] = [];
  let finalBehind: number[] = [];

  const slotItems = bestBuild.items?.slotItems;
  if (slotItems && (slotItems.item4 || slotItems.item5)) {
    const pathsIds = getDynamicPaths(slotItems, coreItemIds, damageType, adaptedBootId, enemyContext);
    finalSnowball = pathsIds.snowball;
    finalNeutral = pathsIds.neutral;
    finalBehind = pathsIds.behind;
  } else if (bestBuild.items?.paths) {
    const p = bestBuild.items.paths;
    const getCleanIds = (arr: any[]) => (arr || []).map((i: any) => typeof i === 'object' ? Number(i.id) : Number(i));
    finalSnowball = getCleanIds(p.snowball);
    finalNeutral = getCleanIds(p.neutral);
    finalBehind = getCleanIds(p.behind);
  } else {
    // Fallback dinámico si no están precalculados en la base de datos
    const slotItemsRaw = bestBuild.items?.slotItems || {};
    const pathsIds = getPathsForBuild(slotItemsRaw, coreItemIds, damageType, adaptedBootId);
    finalSnowball = pathsIds.snowball;
    finalNeutral = pathsIds.neutral;
    finalBehind = pathsIds.behind;
  }

  // --- 4. ARMAR RESULTADO FINAL ---
  const skills = bestBuild.skills;
  const fullOrder = skills
    ? [
        { key: "Q", pos: skills.skillLevelUp1 || 1 },
        { key: "W", pos: skills.skillLevelUp2 || 2 },
        { key: "E", pos: skills.skillLevelUp3 || 3 }
      ]
      .sort((a, b) => a.pos - b.pos)
      .map(s => s.key)
      .join(" > ")
    : "Q > W > E";

  return {
    name: name,
    isAdapted: adaptedBootId !== defaultBootId || coreItemSwaps.length > 0,
    bootsSelection: {
      bootId: adaptedBootId,
      reason: bootSelectionResult.reason
    },
    supportEvolution: hydratedSupportEvolution,
    coreItemSwaps: coreItemSwaps,
    build: {
      summoners: bestBuild.summoners.map((id: number) => hydrateAsset('summoners', id)),
      runes: {
        primaryStyle: bestBuild.runes.primaryStyleId,
        secondaryStyle: bestBuild.runes.subStyleId,
        keystone: hydrateAsset('runes', typeof bestBuild.runes.selections?.[0] === 'object' ? bestBuild.runes.selections[0].id : bestBuild.runes.selections?.[0]),
        shards: (bestBuild.runes.shards || []).map((id: any) => hydrateAsset('shards', typeof id === 'object' ? id.id : id)),
        selections: (bestBuild.runes.selections || []).map((id: any) => hydrateAsset('runes', typeof id === 'object' ? id.id : id))
      },
      items: {
        starter: starterIds.map((id: number) => hydrateAsset('items', id)),
        boots: hydrateAsset('items', adaptedBootId),
        core: coreItemIds.map((id: number) => hydrateAsset('items', id)),
        paths: {
          snowball: finalSnowball.map((id: number) => hydrateAsset('items', id)),
          neutral: finalNeutral.map((id: number) => hydrateAsset('items', id)),
          behind: finalBehind.map((id: number) => hydrateAsset('items', id))
        }
      },
      skillOrder: fullOrder
    }
  };
}

// Fallback estático en caso de que no existan builds en SQLite
function getFallbackStaticBuild(champ: any, myRole: string = 'jungle'): any {
  const b = champ.buildData || { runes: {}, items: { starter: [], boots: { id: 3047 }, core: [] }, summoners: [4, 12] };
  const damageType = champ.damageType || 'AD';
  
  let coreIds = b.items?.core || [];
  if (coreIds.length === 0 && b.items?.coreSlots) {
    coreIds = b.items.coreSlots;
  }
  if (Array.isArray(coreIds)) {
    coreIds = coreIds.map((i: any) => typeof i === 'object' ? Number(i.id || i.itemId) : Number(i));
  }
  const bootId = typeof b.items?.boots === 'object'
    ? (b.items.boots.id || b.items.boots.itemId)
    : (Number(b.items?.boots) || 3047);
  let starter = b.items?.starter || [];
  if (Array.isArray(starter)) {
    starter = starter.map((i: any) => typeof i === 'object' ? Number(i.id || i.itemId) : Number(i));
  }
  if (myRole.toLowerCase() === 'utility' && !starter.includes(3858)) {
    starter = [3858, ...starter.filter(id => id !== 3858)];
  }

  let paths = b.items?.paths;
  let finalSnowball = (paths?.snowball || []).map((i: any) => typeof i === 'object' ? i.id : i);
  let finalNeutral = (paths?.neutral || []).map((i: any) => typeof i === 'object' ? i.id : i);
  let finalBehind = (paths?.behind || []).map((i: any) => typeof i === 'object' ? i.id : i);

  if (finalSnowball.length === 0) {
    const fallbacks = damageType === 'AP' ? AP_FALLBACKS : AD_FALLBACKS;
    finalSnowball = fallbacks.offensive.slice(0, 2);
    finalNeutral = fallbacks.balanced.slice(0, 2);
    finalBehind = fallbacks.defensive.slice(0, 2);
  }

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
    isAdapted: false,
    bootsSelection: {
      bootId: bootId,
      reason: "Botas estándar de tu build recomendada"
    },
    supportEvolution: hydratedSupportEvolution,
    coreItemSwaps: [],
    build: {
      summoners: b.summoners?.map((id: number) => hydrateAsset('summoners', id)) || [hydrateAsset('summoners', 4), hydrateAsset('summoners', 12)],
      runes: {
        primaryStyle: b.runes?.primaryStyleId || 8000,
        secondaryStyle: b.runes?.subStyleId || 8400,
        keystone: hydrateAsset('runes', typeof b.runes?.selections?.[0] === 'object' ? b.runes.selections[0].id : (b.runes?.selections?.[0] || 8010)),
        shards: (b.runes?.shards || []).map((id: any) => hydrateAsset('shards', typeof id === 'object' ? id.id : id)),
        selections: (b.runes?.selections || []).map((id: any) => hydrateAsset('runes', typeof id === 'object' ? id.id : id))
      },
      items: {
        starter: starter.map((id: number) => hydrateAsset('items', id)),
        boots: hydrateAsset('items', bootId),
        core: coreIds.map((id: number) => hydrateAsset('items', id)),
        paths: {
          snowball: finalSnowball.map((id: number) => hydrateAsset('items', id)),
          neutral: finalNeutral.map((id: number) => hydrateAsset('items', id)),
          behind: finalBehind.map((id: number) => hydrateAsset('items', id))
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
  adaptedBootId: number
): { snowball: number[], neutral: number[], behind: number[] } {
  const itemPoolMap = new Map<number, { id: number, pickrate: number, winrate: number }>();

  // Consolidar todos los objetos únicos de los slots
  Object.keys(slotItems || {}).forEach(slotKey => {
    const arr = slotItems[slotKey] || [];
    arr.forEach((item: any) => {
      const id = Number(item.Id);
      if (!id) return;
      const existing = itemPoolMap.get(id);
      if (!existing || item.pickrate > existing.pickrate) {
        itemPoolMap.set(id, { id, pickrate: item.pickrate, winrate: item.winrate });
      }
    });
  });

  // Filtrar el pool
  const candidates: { id: number, pickrate: number, winrate: number }[] = [];
  const coreSet = new Set(coreItemIds);
  const bootSet = new Set([3047, 3111, 3020, 3006, 3158, 3009, 3117, 223047, 223111]); // Botas comunes

  itemPoolMap.forEach(cand => {
    if (coreSet.has(cand.id)) return;
    if (bootSet.has(cand.id)) return;
    const asset = hydrateAsset('items', cand.id);
    if (!asset || asset.gold < 1500) return;
    candidates.push(cand);
  });

  // Filtrado de pickrate (10%). Si nos quedamos sin opciones, bajamos el umbral progresivamente.
  let minPickrate = 10.0;
  let filteredCandidates = candidates.filter(c => c.pickrate >= minPickrate);
  if (filteredCandidates.length < 4) {
    minPickrate = 3.0;
    filteredCandidates = candidates.filter(c => c.pickrate >= minPickrate);
  }
  if (filteredCandidates.length < 2) {
    filteredCandidates = candidates;
  }

  // Agrupar candidatos por categorías
  const offensiveCandidates: number[] = [];
  const balancedCandidates: number[] = [];
  const defensiveCandidates: number[] = [];

  filteredCandidates.forEach(cand => {
    const type = classifyItem(cand.id);
    if (type === 'offensive') offensiveCandidates.push(cand.id);
    else if (type === 'balanced') balancedCandidates.push(cand.id);
    else if (type === 'defensive') defensiveCandidates.push(cand.id);
  });

  // Función para rellenar con fallbacks
  const fillBranch = (currentList: number[], type: 'offensive' | 'balanced' | 'defensive'): number[] => {
    const list = [...new Set(currentList)];
    const fallbacks = damageType === 'AP' ? AP_FALLBACKS[type] : AD_FALLBACKS[type];
    
    for (const item of fallbacks) {
      if (list.length >= 2) break;
      if (!coreSet.has(item) && item !== adaptedBootId && !list.includes(item)) {
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
  }
): { snowball: number[], neutral: number[], behind: number[] } {
  const candidatesMap = new Map<number, { id: number; pickrate: number; winrate: number }>();

  // Consolidar candidatos del 4to y 5to slot (item4 e item5).
  // Si no hay suficientes, recurrimos a item3.
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

  const candidates: { id: number; pickrate: number; winrate: number; score: number }[] = [];

  candidatesMap.forEach(cand => {
    if (coreSet.has(cand.id)) return;
    if (bootSet.has(cand.id)) return;
    const asset = hydrateAsset('items', cand.id);
    if (!asset || asset.gold < 1500) return;
    
    // Filtrar ítems trolls/off-meta: pickrate mínimo de 1.5%
    if (cand.pickrate < 1.5) return;

    // Puntuación base
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
        if (enemyContext.enemyTankCount >= 1) {
          score += 12.0 * enemyContext.enemyTankCount;
        } else {
          score -= 5.0;
        }
      } else {
        score -= 25.0; // Descartar item de AD pen en campeón AP
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
        score -= 25.0; // Descartar item de AP pen en campeón AD
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

  // Agrupar candidatos por categorías
  const offensive: number[] = [];
  const balanced: number[] = [];
  const defensive: number[] = [];

  // Ordenar candidatos por puntuación descendente
  candidates.sort((a, b) => b.score - a.score);

  candidates.forEach(c => {
    const type = classifyItem(c.id);
    if (type === 'offensive') offensive.push(c.id);
    else if (type === 'balanced') balanced.push(c.id);
    else if (type === 'defensive') defensive.push(c.id);
  });

  // Rellenar con fallbacks si es necesario
  const fillBranch = (currentList: number[], type: 'offensive' | 'balanced' | 'defensive'): number[] => {
    const list = [...new Set(currentList)];
    const fallbacks = damageType === 'AP' ? AP_FALLBACKS[type] : AD_FALLBACKS[type];
    
    for (const item of fallbacks) {
      if (list.length >= 2) break;
      if (!coreSet.has(item) && item !== adaptedBootId && !list.includes(item)) {
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

// --- 5. CONSTANTES Y CONFIGURACIÓN DE UMBRALES DE ADAPTACIÓN ---
export const ADAPTATION_THRESHOLDS = {
  antiHeal: {
    minHealerCount: 2,           // Mínimo para sugerir anti-heal
    minChampPickrate: 3.0,       // Pickrate mínimo del item en datos del campeón
    maxCoreDisruption: 1,        // Máximo 1 item del core que se puede reemplazar
  },
  tankPen: {
    minTankCount: 2,
    minChampPickrate: 2.0,
  },
  defensiveItem: {
    minThreatCount: 3,           // Mínimo 3 amenazas del mismo tipo para forzar defensiva
    minChampPickrate: 1.5,
  }
};

const SUPPORT_ITEM_IDS = [3869, 3870, 3871, 3876, 3877]; // Versiones finales
const SUPPORT_ITEM_QUEST_IDS = [3850, 3851, 3853, 3855, 3858, 3859, 3860, 3862, 3864]; // Quest items

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
  
  // Determinar el umbral de pickrate según la categoría del item
  let minPickrate = 3.0; // Umbral por defecto
  
  if (ITEM_CATEGORIES.GRIEVOUS_WOUNDS.includes(itemId)) {
    minPickrate = ADAPTATION_THRESHOLDS.antiHeal.minChampPickrate;
  } else if (ITEM_CATEGORIES.ARMOR_PEN.includes(itemId) || ITEM_CATEGORIES.MAGIC_PEN.includes(itemId)) {
    minPickrate = ADAPTATION_THRESHOLDS.tankPen.minChampPickrate;
  } else if (ITEM_CATEGORIES.ARMOR.includes(itemId) || ITEM_CATEGORIES.MAGIC_RESIST.includes(itemId) || ITEM_CATEGORIES.TENACITY.includes(itemId)) {
    minPickrate = ADAPTATION_THRESHOLDS.defensiveItem.minChampPickrate;
  }
  
  // 1. ¿El item aparece en los slotItems del campeón con pickrate mínimo?
  const allSlotItems = Object.values(champData.buildData?.slotItems || {}).flat();
  const inPool = allSlotItems.find((i: any) => 
    Number(i.Id || i.id) === itemId
  );
  
  // Si el item existe en los datos scrapeados con pickrate >= umbral, es viable
  if (inPool) {
    const pickrate = parseFloat(inPool.pickrate || inPool.pickRate || 0);
    if (pickrate >= minPickrate) return true;
  }
  
  // 2. Si no aparece en datos scrapeados (o pickrate bajo), verificar compatibilidad semántica
  const item = ITEMS_DB[itemId];
  const champDmgType = champData.damageType;
  const itemCats = item?.categories || [];
  
  if (champDmgType === 'AD' && itemCats.includes('SpellDamage') && !itemCats.includes('Damage')) 
    return false;
  if (champDmgType === 'AP' && itemCats.includes('AttackDamage') && !itemCats.includes('SpellDamage')) 
    return false;
  
  return true; // Si no está en pool y pasa la semántica, es viable
}

export interface BootsResult {
  bootId: number;
  reason: string;
  source: 'champion_locked' | 'meta_stats' | 'composition_adapted';
}

// --- 6. SELECCIÓN DE BOTAS GRANULAR Y CAPAS DE PRIORIDAD ---
export function selectBoots(
  champName: string,
  enemyContext: {
    enemyADCount: number;
    enemyAPCount: number;
    enemyTankCount: number;
    enemyCCCount: number;
    enemyHealerCount: number;
  }
): BootsResult {
  const champ = ENRICHED_DB[champName];
  if (!champ) {
    return { bootId: 3047, reason: "Botas estándar de tu build recomendada", source: 'meta_stats' };
  }
  const champClass = champ.class;
  const damageType = champ.damageType;
  
  // === CAPA 1: VETO DURO DEL CAMPEÓN ===
  const CHAMPION_BOOT_LOCKS: Record<string, number> = {
    'Cassiopeia': 3009,   // Cassio no lleva botas (su pasiva)
    'Hecarim': 3006,      // Hecarim siempre Berserker (su pasiva escala con MS)
  };
  
  if (CHAMPION_BOOT_LOCKS[champName] !== undefined) {
    const bootId = CHAMPION_BOOT_LOCKS[champName];
    return { 
      bootId, 
      reason: `${champName} tiene una mecánica de pasiva que hace obligatorio este tipo de botas`,
      source: 'champion_locked'
    };
  }
  
  // === CAPA 2: PREFERENCIA ESTADÍSTICA DEL CAMPEÓN ===
  const BOOT_IDS = [3006, 3009, 3020, 3047, 3111, 3117, 3158];
  const slotItems = champ.buildData?.slotItems || {};
  const allItems: any[] = Object.values(slotItems).flat();
  
  const bootStats = BOOT_IDS.map(id => {
    const found = allItems.find((i: any) => Number(i.Id || i.id) === id);
    return { id, pickrate: found ? parseFloat(found.pickrate || found.pickRate || 0) : 0 };
  }).sort((a, b) => b.pickrate - a.pickrate);
  
  const dominantBoot = bootStats[0];
  
  if (dominantBoot && dominantBoot.pickrate >= 40) {
    const isExtremeCCThreat = enemyContext.enemyCCCount >= 3;
    const isExtremeADThreat = enemyContext.enemyADCount >= 4;
    
    if (!isExtremeCCThreat && !isExtremeADThreat) {
      return {
        bootId: dominantBoot.id,
        reason: `Botas estándar de ${champName} (${dominantBoot.pickrate.toFixed(0)}% de partidas). La composición enemiga no justifica un cambio.`,
        source: 'meta_stats'
      };
    }
    
    if (dominantBoot.id !== 3111 && isExtremeCCThreat) {
      return {
        bootId: dominantBoot.id,
        reason: `Botas estándar de ${champName}. Considera Mercury como alternativa situacional (${enemyContext.enemyCCCount} fuentes de CC enemigo).`,
        source: 'meta_stats'
      };
    }
  }
  
  // === CAPA 3: LÓGICA DE COMPOSICIÓN ===
  if (enemyContext.enemyCCCount >= 3 || 
     (enemyContext.enemyCCCount >= 2 && enemyContext.enemyAPCount >= 3)) {
    return { bootId: 3111, reason: "CC crítico enemigo — Mercury obligatorio", source: 'composition_adapted' };
  }
  if (enemyContext.enemyADCount >= 4) {
    return { bootId: 3047, reason: "Composición AD extrema", source: 'composition_adapted' };
  }
  if (damageType === 'AP') {
    return { bootId: 3020, reason: "Penetración mágica estándar", source: 'composition_adapted' };
  }
  
  return { bootId: (dominantBoot && dominantBoot.id) || 3006, reason: "Botas estándar", source: 'meta_stats' };
}

// --- 7. CORE ITEM SWAPS ---
export interface CoreItemSwap {
  replaceItem: number;
  withItem: number;
  reason: string;
  priority: 'critical' | 'recommended' | 'optional';
}

export function getCoreItemSwaps(
  coreItems: number[],
  enemyContext: any,
  champProfile: any
): CoreItemSwap[] {
  const swaps: CoreItemSwap[] = [];
  const champName = champProfile.name;

  // 1. Void Staff swap-out si no hay tanques
  if (coreItems.includes(3135) && enemyContext.enemyTankCount === 0) {
    const targetItem = 4645;
    if (isItemViableForChamp(targetItem, champName)) {
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

  // 2. Anti-healing swap-in si hay 2+ sanadores
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
    
    if (viableAntiHeal !== null) {
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

  // 3. Tank pen swap-in si hay 2+ tanques
  const hasPen = coreItems.some(id => 
    ITEM_CATEGORIES.ARMOR_PEN.includes(id) || ITEM_CATEGORIES.MAGIC_PEN.includes(id)
  );
  if (!hasPen && enemyContext.enemyTankCount >= ADAPTATION_THRESHOLDS.tankPen.minTankCount) {
    const isAP = champProfile.damageType === 'AP';
    let bestPen = isAP ? 3135 : 3036;
    
    let viablePen: number | null = bestPen;
    if (!isItemViableForChamp(bestPen, champName)) {
      const alternatives = (isAP ? ITEM_CATEGORIES.MAGIC_PEN : ITEM_CATEGORIES.ARMOR_PEN)
        .filter(id => isItemViableForChamp(id, champName));
      viablePen = alternatives[0] || null;
    }
    
    if (viablePen !== null) {
      swaps.push({
        replaceItem: coreItems[coreItems.length - 1],
        withItem: viablePen,
        reason: `${enemyContext.enemyTankCount} tanques enemigos. Se requiere penetración para infligir daño.`,
        priority: 'recommended'
      });
    }
  }

  return swaps;
}

// --- 8. SOPORTE Y EVOLUCIONES DE ITEM ---
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
  
  // Zeal Spellblade (3869): Enchanters con heals/shields (Lulu, Janna, Nami)
  if (tacticRole === 'peel' || champ.teamProvides?.includes('healing') || champ.teamProvides?.includes('shields') || champ.class === 'Enchanter')
    return { itemId: 3869, reason: "Encantadora con heal/shield — Hoja Zelote maximiza el uptime de protección" };
  
  // Celestial Opposition (3876): Tanques/engage supports (Leona, Nautilus, Thresh)
  if (tacticRole === 'engage' || champ.isFrontline || champ.class === 'Tank')
    return { itemId: 3876, reason: "Support de iniciación — Oposición Celestial aporta resistencias para sobrevivir el engage" };
  
  // Bloodsong (3877): Supports de daño/poke (Brand, Zyra, Vel'Koz)
  if (damageType === 'AP' && (tacticRole === 'poke' || champ.class === 'Mage'))
    return { itemId: 3877, reason: "Support de daño — Canción de Sangre amplifica el burst mágico" };
  
  // Harrowing Crescent → Umbral Glaive (3871): Supports con visión/roam (Pyke, Senna)
  if (tacticRole === 'skirmish' || champ.tags?.includes('Assassin') || champ.class === 'Assassin')
    return { itemId: 3871, reason: "Support de roam — Media Luna maximiza el control de visión y la movilidad" };
  
  // Medallion → Solstice Sleigh (3870): Default enchanter/utility
  return { itemId: 3870, reason: "Evolución estándar de utilidad para supports de control" };
}
