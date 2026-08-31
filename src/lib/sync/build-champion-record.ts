// src/lib/sync/build-champion-record.ts
import { resolveChampionId } from '../domain/champion-name-resolver.js';
import { getStyleOfRune } from '../domain/rune-style-map.js';
import { getPathsForBuild } from '../engine/itemEngine.js';
import { chooseSecondaryPair } from '../engine/rune-validation.js';
import { evidenceScore, isReliableVariant } from '../engine/statisticalScoring.js';
import { CHAMPIONS_DB } from '../data/championdb.js';
import type { championsRepo } from '../db/champions.repo.js';

// --- UTILIDADES DEL SCRAPER Y TRANSFORMACIÓN DE RUNAS/ITEMS ---

export const getBestSummoners = (arr: any[]): [number, number] => {
  if (!arr || arr.length === 0) return [4, 11]; // Flash y Smite o similar
  const valid = arr.filter(i => i.pickrate > 0.3);
  const source = valid.length > 0 ? valid : arr;
  const sorted = [...source].sort((a, b) => evidenceScore(b) - evidenceScore(a));
  return [sorted[0].summonerId1, sorted[0].summonerId2];
};

export const getBestRuneSlot = (arr: any[]): number => {
  if (!arr || arr.length === 0) return 0;
  const valid = arr.filter(i => i.pickrate > 0.1);
  const source = valid.length > 0 ? valid : arr;
  const sorted = [...source].sort((a, b) => evidenceScore(b) - evidenceScore(a));
  return sorted[0].Id;
};

export const getBestSecondaryRunes = (arr: any[], primaryStyleId = 0): [number, number] => {
  if (!arr || arr.length < 2) return [0, 0];
  const validRunes = arr.filter(r => {
    const id = Number(r.Id || r.id);
    const styleId = getStyleOfRune(id);
    return id !== 0 && (!primaryStyleId || styleId !== primaryStyleId);
  });
  
  const groups: Record<number, any[]> = {};
  validRunes.forEach(rune => {
    const styleId = getStyleOfRune(rune.Id);
    if (styleId === 0) return;
    if (!groups[styleId]) groups[styleId] = [];
    groups[styleId].push(rune);
  });

  let bestStyleId = 0;
  let maxStylePower = -1;

  Object.keys(groups).forEach(styleKey => {
    const styleId = Number(styleKey);
    const runesInStyle = groups[styleId];
    const mainRunes = runesInStyle.filter(r => r.pickrate >= 15);
    const stylePower = mainRunes.reduce((acc, r) => acc + evidenceScore(r), 0);

    if (stylePower > maxStylePower && runesInStyle.length >= 2) {
      maxStylePower = stylePower;
      bestStyleId = styleId;
    }
  });

  if (bestStyleId === 0) {
    const fallbackGroups = Object.keys(groups).sort((a, b) => {
      const sumA = groups[Number(a)].reduce((acc, r) => acc + evidenceScore(r), 0);
      const sumB = groups[Number(b)].reduce((acc, r) => acc + evidenceScore(r), 0);
      return sumB - sumA;
    });
    bestStyleId = Number(fallbackGroups[0]);
  }

  if (!groups[bestStyleId] || groups[bestStyleId].length < 2) {
    return [0, 0];
  }

  const pair = chooseSecondaryPair(groups[bestStyleId], evidenceScore);
  return pair
    ? [Number(pair[0].Id || pair[0].id), Number(pair[1].Id || pair[1].id)]
    : [0, 0];
};

export function getBestKeystoneForStyle(primaryRunesList: any[], style: string): number | null {
  if (!primaryRunesList || primaryRunesList.length === 0) return null;

  let preferredTrees: number[] = [];
  if (style === "Tanque") {
    preferredTrees = [8400, 8000];
  } else if (style === "AP On-Hit") {
    preferredTrees = [8000, 8200, 8100, 8300];
  } else if (style.startsWith("AP")) {
    preferredTrees = [8200, 8100, 8300, 8000];
  } else if (style.includes("Lethality") || style.includes("Pen")) {
    preferredTrees = [8100, 8300, 8000];
  } else {
    preferredTrees = [8000, 8100, 8400];
  }

  const sorted = [...primaryRunesList].sort((a, b) => evidenceScore(b) - evidenceScore(a));

  for (const treeId of preferredTrees) {
    const matched = sorted.find(r => getStyleOfRune(r.Id) === treeId);
    if (matched) return matched.Id;
  }

  return sorted[0]?.Id || null;
}

