// src/lib/services/sync.service.ts
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
import { syncRunesFromCommunityDragon } from '../scripts/sync-runes.js';
import { syncChampionsSemanticData } from '../scripts/sync-champions-cdrag.js';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';

const API_NAME_MAP: Record<string, string> = {
  "Wukong": "MonkeyKing",
  "Maestro Yi": "MasterYi",
  "Nunu y Willump": "Nunu",
  "Renata Glasc": "Renata",
  "Bardo": "Bard",
  "Kha'Zix": "Khazix",
  "Kai'Sa": "Kaisa",
  "Bel'Veth": "Belveth",
  "Rek'Sai": "RekSai",
  "Vel'Koz": "Velkoz",
  "Cho'Gath": "Chogath",
  "Dr. Mundo": "DrMundo",
  "K'Sante": "KSante",
  "Kog'Maw": "KogMaw",
  "Jarvan IV": "JarvanIV",
  "Lee Sin": "LeeSin",
  "Miss Fortune": "MissFortune",
  "Twisted Fate": "TwistedFate",
  "Xin Zhao": "XinZhao"
};

const NORM_API_NAME_MAP: Record<string, string> = {
  "monkeyking": "wukong",
  "masteryi": "maestroyi",
  "nunu": "nunuywillump",
  "renata": "renataglasc",
  "bard": "bardo"
};

function extractJsonFromHtml(htmlOrJson: string | any): any {
  if (typeof htmlOrJson === 'object') return htmlOrJson;
  try {
    return JSON.parse(htmlOrJson);
  } catch (e) {
    const preMatch = htmlOrJson.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch && preMatch[1]) {
      return JSON.parse(preMatch[1].trim());
    }
    const bodyMatch = htmlOrJson.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      const text = bodyMatch[1].replace(/<[^>]*>/g, '').trim();
      return JSON.parse(text);
    }
    throw new Error("No se pudo extraer JSON puro de la respuesta de FlareSolverr.");
  }
}

async function fetchWithFlareSolverr(url: string): Promise<any> {
  const response = await axios.post(FLARESOLVERR_URL, {
    cmd: "request.get",
    url: url,
    maxTimeout: 60000
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 70000
  });

  if (response.data && response.data.status === 'ok') {
    return response.data.solution.response;
  }
  throw new Error(`FlareSolverr falló con estado: ${response.data?.status}`);
}

const normalizeKey = (name: string) => name.toLowerCase()
  .replace(/\s+&\s+/g, ' y ')
  .replace(/\s+and\s+/g, ' y ')
  .replace(/[^a-z0-9]/g, "");

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

