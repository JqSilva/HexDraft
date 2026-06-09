// src/lib/engine/itemEngine.ts
import { ENRICHED_DB, normalizeKey } from './dataProvider';
import { NAME_TO_ID } from './constants';
import { hydrateAsset } from './hydrator';

// Definición de grupos de items para scoring y adaptación
export const ITEM_CATEGORIES = {
  ARMOR_PEN: [3035, 3036, 3071, 6694, 3153, 6692, 3033, 223035, 223036, 223071, 226692, 226694, 223153, 223033],
  MAGIC_PEN: [3135, 6653, 3001, 3165, 3137, 223135, 226653, 223165, 223137],
  GRIEVOUS_WOUNDS: [3033, 3165, 3075, 3181, 3011, 8020, 3123, 223033, 223165, 223075, 323075],
  MAGIC_RESIST: [3156, 2504, 3065, 4401, 3001, 3102, 3140, 3111, 223156, 222504, 223065, 224401, 223111],
  ARMOR: [3110, 3047, 3143, 3075, 3026, 6333, 3053, 6662, 3157, 223110, 223047, 223143, 223075, 223026, 223157, 223053, 226662, 323075, 323110],
  TENACITY: [3111, 3140, 223111]
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

  if (ITEM_CATEGORIES.MAGIC_RESIST.includes(baseId) || ITEM_CATEGORIES.ARMOR.includes(baseId)) {
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
    return getFallbackStaticBuild(champ);
  }

  // --- ANALIZAR COMPOSICIÓN ENEMIGA ---
  let enemyADCount = 0;
  let enemyAPCount = 0;
  let enemyTankCount = 0;
  let enemyCCCount = 0;
  let enemyHealerCount = 0;

  theirTeamIds.forEach(id => {
    const enemyName = getNameFromId(id);
    if (!enemyName) return;
    const enemy = ENRICHED_DB[enemyName];
    if (!enemy) return;

    if (enemy.damageType === 'AD') enemyADCount++;
    if (enemy.damageType === 'AP') enemyAPCount++;
    if (enemy.tags?.includes('Tank') || enemy.class === 'Tank' || enemy.isFrontline) enemyTankCount++;
    if (enemy.hasHardCC) enemyCCCount++;

    const normEnemyName = enemyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (HEAVY_HEALERS.has(normEnemyName)) {
      enemyHealerCount++;
    }
  });

  const damageType = champ.damageType || 'AD';

  // --- 1. SELECCIÓN DEL CORE BUILD (SCORING) ---
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

    // Ajustes por Tanques enemigos
    if (enemyTankCount >= 1) {
      if (tags.includes("anti-tank") || (damageType === 'AD' && hasArmorPen) || (damageType === 'AP' && hasMagicPen)) {
        score += 15.0 * enemyTankCount;
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
  const defaultBootId = typeof bestBuild.items?.boots === 'object'
    ? (bestBuild.items.boots.id || bestBuild.items.boots.itemId)
    : (Number(bestBuild.items?.boots) || 3047);

  // --- 2. SELECCIÓN DE BOTAS ADAPTATIVA ---
  let adaptedBootId = defaultBootId;
  // Si hay mucho CC y daño mágico, o más de 3 AP
  if (enemyCCCount >= 2 || enemyAPCount >= 3) {
    adaptedBootId = 3111; // Mercurio
  } else if (enemyADCount >= 3) {
    adaptedBootId = 3047; // Placas de Acero
  }

  // --- 3. SELECCIÓN/GENERACIÓN DE LAS 3 RAMAS DE CONTINUACIÓN ---
  let finalSnowball: number[] = [];
  let finalNeutral: number[] = [];
  let finalBehind: number[] = [];

  const enemyContext = {
    enemyADCount,
    enemyAPCount,
    enemyTankCount,
    enemyCCCount,
    enemyHealerCount
  };

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
function getFallbackStaticBuild(champ: any): any {
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

  return {
    name: champ.name,
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
