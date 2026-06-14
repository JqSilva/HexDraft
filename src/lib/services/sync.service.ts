// src/lib/services/sync.service.ts
import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import assetsMap from '../data/assets-map.json' with { type: 'json' };
import { db as dbInstance } from '../db/sqlite.js';
import { championsRepo } from '../db/champions.repo.js';
import { configRepo } from '../db/config.repo.js';
import { CHAMPIONS_DB } from '../data/championdb.js';
import { getPathsForBuild } from '../engine/itemEngine.js';
import { syncItemsFromCommunityDragon } from '../scripts/sync-items.js';
import { syncChampionsSemanticData } from '../scripts/sync-champions-cdrag.js';

const API_NAME_MAP: Record<string, string> = {
  "Wukong": "MonkeyKing",
  "Maestro Yi": "MasterYi",
  "Nunu y Willump": "Nunu",
  "Renata Glasc": "Renata",
  "Bardo": "Bard"
};

const NORM_API_NAME_MAP: Record<string, string> = {
  "monkeyking": "wukong",
  "masteryi": "maestroyi",
  "nunu": "nunuywillump",
  "renata": "renataglasc",
  "bard": "bardo"
};

const normalizeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

function resolveChampionId(name: string, nameIdMap: Record<string, number>): number | null {
  const norm = normalizeKey(name);
  if (nameIdMap[norm]) return nameIdMap[norm];
  
  const alias = NORM_API_NAME_MAP[norm];
  if (alias && nameIdMap[alias]) return nameIdMap[alias];

  for (const [key, id] of Object.entries(nameIdMap)) {
    if (key.includes(norm) || norm.includes(key)) {
      return id;
    }
  }

  return null;
}

// --- UTILIDADES DEL SCRAPER ---
const getBestSummoners = (arr: any[]) => {
  if (!arr || arr.length === 0) return [4, 11]; // Flash y Smite o similar
  const valid = arr.filter(i => i.pickrate > 0.3);
  const source = valid.length > 0 ? valid : arr;
  const sorted = [...source].sort((a, b) => b.pickrate - a.pickrate);
  return [sorted[0].summonerId1, sorted[0].summonerId2];
};

function getStyleOfRune(runeId: number) {
  return assetsMap.runeToStyle[runeId] || 0;
}

const getBestRuneSlot = (arr: any[]) => {
  if (!arr || arr.length === 0) return 0;
  const valid = arr.filter(i => i.pickrate > 0.1);
  const source = valid.length > 0 ? valid : arr;
  const sorted = [...source].sort((a, b) => b.pickrate - a.pickrate);
  return sorted[0].Id;
};

const getBestSecondaryRunes = (arr: any[]) => {
  if (!arr || arr.length < 2) return [0, 0];
  const validRunes = arr.filter(r => r.winrate > 0 && r.pickrate > 0);
  if (validRunes.length < 2) return [0, 0];

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
    const stylePower = mainRunes.reduce((acc, r) => acc + (r.winrate + r.pickrate), 0);

    if (stylePower > maxStylePower && runesInStyle.length >= 2) {
      maxStylePower = stylePower;
      bestStyleId = styleId;
    }
  });

  if (bestStyleId === 0) {
    const fallbackGroups = Object.keys(groups).sort((a, b) => {
      const sumA = groups[Number(a)].reduce((acc, r) => acc + r.pickrate, 0);
      const sumB = groups[Number(b)].reduce((acc, r) => acc + r.pickrate, 0);
      return sumB - sumA;
    });
    bestStyleId = Number(fallbackGroups[0]);
  }

  const finalRunes = groups[bestStyleId].sort((a, b) => 
    (b.winrate + b.pickrate) - (a.winrate + a.pickrate)
  );

  return [finalRunes[0].Id, finalRunes[1].Id];
};