// --- COMPROBAR SI LA BUILD ESTÁ AL DÍA EN TODOS SUS CARRILES ---
function isChampionBuildUpToDate(champId: number, version: string, syncPeriodDays: number, playLanes: string[]): boolean {
  try {
    if (playLanes.length === 0) return false;

    const stmt = dbInstance.prepare('SELECT patch, special_notes FROM builds WHERE champion_id = ? AND lane = ? AND is_default = 1 LIMIT 1');
    for (const lane of playLanes) {
      const row = stmt.get(champId, lane) as { patch: string; special_notes: string } | undefined;
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
      if (diffDays >= syncPeriodDays) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// --- SCRAPEO INDIVIDUAL POR CARRILES ---
export async function scrapeSingleChampion(
  name: string,
  version: string,
  dbMemory: any,
  nameIdMap: Record<string, number>,
  writeLog: (msg: string) => void
) {
  const champId = nameIdMap[normalizeKey(name)];
  if (!champId) return;

  // Obtener carriles jugables desde la base de datos
  const laneRow = dbInstance.prepare('SELECT lane, play_lanes FROM champions WHERE id = ?').get(champId) as { lane: string, play_lanes: string } | undefined;
  const playLanes = JSON.parse(laneRow?.play_lanes || '[]');
  if (playLanes.length === 0) {
    let fallbackLane = laneRow?.lane || dbMemory[name]?.lane || "UNKNOWN";
    if (!fallbackLane || fallbackLane === "UNKNOWN") {
      fallbackLane = "MIDDLE";
    }
    playLanes.push(fallbackLane);
  }

  const cData = dbMemory[name] || {};

  for (const lane of playLanes) {
    if (lane === "UNKNOWN") continue;
    writeLog(`   > Procesando carril: ${lane} para ${name}`);
    
    const internalName = API_NAME_MAP[name] || name;
    const urlName = internalName.replace(/[^a-zA-Z0-9]/g, "");
    
    // El endpoint de dpm.lol usa 'utility' para UTILITY
    const dpmLane = lane.toUpperCase() === 'UTILITY' ? 'utility' : lane.toLowerCase();
    const url = `https://dpm.lol/v1/builds/${urlName}?lane=${dpmLane}&tier=diamond&timeframe=${version}&gameMode=ranked`;
    
    try {
      const responseHtml = await fetchWithFlareSolverr(url);
      const data = extractJsonFromHtml(responseHtml);

      if (!data || data.error || !data.runes) {
        writeLog(`   [WARN] dpm.lol no tiene builds para ${name} en ${lane}`);
        continue;
      }

      // 1. Extraer God Matchups para este carril
      const laneGodMatchups = (data.enemyMatchups?.[lane.toLowerCase()] || data.enemyMatchups?.[dpmLane] || [])
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

      // 2. Extraer Counters para este carril
      const laneCounters = (data.enemyMatchups?.[lane.toLowerCase()] || data.enemyMatchups?.[dpmLane] || [])
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
      const synergies: any = {};
      if (data.allyMatchups) {
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
      const damageType = CHAMPIONS_DB[champId]?.damageType || "AD";
      const defaultPaths = getPathsForBuild(
        data.items || {},
        bestCoreItems,
        damageType,
        bestBootsId
      );

      const laneBuildData = {
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
        skills: data.skillLevelUp?.sort((a:any, b:any) => b.winrate - a.winrate)[0] || null,
        dpmData: {
          coreBuilds: data.coreBuilds,
          items: data.items,
          boots: data.boots,
          runes: data.runes,
          summoners: data.summoners,
          startItems: data.startItems
        }
      };

      // Guardar en SQLite en tiempo real
      const currentChampStmt = dbInstance.prepare('SELECT * FROM champions WHERE id = ?');
      const current = currentChampStmt.get(champId) as any;

      championsRepo.saveChampion({
        id: champId,
        name: name,
        lane: current?.lane || cData.lane || "UNKNOWN",
        tier: current?.tier || 5,
        win_rate: current?.win_rate || 50.0,
        scaling_type: CHAMPIONS_DB[champId]?.scalingType || current?.scaling_type || cData.scalingType || "Mid",
        damage_type: CHAMPIONS_DB[champId]?.damageType || "Adaptive",
        class: CHAMPIONS_DB[champId]?.class || "Unknown",
        is_frontline: CHAMPIONS_DB[champId]?.isFrontline ? 1 : 0,
        is_hypercarry: CHAMPIONS_DB[champId]?.isHypercarry ? 1 : 0,
        has_hard_cc: CHAMPIONS_DB[champId]?.hasHardCC ? 1 : 0,
        tags: JSON.stringify(CHAMPIONS_DB[champId]?.tags || []),
        tactic_role: CHAMPIONS_DB[champId]?.tacticRole || current?.tactic_role,
        mobility: CHAMPIONS_DB[champId]?.mobility || current?.mobility,
        target_priority: CHAMPIONS_DB[champId]?.targetPriority || current?.target_priority,
        team_needs: JSON.stringify(CHAMPIONS_DB[champId]?.teamNeeds || JSON.parse(current?.team_needs || '[]')),
        team_provides: JSON.stringify(CHAMPIONS_DB[champId]?.teamProvides || JSON.parse(current?.team_provides || '[]')),
        has_shield: CHAMPIONS_DB[champId]?.hasShield !== undefined ? (CHAMPIONS_DB[champId].hasShield ? 1 : 0) : current?.has_shield,
        has_sustain: CHAMPIONS_DB[champId]?.hasSustain !== undefined ? (CHAMPIONS_DB[champId].hasSustain ? 1 : 0) : current?.has_sustain,
        lane_phase: CHAMPIONS_DB[champId]?.lanePhase || current?.lane_phase,
        resource_dependency: CHAMPIONS_DB[champId]?.resourceDependency || current?.resource_dependency,
        play_lanes: current?.play_lanes || "[]",
        lanes_pickrate: current?.lanes_pickrate || "{}",
        lanes_stats: current?.lanes_stats || "{}"
      });

      // Matchups (counters)
      laneCounters.forEach((cnt: any) => {
        const opponentId = resolveChampionId(cnt.name, nameIdMap);
        if (opponentId) {
          championsRepo.saveMatchup({
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

      // Matchups (godMatchups)
      laneGodMatchups.forEach((god: any) => {
        const opponentId = resolveChampionId(god.name, nameIdMap);
        if (opponentId) {
          championsRepo.saveMatchup({
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

      // Sinergias
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

      // Guardar builds para esta línea
      championsRepo.clearBuilds(champId, lane);
      
      // 1. Guardar build por defecto (is_default = 1)
      championsRepo.saveBuild({
        champion_id: champId,
        build_name: "Recomendada",
        is_default: 1,
        patch: version,
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
          dpmData: laneBuildData.dpmData
        }),
        lane: lane
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
          summoners: JSON.stringify(laneBuildData.summoners || []),
          runes: JSON.stringify(candRunes),
          items: JSON.stringify({
            starter: laneBuildData.items.starter,
            boots: laneBuildData.items.boots,
            core: cand.itemIds,
            paths: candPaths,
            slotItems: data.items
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
      
      // Actualizar memoria local para la última línea procesada
      cData.godMatchups = laneGodMatchups;
      cData.counters = laneCounters;
      cData.synergies = synergies;
      cData.buildData = laneBuildData;

    } catch (e: any) {
      writeLog(`   [ERROR] Error scrapeando carril ${lane} de ${name}: ${e.message || e}`);
    }
    
    // Delay entre carriles para respetar Cloudflare
    await new Promise(r => setTimeout(r, 1000));
  }

  dbMemory[name] = cData;
}

// --- SERVICIO DE SINCRONIZACIÓN GENERAL ---
export async function syncMetaCacheOnly(writeLog: (msg: string) => void): Promise<void> {
  const cachePath = './src/lib/data/meta-cache.json';
  const nameIdMap = championsRepo.getChampionIdNameMap();
  const roles = ['top', 'jungle', 'mid', 'adc', 'support'];
  const metaCache: Record<string, any[]> = {};

  writeLog(`[OPGG-SYNC] Iniciando actualizacion ligera del meta...`);

  for (const role of roles) {
    writeLog(`[OPGG-SYNC] Scrapeando: ${role}`);
    const pos = role;
    try {
      const { data: html } = await axios.get(`https://www.op.gg/champions?region=global&tier=diamond&position=${pos}`, {
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
  }

  try {
    fs.writeFileSync(cachePath, JSON.stringify(metaCache, null, 2));
  } catch (err) {
    writeLog(`[OPGG-SYNC] Error escribiendo cache: ${err}`);
  }

  // Guardar Tiers y Winrates actualizados en SQLite (OP.GG)
  writeLog("[OPGG-SYNC] Sincronizando tiers y winrates con SQLite...");
  
  const roleToLaneMap: Record<string, string> = {
    'top': 'TOP',
    'jungle': 'JUNGLE',
    'mid': 'MIDDLE',
    'adc': 'BOTTOM',
    'support': 'UTILITY'
  };

  const champMetaStats: Record<number, Array<{ role: string; rank: string; winRate: string; pickRate: string }>> = {};

  Object.keys(metaCache).forEach(role => {
    const list = metaCache[role] || [];
    list.forEach((metaChamp: any) => {
      const champId = resolveChampionId(metaChamp.name, nameIdMap);
      if (!champId) return;
      if (!champMetaStats[champId]) {
        champMetaStats[champId] = [];
      }
      champMetaStats[champId].push({
        role,
        rank: metaChamp.rank,
        winRate: metaChamp.winRate,
        pickRate: metaChamp.pickRate
      });
    });
  });

  const dbPath = './src/lib/data/counter-synergies.json';
  let db: any = {};
  try {
    if (fs.existsSync(dbPath)) {
      db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }
  } catch (err) {
    db = {};
  }

  Object.keys(champMetaStats).forEach(idStr => {
    const champId = Number(idStr);
    const statsList = champMetaStats[champId];
    if (statsList.length === 0) return;

    const parsePickRate = (pr: string) => parseFloat(pr.replace('%', '')) || 0.0;
    
    let bestStat = statsList[0];
    let maxPick = parsePickRate(bestStat.pickRate);

    for (let i = 1; i < statsList.length; i++) {
      const pr = parsePickRate(statsList[i].pickRate);
      if (pr > maxPick) {
        maxPick = pr;
        bestStat = statsList[i];
      }
    }

     let totalPickRate = 0;
     statsList.forEach(s => {
       totalPickRate += parsePickRate(s.pickRate);
     });
 
     const distribution: Record<string, number> = {};
     const lanesStats: Record<string, { tier: number, winRate: number }> = {};
     statsList.forEach(s => {
       const laneKey = roleToLaneMap[s.role];
       if (laneKey && totalPickRate > 0) {
         const relativeRate = (parsePickRate(s.pickRate) / totalPickRate) * 100;
         distribution[laneKey] = parseFloat(relativeRate.toFixed(1));
         lanesStats[laneKey] = {
           tier: parseInt(s.rank) || 99,
           winRate: parseFloat(s.winRate) || 50.0
         };
       }
     });
 
     const playLanes = Object.entries(distribution)
       .filter(([_, relRate]) => relRate > 5.0)
       .map(([lane]) => lane);
 
     if (playLanes.length === 0 && Object.keys(distribution).length > 0) {
       const bestLane = Object.entries(distribution).reduce((a, b) => a[1] > b[1] ? a : b)[0];
       playLanes.push(bestLane);
     }
 
     const baseChamp = CHAMPIONS_DB[champId];
     if (!baseChamp) return;

     const currentChampStmt = dbInstance.prepare('SELECT lane, scaling_type FROM champions WHERE id = ?');
     const current = currentChampStmt.get(champId) as any;
 
     const primaryLane = roleToLaneMap[bestStat.role] || "UNKNOWN";
 
     if (db[baseChamp.name]) {
       db[baseChamp.name].lane = primaryLane;
     }
 
     championsRepo.saveChampion({
       id: champId,
       name: baseChamp.name,
       lane: primaryLane,
       tier: parseInt(bestStat.rank) || 99,
       win_rate: parseFloat(bestStat.winRate) || 50.0,
       scaling_type: current?.scaling_type || "Mid",
       damage_type: baseChamp.damageType || "Adaptive",
       class: baseChamp.class || "Unknown",
       is_frontline: baseChamp.isFrontline ? 1 : 0,
       is_hypercarry: baseChamp.isHypercarry ? 1 : 0,
       has_hard_cc: baseChamp.hasHardCC ? 1 : 0,
       tags: JSON.stringify(baseChamp.tags || []),
       play_lanes: JSON.stringify(playLanes),
       lanes_pickrate: JSON.stringify(distribution),
       lanes_stats: JSON.stringify(lanesStats)
     });
  });

  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (err) {
    writeLog(`[OPGG-SYNC] Error escribiendo counter-synergies: ${err}`);
  }

  try {
    configRepo.setConfig('last_meta_cache_sync', new Date().toISOString());
  } catch (err) {
    writeLog(`[OPGG-SYNC] Error guardando last_meta_cache_sync: ${err}`);
  }

  writeLog(`[OPGG-SYNC] Actualizacion del meta finalizada.`);
}

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

  const nameIdMap = championsRepo.getChampionIdNameMap();
  const nameMap = championsRepo.getChampionNameIdMap();
  const champions = Object.values(nameMap); // Obtener todos los campeones de SQLite para soportar nuevos campeones

  writeLog(`[SYNC] Iniciando sincronizacion general - Parche: ${version}`);

  // --- PARTE 0: Sincronizar catálogo de items desde Community Dragon ---
  try {
    writeLog("[SYNC] Sincronizando catalogo de items desde Community Dragon...");
    const itemsCount = await syncItemsFromCommunityDragon();
    writeLog(`[OK] Catalogo de items actualizado (${itemsCount} items)`);
  } catch (e: any) {
    writeLog(`[WARN] Error al sincronizar items desde Community Dragon: ${e.message || e}`);
  }

  // --- PARTE 0.5: Sincronizar runas y shards desde Community Dragon ---
  try {
    writeLog("[SYNC] Sincronizando runas y shards desde Community Dragon...");
    const runesResult = await syncRunesFromCommunityDragon();
    writeLog(`[OK] Runas actualizadas (${runesResult.runesCount} runas, ${runesResult.shardsCount} shards, ${runesResult.runeToStyleCount} mappings)`);
  } catch (e: any) {
    writeLog(`[WARN] Error al sincronizar runas desde Community Dragon: ${e.message || e}`);
  }

  // --- PARTE 1: OP.GG (Sin Puppeteer - Rápido) ---
  onProgress?.(0, 5, 'opgg');
  await syncMetaCacheOnly(writeLog);
  onProgress?.(5, 5, 'opgg');

  // Recargar db desde archivo por si cambió
  let updatedDb;
  try {
    updatedDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (e) {
    updatedDb = {};
  }
  Object.keys(db).forEach(k => delete db[k]);
  Object.assign(db, updatedDb);

  const syncPeriodSetting = parseInt(configRepo.getConfig('sync_period_days') || '3') || 3;

  // --- COMPROBAR CAMPEONES A SINCRONIZAR (Sync Diferencial) ---
  const pendingChamps = champions.filter(name => {
    const id = nameIdMap[normalizeKey(name)];
    if (!id) return false;
    if (forceSync) return true;

    // Obtener carriles jugables desde la BD
    const laneRow = dbInstance.prepare('SELECT play_lanes FROM champions WHERE id = ?').get(id) as { play_lanes: string } | undefined;
    const playLanes = JSON.parse(laneRow?.play_lanes || '[]');

    return !isChampionBuildUpToDate(id, version, syncPeriodSetting, playLanes);
  });

  const skippedCount = champions.length - pendingChamps.length;
  if (skippedCount > 0) {
    writeLog(`[SKIP] Omitiendo ${skippedCount} campeones ya actualizados para el parche ${version}.`);
  }

  if (pendingChamps.length === 0) {
    writeLog("[DONE] Todos los campeones estan al dia. Sincronizacion finalizada.");
    onProgress?.(0, 0, 'done');
    return "Sincronización al día";
  }

  writeLog(`[FLARESOLVERR] Iniciando procesamiento de ${pendingChamps.length} campeones.`);
  onProgress?.(0, pendingChamps.length, 'puppeteer');

  // --- PARTE 2: DPM.LOL (CONCURRENCIA PARALELA CON FLARESOLVERR) ---
  const concurrencySetting = parseInt(configRepo.getConfig('puppeteer_concurrency') || '3') || 3;
  // Concurrencia de trabajadores
  const concurrency = Math.min(Math.max(concurrencySetting, 1), 6); 

  writeLog(`[FLARESOLVERR] Concurrencia: ${concurrency} trabajadores simultáneos.`);

  let index = 0;
  let savedCount = 0;

  const worker = async (workerId: number) => {
    while (index < pendingChamps.length) {
      if (checkAbort()) break;
      
      const name = pendingChamps[index++];
      if (!name) break;

      writeLog(`[W-${workerId}] Descargando build y matchups: ${name} (${index}/${pendingChamps.length})`);
      
      try {
        await scrapeSingleChampion(name, version, db, nameIdMap, writeLog);
        savedCount++;
        onProgress?.(savedCount, pendingChamps.length, 'puppeteer');

        // Guardar preventivamente cada 5 campeones en JSON
        if (savedCount % 5 === 0) {
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        }
      } catch (e: any) {
        writeLog(`[ERROR] [W-${workerId}] Error procesando ${name}: ${e.message || e}`);
      }

      // Delay de cortesía para no sobrecargar el proxy/dpm.lol
      await new Promise(r => setTimeout(r, 800));
    }
  };

  // Lanzar todos los workers en paralelo
  await Promise.all(Array.from({ length: concurrency }).map((_, i) => worker(i + 1)));

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  if (checkAbort()) {
    writeLog("[ABORT] Cancelacion procesada. Procesador detenido.");
    return "Cancelado por el usuario";
  }

  try {
    configRepo.setConfig('last_sync_timestamp', new Date().toISOString());
    configRepo.setConfig('last_sync_version', version);
  } catch (err) {}
  
  // --- PARTE 3: Sincronizar datos semánticos de campeones ---
  try {
    writeLog("[SYNC] Sincronizando datos semanticos de campeones...");
    await syncChampionsSemanticData();
  } catch (e: any) {
    writeLog(`[WARN] Error al sincronizar datos semanticos: ${e.message || e}`);
  }

  writeLog("[DONE] Sincronizacion completa - Datos actualizados en SQLite local");
  onProgress?.(pendingChamps.length, pendingChamps.length, 'done');
  return "Sincronización completa";
}

let isSyncing = false;

export async function checkAndRunMetaSync(writeLog: (msg: string) => void) {
  if (isSyncing) return;
  
  try {
    const freqStr = configRepo.getConfig('meta_sync_frequency') || '2';
    const frequencyHours = parseFloat(freqStr);
    
    if (frequencyHours === 0) {
      // Sincronización desactivada
      return;
    }
    
    const lastSyncStr = configRepo.getConfig('last_meta_cache_sync');
    
    if (!lastSyncStr || lastSyncStr === '-') {
      // Primera vez, correr inmediatamente
      isSyncing = true;
      await syncMetaCacheOnly(writeLog);
      isSyncing = false;
      return;
    }
    
    const lastSyncDate = new Date(lastSyncStr);
    if (isNaN(lastSyncDate.getTime())) {
      // Fecha inválida, correr inmediatamente
      isSyncing = true;
      await syncMetaCacheOnly(writeLog);
      isSyncing = false;
      return;
    }
    
    if (frequencyHours === -1) {
      // Únicamente al inicio
      return;
    }
    
    const elapsedMs = Date.now() - lastSyncDate.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    
    if (elapsedHours >= frequencyHours) {
      isSyncing = true;
      await syncMetaCacheOnly(writeLog);
      isSyncing = false;
    }
  } catch (err) {
    console.error('[Scheduler] Error en checkAndRunMetaSync:', err);
    isSyncing = false;
  }
}

export function startAutomaticMetaCacheScheduler() {
  const g = globalThis as any;
  if (g.metaCacheSchedulerStarted) {
    console.log('[Scheduler] El planificador de meta-cache ya está activo.');
    return;
  }
  g.metaCacheSchedulerStarted = true;
  
  const writeLog = (msg: string) => {
    console.log(`[Scheduler] ${msg}`);
  };
  
  console.log('[Scheduler] Iniciando planificador automático de Meta-Cache (frecuencia configurada)...');
  
  // Ejecutar una comprobación inicial al arrancar (después de 5 segundos)
  setTimeout(() => {
    const freqStr = configRepo.getConfig('meta_sync_frequency') || '2';
    if (freqStr === '-1') {
      isSyncing = true;
      syncMetaCacheOnly(writeLog).then(() => {
        isSyncing = false;
      }).catch(err => {
        console.error('[Scheduler] Error en inicio de meta sync:', err);
        isSyncing = false;
      });
    } else {
      checkAndRunMetaSync(writeLog);
    }
  }, 5000);
  
  // Intervalo de comprobación cada 15 minutos (15 * 60 * 1000 ms)
  const CHECK_INTERVAL = 15 * 60 * 1000;
  setInterval(() => {
    checkAndRunMetaSync(writeLog);
  }, CHECK_INTERVAL);
}
