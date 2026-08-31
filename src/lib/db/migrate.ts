// src/lib/db/migrate.ts
import fs from 'fs';
import path from 'path';
import { CHAMPIONS_DB } from '../data/championdb.js';
import { championsRepo } from './champions.repo.js';
import { db } from './sqlite.js';
import { configRepo } from './config.repo.js';
import { syncChampionsSemanticData } from '../scripts/sync-champions-cdrag.js';

export const normalizeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

// Mapeos especiales de nombres de LoLalytics / legacy / OP.GG a la base de datos de Riot
const API_NAME_MAP: Record<string, string> = {
  "monkeyking": "wukong",
  "masteryi": "maestroyi",
  "nunu": "nunuywillump",
  "renata": "renataglasc",
  "bard": "bardo"
};

const roleToLaneMap: Record<string, string> = {
  'top': 'TOP',
  'jungle': 'JUNGLE',
  'mid': 'MIDDLE',
  'adc': 'BOTTOM',
  'support': 'UTILITY'
};

function resolveChampionId(name: string, nameIdMap: Record<string, number>): number | null {
  const norm = normalizeKey(name);
  if (nameIdMap[norm]) return nameIdMap[norm];
  
  // Intentar con alias
  const alias = API_NAME_MAP[norm];
  if (alias && nameIdMap[alias]) return nameIdMap[alias];

  // Búsqueda por sub-string si falla
  for (const [key, id] of Object.entries(nameIdMap)) {
    if (key.includes(norm) || norm.includes(key)) {
      return id;
    }
  }

  return null;
}