export function getBestRuneForStyleInSlot(arr: any[], styleId: number): number {
  if (!arr || arr.length === 0) return 0;
  const filtered = arr.filter(r => getStyleOfRune(r.Id) === styleId);
  const source = filtered.length > 0 ? filtered : arr;
  const sorted = [...source].sort((a, b) => evidenceScore(b) - evidenceScore(a));
  return sorted[0]?.Id || 0;
}

export function getBestSecondaryRunesForStyle(arr: any[], primaryStyleId: number): { subStyleId: number; selections: [number, number] } {
  if (!arr || arr.length === 0) return { subStyleId: 0, selections: [0, 0] };
  const filtered = arr.filter(r => getStyleOfRune(r.Id) !== primaryStyleId && r.Id !== 0);
  
  const groups: Record<number, any[]> = {};
  filtered.forEach(rune => {
    const styleId = getStyleOfRune(rune.Id);
    if (styleId === 0) return;
    if (!groups[styleId]) groups[styleId] = [];
    groups[styleId].push(rune);
  });

  let bestStyleId = 0;
  let maxStylePower = -1;

  Object.keys(groups).forEach(styleKey => {
    const styleId = Number(styleKey);
    const runesInStyle = groups[styleId];
    const mainRunes = runesInStyle.filter(r => r.pickrate >= 10);
    const stylePower = mainRunes.reduce((acc, r) => acc + evidenceScore(r), 0);

    if (stylePower > maxStylePower && runesInStyle.length >= 2) {
      maxStylePower = stylePower;
      bestStyleId = styleId;
    }
  });

  if (bestStyleId === 0) {
    const fallbackGroups = Object.keys(groups).sort((a, b) => {
      const sumA = groups[Number(a)].reduce((acc, r) => acc + evidenceScore(r), 0);
      const sumB = groups[Number(b)].reduce((acc, r) => acc + evidenceScore(r), 0);
      return sumB - sumA;
    });
    bestStyleId = Number(fallbackGroups[0]);
  }

  if (!groups[bestStyleId] || groups[bestStyleId].length < 2) {
    return { subStyleId: 0, selections: [0, 0] };
  }

  const pair = chooseSecondaryPair(groups[bestStyleId], evidenceScore);
  if (!pair) return { subStyleId: 0, selections: [0, 0] };

  return {
    subStyleId: bestStyleId,
    selections: [
      Number(pair[0].Id || pair[0].id),
      Number(pair[1].Id || pair[1].id)
    ]
  };
}

export const getBestCoreBuild = (coreBuilds: any): number[] => {
  if (!coreBuilds) return [];
  if (coreBuilds.coreItem3 && coreBuilds.coreItem3.length > 0) {
    const candidates = [...coreBuilds.coreItem3];
    const hasSamples = candidates.some((item: any) => Number(item.games || item.count || 0) > 0);
    const reliable = hasSamples ? candidates.filter((item: any) => isReliableVariant(item, 100)) : candidates;
    const source = reliable.length > 0 ? reliable : [];
    if (source.length === 0) return [];
    return source.sort((a: any, b: any) => evidenceScore(b) - evidenceScore(a))[0].itemIds.slice(0, 3);
  }
  if (coreBuilds.coreItem5 && coreBuilds.coreItem5.length > 0) {
    const candidates = [...coreBuilds.coreItem5];
    const hasSamples = candidates.some((item: any) => Number(item.games || item.count || 0) > 0);
    const reliable = hasSamples ? candidates.filter((item: any) => isReliableVariant(item, 100)) : candidates;
    if (reliable.length === 0) return [];
    return reliable.sort((a: any, b: any) => evidenceScore(b) - evidenceScore(a))[0].itemIds.slice(0, 3);
  }
  return [];
};

