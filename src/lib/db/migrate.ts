// src/lib/db/migrate.ts
import fs from 'fs';
import path from 'path';
import { CHAMPIONS_DB } from '../data/championdb.js';
import { championsRepo } from './champions.repo.js';
import { db } from './sqlite.js';

export const normalizeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

// Mapeos especiales de nombres de dpm.lol / OP.GG a la base de datos de Riot
const API_NAME_MAP: Record<string, string> = {
  "monkeyking": "wukong",
  "masteryi": "maestroyi",
  "nunu": "nunuywillump",
  "renata": "renataglasc",
  "bard": "bardo"
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

  const synergiesPath = path.resolve(process.cwd(), 'src/lib/data/counter-synergies.json');
  const cachePath = path.resolve(process.cwd(), 'src/lib/data/meta-cache.json');

  if (!fs.existsSync(synergiesPath)) {
    console.error(`❌ Archivo de origen no encontrado en: ${synergiesPath}`);
    return;
  }

  const counterSynergies = JSON.parse(fs.readFileSync(synergiesPath, 'utf-8'));
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
      tier: 5, // Valor por defecto
      win_rate: 50.0, // Valor por defecto
      scaling_type: "Mid", // Valor por defecto, se calcula luego
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
      tier: 5,
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
        special_notes: JSON.stringify({})
      });
    }
  });

  // 4. Procesar Tiers y Winrates desde meta-cache.json (OP.GG)
  console.log("📊 Migrando tiers y winrates desde meta-cache...");
  Object.keys(metaCache).forEach(role => {
    const list = metaCache[role] || [];
    list.forEach((metaChamp: any) => {
      const champId = resolveChampionId(metaChamp.name, nameIdMap);
      if (!champId) return;

      // Leer datos actuales para no sobreescribir otras propiedades
      const baseChamp = CHAMPIONS_DB[champId];
      const nameKey = baseChamp.name;
      const extra = counterSynergies[nameKey];
      const tierNum = parseInt(metaChamp.rank) || 5;
      const winRateNum = parseFloat(metaChamp.winRate) || 50.0;

      // Nota: Volvemos a guardar el campeón con tier y winrate actualizados
      // SQLite se encarga del ON CONFLICT UPDATE
      const dbChampStmt = db.prepare('SELECT * FROM champions WHERE id = ?');
      const current = dbChampStmt.get(champId) as any;

      championsRepo.saveChampion({
        id: champId,
        name: baseChamp.name,
        lane: current?.lane || extra?.lane || "UNKNOWN",
        tier: tierNum,
        win_rate: winRateNum,
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

  console.log("🎉 MIGRACIÓN COMPLETADA CON ÉXITO.");
}

// Ejecutar si se corre directamente
if (process.argv[1] === path.resolve(process.cwd(), 'src/lib/db/migrate.ts') || process.argv[1]?.endsWith('migrate.ts')) {
  runMigration();
}