function getBestKeystoneForStyle(primaryRunesList: any[], style: string): number | null {
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

  const sorted = [...primaryRunesList].sort((a, b) => b.pickrate - a.pickrate);

  for (const treeId of preferredTrees) {
    const matched = sorted.find(r => getStyleOfRune(r.Id) === treeId);
    if (matched) return matched.Id;
  }

  return sorted[0]?.Id || null;
}

function getBestRuneForStyleInSlot(arr: any[], styleId: number): number {
  if (!arr || arr.length === 0) return 0;
  const filtered = arr.filter(r => getStyleOfRune(r.Id) === styleId);
  const source = filtered.length > 0 ? filtered : arr;
  const sorted = [...source].sort((a, b) => b.pickrate - a.pickrate);
  return sorted[0]?.Id || 0;
}

function getBestSecondaryRunesForStyle(arr: any[], primaryStyleId: number) {
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
    const stylePower = mainRunes.reduce((acc, r) => acc + (r.winrate + r.pickrate), 0);

    if (stylePower > maxStylePower && runesInStyle.length >= 2) {
      maxStylePower = stylePower;
      bestStyleId = styleId;
    }
  });

  if (bestStyleId === 0) {
    const fallbackGroups = Object.keys(groups).sort((a, b) => {
      const sumA = groups[Number(a)].reduce((acc, r) => acc + r.pickrate, 0);
      const sumB = groups[Number(b)].reduce((acc, r) => acc + r.pickrate, 0);
      return sumB - sumA;
    });
    bestStyleId = Number(fallbackGroups[0]);
  }

  if (!groups[bestStyleId] || groups[bestStyleId].length < 2) {
    return { subStyleId: 0, selections: [0, 0] };
  }

  const finalRunes = groups[bestStyleId].sort((a, b) => 
    (b.winrate + b.pickrate) - (a.winrate + a.pickrate)
  );

  return {
    subStyleId: bestStyleId,
    selections: [finalRunes[0].Id, finalRunes[1].Id]
  };
}

const getBestCoreBuild = (coreBuilds: any) => {
  if (!coreBuilds) return [];
  if (coreBuilds.coreItem3 && coreBuilds.coreItem3.length > 0) {
    return [...coreBuilds.coreItem3].sort((a: any, b: any) => b.pickrate - a.pickrate)[0].itemIds.slice(0, 3);
  }
  if (coreBuilds.coreItem5 && coreBuilds.coreItem5.length > 0) {
    return [...coreBuilds.coreItem5].sort((a: any, b: any) => b.pickrate - a.pickrate)[0].itemIds.slice(0, 3);
  }
  return [];
};

const getMostPopularItem = (items: any[], key: string) => {
  if (!items || items.length === 0) return 0;
  return [...items].sort((a, b) => b.pickrate - a.pickrate)[0][key];
};

