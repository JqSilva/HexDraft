import fs from 'fs';
import path from 'path';
import { CHAMPIONS_DB } from '../data/championdb.js';

const normalizeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

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
  
  const alias = API_NAME_MAP[norm];
  if (alias && nameIdMap[alias]) return nameIdMap[alias];

  for (const [key, id] of Object.entries(nameIdMap)) {
    if (key.includes(norm) || norm.includes(key)) {
      return id;
    }
  }
  return null;
}

export function populateDatabase(db: any) {
  console.log("🏁 INICIANDO CARGA INICIAL DE DATOS EN SQLITE...");

  const synergiesPath = path.resolve(process.cwd(), 'src/lib/data/counter-synergies.json');
  const cachePath = path.resolve(process.cwd(), 'src/lib/data/meta-cache.json');

  if (!fs.existsSync(synergiesPath)) {
    console.warn(`⚠️ Archivo de origen no encontrado en: ${synergiesPath}. Omitiendo carga inicial.`);
    return;
  }

  const counterSynergies = JSON.parse(fs.readFileSync(synergiesPath, 'utf-8'));
  const metaCache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) : {};

  // 1. Sentencias SQL preparadas
  const insertChampStmt = db.prepare(`
    INSERT INTO champions (
      id, name, lane, tier, win_rate, scaling_type, damage_type, class, 
      is_frontline, is_hypercarry, has_hard_cc, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      lane=excluded.lane,
      tier=excluded.tier,
      win_rate=excluded.win_rate,
      scaling_type=excluded.scaling_type,
      damage_type=excluded.damage_type,
      class=excluded.class,
      is_frontline=excluded.is_frontline,
      is_hypercarry=excluded.is_hypercarry,
      has_hard_cc=excluded.has_hard_cc,
      tags=excluded.tags
  `);

  const insertMatchupStmt = db.prepare(`
    INSERT INTO matchups (
      champion_id, opponent_id, lane, winrate, gold_diff, xp_diff, cs_diff, dominance_score, matchup_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(champion_id, opponent_id, lane, matchup_type) DO UPDATE SET
      winrate=excluded.winrate,
      gold_diff=excluded.gold_diff,
      xp_diff=excluded.xp_diff,
      cs_diff=excluded.cs_diff,
      dominance_score=excluded.dominance_score
  `);

  const insertSynergyStmt = db.prepare(`
    INSERT INTO synergies (
      champion_id, partner_id, lane, delta
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(champion_id, partner_id, lane) DO UPDATE SET
      delta=excluded.delta
  `);

  const insertBuildStmt = db.prepare(`
    INSERT INTO builds (
      champion_id, build_name, is_default, patch, summoners, runes, items, skills, tags, special_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateConfigStmt = db.prepare(`
    INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)
  `);

  // Crear mapa de nombres a IDs
  const nameIdMap: Record<string, number> = {};
  for (const c of Object.values(CHAMPIONS_DB)) {
    nameIdMap[normalizeKey(c.name)] = c.id;
  }

  // Ejecutar todo en una única transacción
  db.exec('BEGIN TRANSACTION;');

  try {
    // 2. Insertar campeones base
    console.log("➕ Insertando campeones base de Riot...");
    const basicChamps = Object.values(CHAMPIONS_DB);
    basicChamps.forEach(c => {
      const nameKey = c.name;
      const extra = counterSynergies[nameKey];

      insertChampStmt.run(
        c.id,
        c.name,
        extra?.lane || "UNKNOWN",
        5,
        50.0,
        "Mid",
        c.damageType || "Adaptive",
        c.class || "Unknown",
        c.isFrontline ? 1 : 0,
        c.isHypercarry ? 1 : 0,
        c.hasHardCC ? 1 : 0,
        JSON.stringify(c.tags || [])
      );
    });

    // 3. Procesar datos de counter-synergies
    console.log("🧬 Migrando matchups, sinergias y builds desde JSON...");
    Object.keys(counterSynergies).forEach(champName => {
      const champId = resolveChampionId(champName, nameIdMap);
      if (!champId) return;

      const data = counterSynergies[champName];
      const lane = data.lane || "UNKNOWN";

      // Curva de winrate
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

      const baseChamp = CHAMPIONS_DB[champId];
      insertChampStmt.run(
        champId,
        baseChamp.name,
        lane,
        5,
        50.0,
        scalingType,
        baseChamp.damageType || "Adaptive",
        baseChamp.class || "Unknown",
        baseChamp.isFrontline ? 1 : 0,
        baseChamp.isHypercarry ? 1 : 0,
        baseChamp.hasHardCC ? 1 : 0,
        JSON.stringify(baseChamp.tags || [])
      );

      // Matchups (Counters)
      const counters = data.counters || [];
      counters.forEach((cnt: any) => {
        const opponentId = resolveChampionId(cnt.name, nameIdMap);
        if (!opponentId) return;
        insertMatchupStmt.run(
          champId,
          opponentId,
          lane,
          cnt.winrate,
          parseInt(cnt.goldDiff || 0),
          parseInt(cnt.xpDiff || 0),
          parseFloat(cnt.csDiff || 0.0),
          parseFloat(cnt.dominanceScore || 0.0),
          'counter'
        );
      });

      // Matchups (God Matchups)
      const godMatchups = data.godMatchups || [];
      godMatchups.forEach((god: any) => {
        const opponentId = resolveChampionId(god.name, nameIdMap);
        if (!opponentId) return;
        insertMatchupStmt.run(
          champId,
          opponentId,
          lane,
          god.winrate,
          parseInt(god.goldDiff || 0),
          parseInt(god.xpDiff || 0),
          parseFloat(god.csDiff || 0.0),
          parseFloat(god.dominanceScore || 0.0),
          'god_matchup'
        );
      });

      // Sinergias
      const synergies = data.synergies || {};
      Object.keys(synergies).forEach(roleKey => {
        const partnerList = synergies[roleKey] || [];
        partnerList.forEach((syn: any) => {
          const partnerId = resolveChampionId(syn.name, nameIdMap);
          if (!partnerId) return;
          insertSynergyStmt.run(
            champId,
            partnerId,
            roleKey.toUpperCase(),
            parseFloat(syn.delta || 0.0)
          );
        });
      });

      // Builds
      if (data.buildData) {
        const b = data.buildData;
        insertBuildStmt.run(
          champId,
          "Recomendada",
          1,
          b.patch || "14.11",
          JSON.stringify(b.summoners || []),
          JSON.stringify(b.runes || {}),
          JSON.stringify(b.items || {}),
          JSON.stringify(b.skills || {}),
          JSON.stringify(["Default", lane]),
          JSON.stringify({ last_update: b.lastUpdate || new Date().toISOString() })
        );
      }
    });

    // 4. Sincronizar tiers y winrates desde el meta-cache.json si existe
    console.log("📊 Migrando tiers y winrates desde meta-cache...");
    Object.keys(metaCache).forEach(role => {
      const list = metaCache[role] || [];
      list.forEach((metaChamp: any) => {
        const champId = resolveChampionId(metaChamp.name, nameIdMap);
        if (!champId) return;

        const baseChamp = CHAMPIONS_DB[champId];
        const nameKey = baseChamp.name;
        const extra = counterSynergies[nameKey];
        const tierNum = parseInt(metaChamp.rank) || 5;
        const winRateNum = parseFloat(metaChamp.winRate) || 50.0;

        const currentChampStmt = db.prepare('SELECT lane, scaling_type FROM champions WHERE id = ?');
        const current = currentChampStmt.get(champId) as any;

        insertChampStmt.run(
          champId,
          baseChamp.name,
          current?.lane || extra?.lane || "UNKNOWN",
          tierNum,
          winRateNum,
          current?.scaling_type || "Mid",
          baseChamp.damageType || "Adaptive",
          baseChamp.class || "Unknown",
          baseChamp.isFrontline ? 1 : 0,
          baseChamp.isHypercarry ? 1 : 0,
          baseChamp.hasHardCC ? 1 : 0,
          JSON.stringify(baseChamp.tags || [])
        );
      });
    });

    // 5. Configurar marcas de tiempo para evitar ejecuciones de sync innecesarias
    updateConfigStmt.run('last_sync_timestamp', new Date().toISOString());
    updateConfigStmt.run('last_lane_sync_timestamp', new Date().toISOString());

    db.exec('COMMIT;');
    console.log("🎉 CARGA INICIAL COMPLETADA CON ÉXITO.");
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error("❌ Error durante la carga inicial de datos en SQLite. Transacción revertida.", err);
    throw err;
  }
}