export const getMostPopularItem = (items: any[], key: string): number => {
  if (!items || items.length === 0) return 0;
  return [...items].sort((a, b) => b.pickrate - a.pickrate)[0][key];
};

export function classifyCoreBuild(itemIds: number[]): { style: string; tags: string[] } {
  const tags: string[] = [];
  const getBaseId = (id: number) => (id >= 220000 && id < 230000) ? id - 220000 : id;

  const cleanIds = itemIds.map(getBaseId);

  // Mapeos de categorías
  const apItems = [3089, 3152, 3115, 3102, 3157, 3165, 6653, 3001, 3003, 3007, 3092, 3100, 3118, 3185, 4629, 3135, 3137, 4633, 2510, 4645];
  const tankItems = [3075, 3110, 3143, 3068, 2504, 6665, 3065, 3083, 6664, 6662, 3193, 3109, 2520];
  const lethalityItems = [6697, 6699, 6696, 3179, 3814, 3142, 6695, 6698, 6693];
  const bruiserItems = [6692, 3071, 6333, 3053, 3156, 3161, 3078, 6610, 6631, 3074, 6609, 3026, 2501];
  const adcItems = [3031, 3046, 3094, 3085, 3091, 3124, 3153, 6672, 3033, 3035, 3036, 4642];

  // Penetraciones / Utilidades para tags
  const armorPenItems = [3071, 6694, 3035, 3036, 4642];
  const magicPenItems = [3135, 3137, 4645];
  const mrItems = [2504, 3065, 6664, 3102, 6665, 3140, 3156];
  const armorItems = [3110, 3143, 3075, 3157, 6333, 3026, 3068, 6662, 6665];
  const sustainItems = [3153, 3072, 3074, 3156, 3083, 4633];

  let apCount = 0;
  let tankCount = 0;
  let lethalityCount = 0;
  let bruiserCount = 0;
  let adcCount = 0;

  let hasArmorPen = false;
  let hasMagicPen = false;
  let hasMR = false;
  let hasArmor = false;
  let hasSustain = false;

  cleanIds.forEach(id => {
    if (apItems.includes(id)) apCount++;
    if (tankItems.includes(id)) tankCount++;
    if (lethalityItems.includes(id)) lethalityCount++;
    if (bruiserItems.includes(id)) bruiserCount++;
    if (adcItems.includes(id)) adcCount++;

    if (armorPenItems.includes(id) || id === 6694) hasArmorPen = true;
    if (magicPenItems.includes(id)) hasMagicPen = true;
    if (mrItems.includes(id)) hasMR = true;
    if (armorItems.includes(id)) hasArmor = true;
    if (sustainItems.includes(id)) hasSustain = true;
  });

  if (hasArmorPen || hasMagicPen) {
    tags.push("anti-tank");
    tags.push("vs_tank");
  } else {
    tags.push("vs_squishy");
  }
  if (hasMR) tags.push("anti-AP");
  if (hasArmor) tags.push("anti-AD");
  if (hasSustain) tags.push("sustain");

  let style = "General";
  const max = Math.max(apCount, tankCount, lethalityCount, bruiserCount, adcCount);

  if (max === 0) {
    style = "General";
  } else if (apCount === max) {
    if (adcCount > 0 || cleanIds.includes(3115)) {
      style = "AP On-Hit";
      tags.push("ap", "on-hit");
    } else {
      style = "AP";
      tags.push("ap");
    }
    if (tankCount > 0) tags.push("tank");
  } else if (tankCount === max) {
    style = "Tanque";
    tags.push("tank");
    if (apCount > 0) tags.push("ap");
    if (bruiserCount > 0) tags.push("bruiser");
  } else if (lethalityCount === max) {
    style = "Lethality";
    tags.push("lethality");
    if (hasArmorPen) {
      style = "Lethality/Pen";
    }
    if (bruiserCount > 0) tags.push("bruiser");
  } else if (bruiserCount === max) {
    style = "AD/Bruiser";
    tags.push("bruiser");
    if (lethalityCount > 0) tags.push("lethality");
    if (tankCount > 0) tags.push("tank");
  } else if (adcCount === max) {
    style = "On-Hit";
    tags.push("on-hit");
  } else {
    if (lethalityCount > 0) {
      style = "Lethality";
      tags.push("lethality");
    } else if (bruiserCount > 0) {
      style = "AD/Bruiser";
      tags.push("bruiser");
    } else {
      style = "General";
    }
  }

  return { style, tags };
}

