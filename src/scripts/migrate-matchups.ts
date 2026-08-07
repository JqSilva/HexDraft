import fs from 'node:fs';
import path from 'node:path';
import { db } from '../lib/db/sqlite.js';

interface MatchupRow {
  champion_id: number;
  opponent_id: number;
  lane: string;
  winrate: string | number;
  gold_diff: number;
  xp_diff: number;
  cs_diff: number;
  dominance_score: number;
  matchup_type: 'counter' | 'god_matchup';
}

interface ChampionRow {
  id: number;
  name: string;
}

export async function migrateMatchups() {
  console.log('[MIGRATION] Leyendo campeones de SQLite...');
  const champsStmt = db.prepare('SELECT id, name FROM champions');
  const champs = champsStmt.all() as ChampionRow[];
  const idToNameMap: Record<number, string> = {};
  champs.forEach(c => {
    idToNameMap[c.id] = c.name;
  });

  console.log('[MIGRATION] Leyendo matchups de SQLite...');
  const matchupsStmt = db.prepare(`
    SELECT champion_id, opponent_id, lane, winrate, gold_diff, xp_diff, cs_diff, dominance_score, matchup_type
    FROM matchups
  `);
  const rawMatchups = matchupsStmt.all() as MatchupRow[];

  const matchupsByChamp: Record<string, { counters: any[]; godMatchups: any[] }> = {};

  let totalMatchupsCount = 0;
  rawMatchups.forEach(m => {
    const champName = idToNameMap[m.champion_id];
    const opponentName = idToNameMap[m.opponent_id];
    if (!champName || !opponentName) return;

    if (!matchupsByChamp[champName]) {
      matchupsByChamp[champName] = { counters: [], godMatchups: [] };
    }

    const goldDiff = Number(m.gold_diff) || 0;
    const xpDiff = Number(m.xp_diff) || 0;

    const item = {
      name: opponentName,
      winrate: String(m.winrate ?? '50.0'),
      goldDiff: String(goldDiff),
      xpDiff: String(xpDiff),
      csDiff: String(m.cs_diff ?? 0),
      count: 500,
      laneTag: (goldDiff + xpDiff) > 200 ? 'Good Lane' : 'Bad Lane',
      dominanceScore: Number(m.dominance_score) || 0.0
    };

    if (m.matchup_type === 'counter') {
      matchupsByChamp[champName].counters.push(item);
    } else if (m.matchup_type === 'god_matchup') {
      matchupsByChamp[champName].godMatchups.push(item);
    }
    totalMatchupsCount++;
  });

  const jsonPath = path.resolve(process.cwd(), 'src/lib/data/counter-synergies.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`[MIGRATION] Archivo no encontrado: ${jsonPath}`);
  }

  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  let updatedCount = 0;
  let missingMatchupsCount = 0;

  Object.keys(jsonContent).forEach(champName => {
    const data = jsonContent[champName];
    const extracted = matchupsByChamp[champName];

    if (extracted && (extracted.counters.length > 0 || extracted.godMatchups.length > 0)) {
      data.counters = extracted.counters.sort((a: any, b: any) => a.dominanceScore - b.dominanceScore);
      data.godMatchups = extracted.godMatchups.sort((a: any, b: any) => b.dominanceScore - a.dominanceScore);
      updatedCount++;
    } else {
      data.counters = [];
      data.godMatchups = [];
      missingMatchupsCount++;
    }
  });

  fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf-8');

  console.log(`[MIGRATION] Migración completada. Registros procesados de SQLite: ${totalMatchupsCount}`);
  console.log(`[MIGRATION] Campeones actualizados con matchups: ${updatedCount}`);
  console.log(`[MIGRATION] Campeones sin matchups en SQLite: ${missingMatchupsCount}`);

  if (updatedCount === 0) {
    console.error('[MIGRATION] ERROR: Se encontraron 0 counters migrados desde SQLite. Deteniendo proceso.');
    process.exit(1);
  }
}

migrateMatchups().catch(err => {
  console.error('[MIGRATION] Error durante la migración:', err);
  process.exit(1);
});