function classifyCoreBuild(itemIds: number[]): { style: string; tags: string[] } {
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

// --- COMPROBAR SI LA BUILD ESTÁ AL DÍA ---
function isChampionBuildUpToDate(champId: number, version: string, syncPeriodDays: number): boolean {
  try {
    const stmt = dbInstance.prepare('SELECT patch, special_notes FROM builds WHERE champion_id = ? AND is_default = 1 LIMIT 1');
    const row = stmt.get(champId) as { patch: string; special_notes: string } | undefined;
    if (!row) return false;
    
    // 1. Verificar parche
    if (row.patch !== version) return false;

    // 2. Verificar antigüedad de la build
    const notes = JSON.parse(row.special_notes || '{}');
    if (!notes.last_update) return false;

    const lastDate = new Date(notes.last_update);
    if (isNaN(lastDate.getTime())) return false;

    const diffMs = Date.now() - lastDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays < syncPeriodDays;
  } catch (e) {
    return false;
  }
}

// --- SCRAPEO INDIVIDUAL ---
async function scrapeSingleChampion(
  page: any,
  name: string,
  version: string,
  dbMemory: any,
  nameIdMap: Record<string, number>,
  writeLog: (msg: string) => void
) {
  const lane = dbMemory[name]?.lane || "UNKNOWN";
  const internalName = API_NAME_MAP[name] || name;
  const urlName = internalName.replace(/\s/g, "");

  const url = `https://dpm.lol/v1/builds/${urlName}?lane=${lane.toLowerCase()}&tier=emerald_plus&timeframe=${version}&gameMode=ranked`;
  
  await page.goto(url, { waitUntil: 'networkidle2' });
  const data = JSON.parse(await page.evaluate(() => document.body.innerText));

  const cData = dbMemory[name] || {};

  // 1. Extraer God Matchups
  cData.godMatchups = (data.enemyMatchups?.[lane] || [])
    .filter((m: any) => m.count > 160)
    .map((m: any) => {
      const goldValue = m.goldDiffAt15 || 0;
      const xpValue = m.xpDiffAt15 || 0;
      const winrateValue = m.winrate || 0.50;
      const countValue = m.count || 0;
      const isGoodLane = (goldValue + xpValue) > 200;
      const laneTag = isGoodLane ? "Good Lane" : "Bad Lane";
      const K = 120; 
      const bayesianWinrate = ((winrateValue * countValue) + (0.50 * K)) / (countValue + K);
      const deltaScore = (bayesianWinrate - 0.50) * 100;

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

  // 2. Extraer Counters
  cData.counters = (data.enemyMatchups?.[lane] || [])
    .filter((m: any) => m.count > 160)
    .map((m: any) => {
      const goldValue = m.goldDiffAt15 || 0;
      const xpValue = m.xpDiffAt15 || 0;
      const winrateValue = m.winrate || 0.50;
      const countValue = m.count || 0;
      const isGoodLane = (goldValue + xpValue) > 200;
      const laneTag = isGoodLane ? "Good Lane" : "Bad Lane";
      const K = 100;
      const bayesianWinrate = ((winrateValue * countValue) + (0.50 * K)) / (countValue + K);
      const deltaScore = (bayesianWinrate - 0.50) * 100;

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
  if (data.allyMatchups) {
    const synergies: any = {};
    for (const pos in data.allyMatchups) {
      synergies[pos] = (data.allyMatchups[pos] || [])
        .filter((a: any) => a.count > 100)
        .map((a: any) => {
          const rawDelta = a.delta || 0;
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
    cData.synergies = synergies;
  }

  // 4. Extraer ADN de Combate y Escalado
  cData.combat = cData.combat || {};
  if (data.damageComposition) {
    cData.combat.damageComposition = {
      physical: Math.round(data.damageComposition.physical || 0),
      magic: Math.round(data.damageComposition.magic || 0),
      true: Math.round(data.damageComposition.true || 0)
    };
  }
  if (data.winrateByGameTime && data.winrateByGameTime.length > 0) {
    cData.combat.winrateCurve = data.winrateByGameTime;
    const earlyWR = data.winrateByGameTime[0]?.value || 50;
    const lateWR = data.winrateByGameTime[data.winrateByGameTime.length - 1]?.value || 50;
    cData.scalingType = lateWR > earlyWR + 1.5 ? "Late" : (earlyWR > lateWR + 1.5 ? "Early" : "Mid");
  }

  // 5. Extraer Build
  const r = data.runes;
  const bestKeystone = getBestRuneSlot(r.primaryRuneId);
  const secondaryRunes = getBestSecondaryRunes(r.secondaryRuneId);
  const primaryStyleId = getStyleOfRune(bestKeystone);
  const subStyleId = getStyleOfRune(secondaryRunes[0]);
  const bestStarter = data.startItems?.sort((a: any, b: any) => b.pickrate - a.pickrate)[0]?.startItems || [];   
  const bestBootsId = getMostPopularItem(data.boots, 'itemId') || 3047;
  const bestCoreItems = getBestCoreBuild(data.coreBuilds);
  const bestSummoners = getBestSummoners(data.summoners);

  const champId = nameIdMap[normalizeKey(name)];
  const damageType = champId ? (CHAMPIONS_DB[champId]?.damageType || "AD") : "AD";
  const defaultPaths = getPathsForBuild(
    data.items || {},
    bestCoreItems,
    damageType,
    bestBootsId
  );

  cData.buildData = {
    patch: version,
    lastUpdate: new Date().toISOString(),
    summoners: bestSummoners,
    runes: {
      primaryStyleId: primaryStyleId,
      subStyleId: subStyleId,
      selections: [
        bestKeystone,
        getBestRuneSlot(r.primaryRuneId2),
        getBestRuneSlot(r.primaryRuneId3),
        getBestRuneSlot(r.primaryRuneId4),
        ...secondaryRunes
      ],
      shards: [
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
      slotItems: data.items
    },
    skills: data.skillLevelUp?.sort((a:any, b:any) => b.winrate - a.winrate)[0] || null
  };

  // Guardar en SQLite en tiempo real
  if (champId) {
    const currentChampStmt = dbInstance.prepare('SELECT tier, win_rate FROM champions WHERE id = ?');
    const current = currentChampStmt.get(champId) as any;

    championsRepo.saveChampion({
      id: champId,
      name: name,
      lane: cData.lane || "UNKNOWN",
      tier: current?.tier || 5,
      win_rate: current?.win_rate || 50.0,
      scaling_type: cData.scalingType || "Mid",
      damage_type: CHAMPIONS_DB[champId]?.damageType || "Adaptive",
      class: CHAMPIONS_DB[champId]?.class || "Unknown",
      is_frontline: CHAMPIONS_DB[champId]?.isFrontline ? 1 : 0,
      is_hypercarry: CHAMPIONS_DB[champId]?.isHypercarry ? 1 : 0,
      has_hard_cc: CHAMPIONS_DB[champId]?.hasHardCC ? 1 : 0,
      tags: JSON.stringify(CHAMPIONS_DB[champId]?.tags || [])
    });

    // Matchups (counters)
    const counters = cData.counters || [];
    counters.forEach((cnt: any) => {
      const opponentId = resolveChampionId(cnt.name, nameIdMap);
      if (opponentId) {
        championsRepo.saveMatchup({
          champion_id: champId,
          opponent_id: opponentId,
          lane: cData.lane || "UNKNOWN",
          winrate: cnt.winrate,
          gold_diff: parseInt(cnt.goldDiff || 0),
          xp_diff: parseInt(cnt.xpDiff || 0),
          cs_diff: parseFloat(cnt.csDiff || 0.0),
          dominance_score: parseFloat(cnt.dominanceScore || 0.0),
          matchup_type: 'counter'
        });
      }
    });

    // Matchups (godMatchups)
    const godMatchups = cData.godMatchups || [];
    godMatchups.forEach((god: any) => {
      const opponentId = resolveChampionId(god.name, nameIdMap);
      if (opponentId) {
        championsRepo.saveMatchup({
          champion_id: champId,
          opponent_id: opponentId,
          lane: cData.lane || "UNKNOWN",
          winrate: god.winrate,
          gold_diff: parseInt(god.goldDiff || 0),
          xp_diff: parseInt(god.xpDiff || 0),
          cs_diff: parseFloat(god.csDiff || 0.0),
          dominance_score: parseFloat(god.dominanceScore || 0.0),
          matchup_type: 'god_matchup'
        });
      }
    });

    // Sinergias
    const synergies = cData.synergies || {};
    Object.keys(synergies).forEach(roleKey => {
      const partnerList = synergies[roleKey] || [];
      partnerList.forEach((syn: any) => {
        const partnerId = resolveChampionId(syn.name, nameIdMap);
        if (partnerId) {
          championsRepo.saveSynergy({
            champion_id: champId,
            partner_id: partnerId,
            lane: roleKey.toUpperCase(),
            delta: parseFloat(syn.delta || 0.0)
          });
        }
      });
    });

    // Build
    if (cData.buildData) {
      championsRepo.clearBuilds(champId);
      const b = cData.buildData;
      
      // 1. Guardar build por defecto (is_default = 1)
      championsRepo.saveBuild({
        champion_id: champId,
        build_name: "Recomendada",
        is_default: 1,
        patch: version,
        summoners: JSON.stringify(b.summoners || []),
        runes: JSON.stringify(b.runes || {}),
        items: JSON.stringify(b.items || {}),
        skills: JSON.stringify(b.skills || {}),
        tags: JSON.stringify(["Default", cData.lane]),
        special_notes: JSON.stringify({ 
          last_update: new Date().toISOString(),
          winrate: b.skills?.winrate || 50.0,
          pickrate: b.skills?.pickrate || 100.0,
          style: "Default"
        })
      });

      // 2. Guardar builds candidatas (is_default = 0)
      let coreSource = data.coreBuilds?.coreItem3 || [];
      if (coreSource.length === 0 && data.coreBuilds?.coreItem5) {
        coreSource = data.coreBuilds.coreItem5;
      }
      
      const sortedCandidates = [...coreSource].sort((a: any, b: any) => b.pickrate - a.pickrate);
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
        // Obtener la mejor runa clave para este estilo específico
        const candKeystone = getBestKeystoneForStyle(r.primaryRuneId, style) || bestKeystone;
        const candPrimaryStyleId = getStyleOfRune(candKeystone);
        
        let candRunes = { ...b.runes };
        
        if (candPrimaryStyleId !== 0) {
          // Obtener las mejores runas de los slots 2, 3, y 4 de la misma rama primaria
          const rune2 = getBestRuneForStyleInSlot(r.primaryRuneId2, candPrimaryStyleId);
          const rune3 = getBestRuneForStyleInSlot(r.primaryRuneId3, candPrimaryStyleId);
          const rune4 = getBestRuneForStyleInSlot(r.primaryRuneId4, candPrimaryStyleId);
          
          // Obtener las mejores runas de la rama secundaria que no coincidan con la rama primaria
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
            shards: b.runes.shards || []
          };
        }

        const candPaths = getPathsForBuild(
          data.items || {},
          cand.itemIds,
          damageType,
          bestBootsId || 3047
        );

        championsRepo.saveBuild({
          champion_id: champId,
          build_name: `Core ${style} #${candidateIdx}`,
          is_default: 0,
          patch: version,
          summoners: JSON.stringify(b.summoners || []),
          runes: JSON.stringify(candRunes),
          items: JSON.stringify({
            starter: b.items.starter,
            boots: b.items.boots,
            core: cand.itemIds,
            paths: candPaths,
            slotItems: data.items
          }),
          skills: JSON.stringify(b.skills || {}),
          tags: JSON.stringify(tags),
          special_notes: JSON.stringify({
            last_update: new Date().toISOString(),
            winrate: cand.winrate,
            pickrate: cand.pickrate,
            style: style
          })
        });

        candidateIdx++;
      });
    }
  }

  // Escribir en la memoria local
  dbMemory[name] = cData;
}

// --- SERVICIO DE SINCRONIZACIÓN GENERAL ---
export async function syncMetaAndBuilds(
  version: string,
  checkAbort: () => boolean,
  writeLog: (msg: string) => void,
  forceSync = false,
  onProgress?: (current: number, total: number, phase: 'opgg' | 'puppeteer' | 'done') => void
): Promise<string> {
  const dbPath = './src/lib/data/counter-synergies.json';
  const cachePath = './src/lib/data/meta-cache.json';
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  const champions = Object.keys(db);
  const nameIdMap = championsRepo.getChampionIdNameMap();

  writeLog(`🚀 INICIANDO SINCRONIZACIÓN GENERAL - Versión Parche: ${version}`);

  // --- PARTE 0: Sincronizar catálogo de items desde Community Dragon ---
  try {
    writeLog("📥 Sincronizando catálogo de items desde Community Dragon...");
    const itemsCount = await syncItemsFromCommunityDragon();
    writeLog(`✅ Catálogo de items actualizado (${itemsCount} items)`);
  } catch (e: any) {
    writeLog(`⚠️ Error al sincronizar items desde Community Dragon: ${e.message || e}`);
  }

  // --- PARTE 1: OP.GG (Sin Puppeteer - Rápido) ---
  const roles = ['top', 'jungle', 'mid', 'adc', 'support'];
  const metaCache: Record<string, any[]> = {};

  let roleIdx = 0;
  onProgress?.(0, roles.length, 'opgg');
  for (const role of roles) {
    if (checkAbort()) return "Cancelado por el usuario";
    writeLog(`🔍 Scrapeando OP.GG: ${role}`);
    const pos = role === 'utility' ? 'support' : (role === 'adc' ? 'bottom' : role);
    try {
      const { data: html } = await axios.get(`https://www.op.gg/champions?region=global&tier=emerald_plus&position=${pos}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(html);
      const list: any[] = [];

      $('table tbody tr').each((_, el) => {
        const row = $(el);
        if (row.hasClass('ad')) return;
        const rank = row.find('td:first-child span.w-5').first().text().trim();

        list.push({
          rank: rank,
          name: row.find('td:nth-child(2) strong').text().trim(),
          winRate: row.find('td:nth-child(5)').text().trim(),
          pickRate: row.find('td:nth-child(6)').text().trim(),
          counters: row.find('td:nth-child(8) img').map((_, img) => $(img).attr('alt')).get()
        });
      });
      metaCache[role] = list;
    } catch (e: any) {
      writeLog(`Error OP.GG ${role}: ${e.message || e}`);
    }
    roleIdx++;
    onProgress?.(roleIdx, roles.length, 'opgg');
  }
  fs.writeFileSync(cachePath, JSON.stringify(metaCache, null, 2));

  // Guardar Tiers y Winrates actualizados en SQLite (OP.GG)
  writeLog("💾 Sincronizando tiers y winrates con SQLite...");
  
  const roleToLaneMap: Record<string, string> = {
    'top': 'TOP',
    'jungle': 'JUNGLE',
    'mid': 'MIDDLE',
    'adc': 'BOTTOM',
    'support': 'UTILITY'
  };

  Object.keys(metaCache).forEach(role => {
    const list = metaCache[role] || [];
    list.forEach((metaChamp: any) => {
      const champId = resolveChampionId(metaChamp.name, nameIdMap);
      if (!champId) return;

      const baseChamp = CHAMPIONS_DB[champId];
      const currentChampStmt = dbInstance.prepare('SELECT lane, scaling_type FROM champions WHERE id = ?');
      const current = currentChampStmt.get(champId) as any;

      const roleLane = roleToLaneMap[role];
      const currentLane = current?.lane || "UNKNOWN";

      // Omitir si no coincide con el carril principal
      if (currentLane !== "UNKNOWN" && currentLane !== roleLane) {
        return;
      }

      championsRepo.saveChampion({
        id: champId,
        name: baseChamp.name,
        lane: current?.lane || "UNKNOWN",
        tier: parseInt(metaChamp.rank) || 99,
        win_rate: parseFloat(metaChamp.winRate) || 50.0,
        scaling_type: current?.scaling_type || "Mid",
        damage_type: baseChamp.damageType || "Adaptive",
        class: baseChamp.class || "Unknown",
        is_frontline: baseChamp.isFrontline ? 1 : 0,
        is_hypercarry: baseChamp.isHypercarry ? 1 : 0,
        has_hard_cc: baseChamp.hasHardCC ? 1 : 0,
        tags: JSON.stringify(baseChamp.tags || [])
      });
    });
  });

  const syncPeriodSetting = parseInt(configRepo.getConfig('sync_period_days') || '3') || 3;

  // --- COMPROBAR CAMPEONES A SINCRONIZAR (Sync Diferencial) ---
  const pendingChamps = champions.filter(name => {
    const id = nameIdMap[normalizeKey(name)];
    if (!id) return false;
    if (forceSync) return true;
    return !isChampionBuildUpToDate(id, version, syncPeriodSetting);
  });

  const skippedCount = champions.length - pendingChamps.length;
  if (skippedCount > 0) {
    writeLog(`⏭️ [SYNC DIFERENCIAL] Omitiendo ${skippedCount} campeones ya actualizados para el parche ${version}.`);
  }

  if (pendingChamps.length === 0) {
    writeLog("🏁 Todos los campeones están al día. Sincronización finalizada.");
    onProgress?.(0, 0, 'done');
    return "Sincronización al día";
  }

  writeLog(`⚡ Iniciando Puppeteer para procesar ${pendingChamps.length} campeones.`);
  onProgress?.(0, pendingChamps.length, 'puppeteer');

  // --- PARTE 2: DPM.LOL (CONCURRENCIA PARALELA) ---
  const concurrencySetting = parseInt(configRepo.getConfig('puppeteer_concurrency') || '3') || 3;
  // Limitar concurrencia física para evitar saturar el sistema
  const concurrency = Math.min(Math.max(concurrencySetting, 1), 6); 

  writeLog(`🚀 Nivel de concurrencia configurado: ${concurrency} páginas simultáneas.`);

  const profilesDir = path.join(process.cwd(), '.puppeteer_profiles');
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }
  const uniqueProfileDir = path.join(profilesDir, `profile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  const browser = await puppeteer.launch({ 
    headless: true,
    userDataDir: uniqueProfileDir,
    pipe: true,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ] 
  });

  try {
    const pages = await Promise.all(
      Array.from({ length: concurrency }).map(async () => {
        const p = await browser.newPage();
        await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await p.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
          });
        });
        return p;
      })
    );

    let index = 0;
    let savedCount = 0;

    const worker = async (page: any, workerId: number) => {
      while (index < pendingChamps.length) {
        if (checkAbort()) break;
        
        const name = pendingChamps[index++];
        if (!name) break;

        writeLog(`🔄 [Pestaña ${workerId}] Descargando build y matchups: ${name} (${index}/${pendingChamps.length})`);
        
        try {
          await scrapeSingleChampion(page, name, version, db, nameIdMap, writeLog);
          savedCount++;
          onProgress?.(savedCount, pendingChamps.length, 'puppeteer');

          // Guardar preventivamente cada 5 campeones en JSON
          if (savedCount % 5 === 0) {
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          }
        } catch (e: any) {
          writeLog(`❌ [Pestaña ${workerId}] Error procesando ${name}: ${e.message || e}`);
        }

        // Delay mínimo para respetar rate limits de Cloudflare
        await new Promise(r => setTimeout(r, 1500));
      }
    };

    // Lanzar todos los workers en paralelo
    await Promise.all(pages.map((p, i) => worker(p, i + 1)));

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  } finally {
    await browser.close();
    try {
      fs.rmSync(uniqueProfileDir, { recursive: true, force: true });
    } catch (e) {}
  }

  if (checkAbort()) {
    writeLog("🛑 CANCELACIÓN PROCESADA. Procesador detenido.");
    return "Cancelado por el usuario";
  }

  try {
    configRepo.setConfig('last_sync_timestamp', new Date().toISOString());
  } catch (err) {}
  
  // --- PARTE 3: Sincronizar datos semánticos de campeones ---
  try {
    writeLog("🧠 Sincronizando datos semánticos de campeones...");
    await syncChampionsSemanticData();
  } catch (e: any) {
    writeLog(`⚠️ Error al sincronizar datos semánticos de campeones: ${e.message || e}`);
  }

  writeLog("🏁 SINCRONIZACIÓN COMPLETA - Datos actualizados en SQLite local");
  onProgress?.(pendingChamps.length, pendingChamps.length, 'done');
  return "Sincronización completa";
}