export interface BuildChampionRecordContext {
  nameIdMap: Record<string, number>;
  damageType?: string;
  currentChampion?: any;
  version: string;
}

export function buildChampionRecord(
  rawData: any,
  champId: number,
  lane: string,
  context: BuildChampionRecordContext
): {
  championUpdate: Parameters<typeof championsRepo.saveChampion>[0];
  matchups: Parameters<typeof championsRepo.saveMatchup>[0][];
  synergies: Parameters<typeof championsRepo.saveSynergy>[0][];
  defaultBuild: Parameters<typeof championsRepo.saveBuild>[0];
  candidateBuilds: Parameters<typeof championsRepo.saveBuild>[0][];
  cDataSnapshot: {
    godMatchups: any[];
    counters: any[];
    synergies: any;
    combat: any;
    scalingType?: string;
    buildData: any;
  };
} {
  const { nameIdMap, currentChampion: current, version } = context;
  const laneUpper = lane.toUpperCase();
  const laneLower = lane.toLowerCase();
  const sourceLane = laneUpper === 'UTILITY' ? 'utility' : laneLower;
  const dataPatch = rawData.sourceMetadata?.patch || version;
  const isLolalytics = rawData.sourceMetadata?.source === 'lolalytics';

  // 1. Extraer God Matchups para este carril
  const laneGodMatchups = (rawData.enemyMatchups?.[laneUpper] || rawData.enemyMatchups?.[laneLower] || rawData.enemyMatchups?.[sourceLane] || [])
    .filter((m: any) => m.count > 160 && (isLolalytics ? Number(m.delta1 || 0) >= 0 : true))
    .map((m: any) => {
      const goldValue = m.goldDiffAt15 || 0;
      const xpValue = m.xpDiffAt15 || 0;
      const winrateValue = m.winrate || 0.50;
      const countValue = m.count || 0;
      const isGoodLane = isLolalytics ? Number(m.delta1 || 0) >= 0 : (goldValue + xpValue) > 200;
      const laneTag = isGoodLane ? "Good Lane" : "Bad Lane";
      const K = 120; 
      const bayesianWinrate = ((winrateValue * countValue) + (0.50 * K)) / (countValue + K);
      const deltaScore = isLolalytics ? Number(m.delta1 || 0) : (bayesianWinrate - 0.50) * 100;

      return {
        name: m.championName,
        winrate: (winrateValue * 100).toFixed(1) + "%",
        goldDiff: goldValue.toFixed(0),
        xpDiff: xpValue.toFixed(0),
        csDiff: (m.csDiffAt15 || 0).toFixed(1),
        count: countValue,
        laneTag: laneTag,
        dominanceScore: parseFloat(deltaScore.toFixed(1))
      };
    })
    .sort((a: any, b: any) => b.dominanceScore - a.dominanceScore)
    .slice(0, 15);

  // 2. Extraer Counters para este carril
  const laneCounters = (rawData.enemyMatchups?.[laneUpper] || rawData.enemyMatchups?.[laneLower] || rawData.enemyMatchups?.[sourceLane] || [])
    .filter((m: any) => m.count > 160 && (isLolalytics ? Number(m.delta1 || 0) < 0 : true))
    .map((m: any) => {
      const goldValue = m.goldDiffAt15 || 0;
      const xpValue = m.xpDiffAt15 || 0;
      const winrateValue = m.winrate || 0.50;
      const countValue = m.count || 0;
      const isGoodLane = isLolalytics ? Number(m.delta1 || 0) >= 0 : (goldValue + xpValue) > 200;
      const laneTag = isGoodLane ? "Good Lane" : "Bad Lane";
      const K = 100;
      const bayesianWinrate = ((winrateValue * countValue) + (0.50 * K)) / (countValue + K);
      const deltaScore = isLolalytics ? Number(m.delta1 || 0) : (bayesianWinrate - 0.50) * 100;

      return {
        name: m.championName,
        winrate: (winrateValue * 100).toFixed(1) + "%",
        goldDiff: goldValue.toFixed(0),
        xpDiff: xpValue.toFixed(0),
        csDiff: (m.csDiffAt15 || 0).toFixed(1),
        count: countValue,
        laneTag: laneTag,
        dominanceScore: parseFloat(deltaScore.toFixed(1))
      };
    })
    .filter((m: any) => m.dominanceScore < 1.0)
    .sort((a: any, b: any) => a.dominanceScore - b.dominanceScore)
    .slice(0, 10);

  // 3. Extraer Ally Matchups (Sinergias)
  const synergies: Record<string, any[]> = {};
  if (rawData.allyMatchups) {
    for (const pos in rawData.allyMatchups) {
      synergies[pos] = (rawData.allyMatchups[pos] || [])
        .filter((a: any) => a.count > 100)
        .map((a: any) => {
          const rawDelta = Number.isFinite(Number(a.delta)) ? Number(a.delta) : Number(a.delta1 || 0) / 100;
          const countValue = a.count || 0;
          const bayesianFactor = countValue / (countValue + 80);
          const smoothedDelta = rawDelta * bayesianFactor;

          return {
            name: a.championName,
            count: countValue,
            delta: parseFloat((smoothedDelta * 100).toFixed(2))
          };
        })
        .filter((a: any) => a.delta > 0)
        .sort((a: any, b: any) => b.delta - a.delta)
        .slice(0, 5);
    }
  }

  // 4. ADN de Combate y Escalado
  const combat: any = {};
  let scalingType = "Mid";
  if (rawData.damageComposition) {
    combat.damageComposition = {
      physical: Math.round(rawData.damageComposition.physical || 0),
      magic: Math.round(rawData.damageComposition.magic || 0),
      true: Math.round(rawData.damageComposition.true || 0)
    };
  }
  if (rawData.winrateByGameTime && rawData.winrateByGameTime.length > 0) {
    combat.winrateCurve = rawData.winrateByGameTime;
    const earlyWR = rawData.winrateByGameTime[0]?.value || 50;
    const lateWR = rawData.winrateByGameTime[rawData.winrateByGameTime.length - 1]?.value || 50;
    scalingType = lateWR > earlyWR + 1.5 ? "Late" : (earlyWR > lateWR + 1.5 ? "Early" : "Mid");
  }

  // 5. Extraer Build por Defecto
  const r = rawData.runes;
  const bestKeystone = getBestRuneSlot(r.primaryRuneId);
  const primaryStyleId = getStyleOfRune(bestKeystone);
  const secondaryRunes = getBestSecondaryRunes(r.secondaryRuneId, primaryStyleId);
  const subStyleId = getStyleOfRune(secondaryRunes[0]);
  const sourcePage = Array.isArray(r.pages)
    ? r.pages.find((page: any) => Array.isArray(page.selections) && page.selections.length >= 6)
    : null;
  const persistedRuneSelections = sourcePage?.selections?.slice(0, 6) || [
    bestKeystone,
    getBestRuneForStyleInSlot(r.primaryRuneId2, primaryStyleId) || getBestRuneSlot(r.primaryRuneId2),
    getBestRuneForStyleInSlot(r.primaryRuneId3, primaryStyleId) || getBestRuneSlot(r.primaryRuneId3),
    getBestRuneForStyleInSlot(r.primaryRuneId4, primaryStyleId) || getBestRuneSlot(r.primaryRuneId4),
    ...secondaryRunes
  ];
  const persistedPrimaryStyleId = sourcePage?.primaryStyleId || primaryStyleId;
  const persistedSubStyleId = sourcePage?.subStyleId || subStyleId;
  const bestStarter = rawData.startItems?.sort((a: any, b: any) => b.pickrate - a.pickrate)[0]?.startItems || [];   
  const bestBootsId = getMostPopularItem(rawData.boots, 'itemId') || 3047;
  const bestCoreItems = getBestCoreBuild(rawData.coreBuilds);
  const bestSummoners = getBestSummoners(rawData.summoners);
  const damageType = context.damageType || CHAMPIONS_DB[champId]?.damageType || "AD";
  const defaultPaths = getPathsForBuild(
    rawData.items || {},
    bestCoreItems,
    damageType,
    bestBootsId
  );

  const laneBuildData = {
    patch: dataPatch,
    lastUpdate: new Date().toISOString(),
    summoners: bestSummoners,
    runes: {
      primaryStyleId: persistedPrimaryStyleId,
      subStyleId: persistedSubStyleId,
      selections: persistedRuneSelections,
      shards: sourcePage?.shards || [
        getBestRuneSlot(r.perksStat1),
        getBestRuneSlot(r.perksStat2),
        getBestRuneSlot(r.perksStat3)
      ]
    },
    items: {
      starter: bestStarter,
      boots: { id: bestBootsId },
      core: bestCoreItems,
      paths: defaultPaths,
      slotItems: rawData.items
    },
    skills: (() => {
      const skillCandidates = Array.isArray(rawData.skillLevelUp) ? rawData.skillLevelUp : [];
      const hasSamples = skillCandidates.some((skill: any) => Number(skill.games || skill.count || 0) > 0);
      const reliableSkills = hasSamples ? skillCandidates.filter((skill: any) => isReliableVariant(skill, 100)) : skillCandidates;
      return [...(reliableSkills.length > 0 ? reliableSkills : skillCandidates)].sort((a: any, b: any) => evidenceScore(b) - evidenceScore(a))[0] || null;
    })(),
    statsData: {
      sourceMetadata: rawData.sourceMetadata || { source: 'lolalytics' },
      coreBuilds: rawData.coreBuilds,
      items: rawData.items,
      boots: rawData.boots,
      runes: rawData.runes,
      summoners: rawData.summoners,
      startItems: rawData.startItems,
      header: rawData.header,
      history: rawData.history,
      winrateByGameTime: rawData.winrateByGameTime,
      gameLengthDistribution: rawData.gameLengthDistribution,
      enemyMatchups: rawData.enemyMatchups,
      allyMatchups: rawData.allyMatchups,
      skillPriority: rawData.skillPriority,
      skillOrders: rawData.skillOrders
    }
  };

  // Armar objeto championUpdate
  const baseChamp = CHAMPIONS_DB[champId];
  const championUpdate: Parameters<typeof championsRepo.saveChampion>[0] = {
    id: champId,
    name: baseChamp?.name || current?.name || "Unknown",
    lane: current?.lane || lane,
    tier: current?.tier || 5,
    win_rate: current?.win_rate || 50.0,
    scaling_type: baseChamp?.scalingType || current?.scaling_type || scalingType || "Mid",
    damage_type: baseChamp?.damageType || current?.damage_type || damageType || "Adaptive",
    class: baseChamp?.class || current?.class || "Unknown",
    is_frontline: baseChamp?.isFrontline !== undefined ? (baseChamp.isFrontline ? 1 : 0) : (current?.is_frontline ? 1 : 0),
    is_hypercarry: baseChamp?.isHypercarry !== undefined ? (baseChamp.isHypercarry ? 1 : 0) : (current?.is_hypercarry ? 1 : 0),
    has_hard_cc: baseChamp?.hasHardCC !== undefined ? (baseChamp.hasHardCC ? 1 : 0) : (current?.has_hard_cc ? 1 : 0),
    tags: JSON.stringify(baseChamp?.tags || JSON.parse(current?.tags || '[]')),
    tactic_role: baseChamp?.tacticRole || current?.tactic_role,
    mobility: baseChamp?.mobility || current?.mobility,
    target_priority: baseChamp?.targetPriority || current?.target_priority,
    team_needs: JSON.stringify(baseChamp?.teamNeeds || JSON.parse(current?.team_needs || '[]')),
    team_provides: JSON.stringify(baseChamp?.teamProvides || JSON.parse(current?.team_provides || '[]')),
    has_shield: baseChamp?.hasShield !== undefined ? (baseChamp.hasShield ? 1 : 0) : current?.has_shield,
    has_sustain: baseChamp?.hasSustain !== undefined ? (baseChamp.hasSustain ? 1 : 0) : current?.has_sustain,
    lane_phase: baseChamp?.lanePhase || current?.lane_phase,
    resource_dependency: baseChamp?.resourceDependency || current?.resource_dependency,
    play_lanes: current?.play_lanes || "[]",
    lanes_pickrate: current?.lanes_pickrate || "{}",
    lanes_stats: current?.lanes_stats || "{}"
  };

  // Armar lista de matchups
  const matchups: Parameters<typeof championsRepo.saveMatchup>[0][] = [];

  laneCounters.forEach((cnt: any) => {
    const opponentId = resolveChampionId(cnt.name, nameIdMap);
    if (opponentId) {
      matchups.push({
        champion_id: champId,
        opponent_id: opponentId,
        lane: lane,
        winrate: cnt.winrate,
        gold_diff: parseInt(cnt.goldDiff || 0),
        xp_diff: parseInt(cnt.xpDiff || 0),
        cs_diff: parseFloat(cnt.csDiff || 0.0),
        dominance_score: parseFloat(cnt.dominanceScore || 0.0),
        matchup_type: 'counter'
      });
    }
  });

  laneGodMatchups.forEach((god: any) => {
    const opponentId = resolveChampionId(god.name, nameIdMap);
    if (opponentId) {
      matchups.push({
        champion_id: champId,
        opponent_id: opponentId,
        lane: lane,
        winrate: god.winrate,
        gold_diff: parseInt(god.goldDiff || 0),
        xp_diff: parseInt(god.xpDiff || 0),
        cs_diff: parseFloat(god.csDiff || 0.0),
        dominance_score: parseFloat(god.dominanceScore || 0.0),
        matchup_type: 'god_matchup'
      });
    }
  });

  // Armar lista de sinergias
  const synergiesList: Parameters<typeof championsRepo.saveSynergy>[0][] = [];
  Object.keys(synergies).forEach(roleKey => {
    const partnerList = synergies[roleKey] || [];
    partnerList.forEach((syn: any) => {
      const partnerId = resolveChampionId(syn.name, nameIdMap);
      if (partnerId) {
        synergiesList.push({
          champion_id: champId,
          partner_id: partnerId,
          lane: roleKey.toUpperCase(),
          delta: parseFloat(syn.delta || 0.0)
        });
      }
    });
  });

  // Build por defecto
  const defaultBuild: Parameters<typeof championsRepo.saveBuild>[0] = {
    champion_id: champId,
    build_name: "Recomendada",
    is_default: 1,
    patch: dataPatch,
    summoners: JSON.stringify(laneBuildData.summoners || []),
    runes: JSON.stringify(laneBuildData.runes || {}),
    items: JSON.stringify(laneBuildData.items || {}),
    skills: JSON.stringify(laneBuildData.skills || {}),
    tags: JSON.stringify(["Default", lane]),
    special_notes: JSON.stringify({ 
      last_update: new Date().toISOString(),
      winrate: laneBuildData.skills?.winrate || 50.0,
      pickrate: laneBuildData.skills?.pickrate || 100.0,
      style: "Default",
      statsData: laneBuildData.statsData
    }),
    lane: lane
  };

  // Builds candidatas
  const candidateBuilds: Parameters<typeof championsRepo.saveBuild>[0][] = [];
  let coreSource = rawData.coreBuilds?.coreItem3 || [];
  if (coreSource.length === 0 && rawData.coreBuilds?.coreItem5) {
    coreSource = rawData.coreBuilds.coreItem5;
  }
  
  const hasCandidateSamples = coreSource.some((candidate: any) => Number(candidate.games || candidate.count || 0) > 0);
  const reliableCandidates = hasCandidateSamples
    ? coreSource.filter((candidate: any) => isReliableVariant(candidate, 100))
    : coreSource;
  const sortedCandidates = [...reliableCandidates].sort((a: any, b: any) => evidenceScore(b) - evidenceScore(a));
  const minPickrate = 0.7;

  const seenItemSignatures = new Set<string>();
  const seenTagSignatures = new Set<string>();
  const uniqueCandidates: any[] = [];

  for (const cand of sortedCandidates) {
    if (cand.pickrate < minPickrate) continue;
    if (!cand.itemIds || cand.itemIds.length < 3) continue;

    const itemIds3 = cand.itemIds.slice(0, 3);
    const itemSig = [...itemIds3].sort().join(',');
    if (seenItemSignatures.has(itemSig)) continue;

    const { style, tags } = classifyCoreBuild(itemIds3);
    const signature = [...tags].sort().join(',');

    if (!seenTagSignatures.has(signature)) {
      seenItemSignatures.add(itemSig);
      seenTagSignatures.add(signature);
      uniqueCandidates.push({ 
        cand: { ...cand, itemIds: itemIds3 }, 
        style, 
        tags 
      });
    }
    if (uniqueCandidates.length >= 4) {
      break;
    }
  }

  let candidateIdx = 1;
  uniqueCandidates.forEach(({ cand, style, tags }) => {
    const candKeystone = getBestKeystoneForStyle(r.primaryRuneId, style) || bestKeystone;
    const candPrimaryStyleId = getStyleOfRune(candKeystone);
    
    let candRunes = { ...laneBuildData.runes };
    
    if (candPrimaryStyleId !== 0) {
      const rune2 = getBestRuneForStyleInSlot(r.primaryRuneId2, candPrimaryStyleId);
      const rune3 = getBestRuneForStyleInSlot(r.primaryRuneId3, candPrimaryStyleId);
      const rune4 = getBestRuneForStyleInSlot(r.primaryRuneId4, candPrimaryStyleId);
      const sec = getBestSecondaryRunesForStyle(r.secondaryRuneId, candPrimaryStyleId);
      
      candRunes = {
        primaryStyleId: candPrimaryStyleId,
        subStyleId: sec.subStyleId || subStyleId,
        selections: [
          candKeystone,
          rune2 || getBestRuneSlot(r.primaryRuneId2),
          rune3 || getBestRuneSlot(r.primaryRuneId3),
          rune4 || getBestRuneSlot(r.primaryRuneId4),
          ...sec.selections
        ],
        shards: laneBuildData.runes.shards || []
      };
    }

    const candPaths = getPathsForBuild(
      rawData.items || {},
      cand.itemIds,
      damageType,
      bestBootsId || 3047
    );

    candidateBuilds.push({
      champion_id: champId,
      build_name: `Core ${style} #${candidateIdx}`,
      is_default: 0,
      patch: dataPatch,
      summoners: JSON.stringify(laneBuildData.summoners || []),
      runes: JSON.stringify(candRunes),
      items: JSON.stringify({
        starter: laneBuildData.items.starter,
        boots: laneBuildData.items.boots,
        core: cand.itemIds,
        paths: candPaths,
        slotItems: rawData.items
      }),
      skills: JSON.stringify(laneBuildData.skills || {}),
      tags: JSON.stringify(tags),
      special_notes: JSON.stringify({
        last_update: new Date().toISOString(),
        winrate: cand.winrate,
        pickrate: cand.pickrate,
        style: style
      }),
      lane: lane
    });

    candidateIdx++;
  });

  return {
    championUpdate,
    matchups,
    synergies: synergiesList,
    defaultBuild,
    candidateBuilds,
    cDataSnapshot: {
      godMatchups: laneGodMatchups,
      counters: laneCounters,
      synergies,
      combat,
      scalingType,
      buildData: laneBuildData
    }
  };
}