export function runMigration() {
  console.log("🏁 INICIANDO MIGRACIÓN A SQLITE...");

  const cachePath = path.resolve(process.cwd(), 'src/lib/data/meta-cache.json');
  const counterSynergies: Record<string, any> = {};
  const metaCache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) : {};

  // 1. Limpiar datos viejos
  console.log("🧹 Limpiando tablas de base de datos...");
  championsRepo.clearAllData();

  // 2. Insertar campeones base desde CHAMPIONS_DB
  console.log("➕ Insertando campeones base de Riot...");
  const basicChamps = Object.values(CHAMPIONS_DB);
  
  basicChamps.forEach(c => {
    // Buscar si el campeón tiene datos extra en counter-synergies
    const nameKey = c.name;
    const extra = counterSynergies[nameKey];

    championsRepo.saveChampion({
      id: c.id,
      name: c.name,
      lane: extra?.lane || "UNKNOWN",
      tier: 99, // Valor por defecto
      win_rate: 50.0, // Valor por defecto
      scaling_type: c.scalingType || "Mid", // Valor por defecto, se calcula luego
      damage_type: c.damageType || "Adaptive",
      class: c.class || "Unknown",
      is_frontline: c.isFrontline ? 1 : 0,
      is_hypercarry: c.isHypercarry ? 1 : 0,
      has_hard_cc: c.hasHardCC ? 1 : 0,
      tags: JSON.stringify(c.tags || [])
    });
  });

  // Generamos el mapeador de nombres a IDs
  const nameIdMap = championsRepo.getChampionIdNameMap();
  console.log(`✅ ${Object.keys(nameIdMap).length} campeones base listados en mapeador.`);

  // 3. Procesar datos de counter-synergies (counters, godMatchups, synergies, builds)
  console.log("🧬 Migrando matchups, sinergias y builds desde JSON...");
  
  Object.keys(counterSynergies).forEach(champName => {
    const champId = resolveChampionId(champName, nameIdMap);
    if (!champId) {
      console.warn(`⚠️ No se pudo resolver ID para campeón base: ${champName}`);
      return;
    }

    const data = counterSynergies[champName];
    const lane = data.lane || "UNKNOWN";

    // A. Actualizar tipo de escalado si viene en la curva de winrate
    const curve = data.combat?.winrateCurve || [];
    let scalingType = "Mid";
    if (curve.length >= 6) {
      const values = curve.map((p: any) => typeof p === 'object' ? p.value : p);
      const earlyWR = values[2] || 50;
      const lateWR = values[7] || values[values.length - 2] || 50;
      const delta = earlyWR - lateWR;
      if (delta > 1.5) scalingType = "Early";
      else if (delta < -1.5) scalingType = "Late";
    }

    // Actualizar datos extendidos del campeón en DB
    const baseChamp = CHAMPIONS_DB[champId];
    championsRepo.saveChampion({
      id: champId,
      name: baseChamp.name,
      lane: lane,
      tier: 99,
      win_rate: 50.0,
      scaling_type: scalingType,
      damage_type: baseChamp.damageType || "Adaptive",
      class: baseChamp.class || "Unknown",
      is_frontline: baseChamp.isFrontline ? 1 : 0,
      is_hypercarry: baseChamp.isHypercarry ? 1 : 0,
      has_hard_cc: baseChamp.hasHardCC ? 1 : 0,
      tags: JSON.stringify(baseChamp.tags || [])
    });

    // B. Migrar Counters
    const counters = data.counters || [];
    counters.forEach((cnt: any) => {
      const opponentId = resolveChampionId(cnt.name, nameIdMap);
      if (!opponentId) return;

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
    });

    // C. Migrar God Matchups
    const godMatchups = data.godMatchups || [];
    godMatchups.forEach((god: any) => {
      const opponentId = resolveChampionId(god.name, nameIdMap);
      if (!opponentId) return;

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
    });

    // D. Migrar Sinergias
    const synergies = data.synergies || {};
    Object.keys(synergies).forEach(roleKey => {
      const partnerList = synergies[roleKey] || [];
      partnerList.forEach((syn: any) => {
        const partnerId = resolveChampionId(syn.name, nameIdMap);
        if (!partnerId) return;

        championsRepo.saveSynergy({
          champion_id: champId,
          partner_id: partnerId,
          lane: roleKey.toUpperCase(),
          delta: parseFloat(syn.delta || 0.0)
        });
      });
    });

    // E. Migrar Build por Defecto
    if (data.buildData) {
      const b = data.buildData;
      championsRepo.saveBuild({
        champion_id: champId,
        build_name: "Recomendada",
        is_default: 1,
        patch: b.patch || "14.11",
        summoners: JSON.stringify(b.summoners || []),
        runes: JSON.stringify(b.runes || {}),
        items: JSON.stringify(b.items || {}),
        skills: JSON.stringify(b.skills || {}),
        tags: JSON.stringify(["Default", lane]),
        special_notes: JSON.stringify({ last_update: b.lastUpdate || new Date().toISOString() })
      });
    }
  });

  // 4. Procesar Tiers, Winrates y Carriles desde meta-cache.json (OP.GG)
  console.log("📊 Migrando tiers, winrates y carriles desde meta-cache...");

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

    // Calcular distribución
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
    const dbChampStmt = db.prepare('SELECT lane, scaling_type FROM champions WHERE id = ?');
    const current = dbChampStmt.get(champId) as any;

    const primaryLane = roleToLaneMap[bestStat.role] || "UNKNOWN";

    championsRepo.saveChampion({
      id: champId,
      name: baseChamp.name,
      lane: primaryLane,
      tier: parseInt(bestStat.rank) || 99,
      win_rate: parseFloat(bestStat.winRate) || 50.0,
      scaling_type: baseChamp.scalingType || current?.scaling_type || "Mid",
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
    configRepo.setConfig('last_sync_timestamp', new Date().toISOString());
    configRepo.setConfig('last_lane_sync_timestamp', new Date().toISOString());
    console.log("💾 Timestamps de configuración actualizados correctamente.");
  } catch (err) {
    console.error("⚠️ Error al actualizar timestamps de configuración:", err);
  }

  try {
    console.log("🧠 Sincronizando datos semánticos de campeones durante la migración...");
    syncChampionsSemanticData();
  } catch (e: any) {
    console.error("⚠️ Error al sincronizar datos semánticos de campeones:", e);
  }

  console.log("🎉 MIGRACIÓN COMPLETADA CON ÉXITO.");
}

// Ejecutar si se corre directamente
if (process.argv[1] === path.resolve(process.cwd(), 'src/lib/db/migrate.ts') || process.argv[1]?.endsWith('migrate.ts')) {
  runMigration();
  setTimeout(() => {
    console.log("👋 Migración terminada. Forzando salida del proceso.");
    process.exit(0);
  }, 4000);
}
