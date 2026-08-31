import fs from 'fs';
import path from 'path';
import { CHAMPIONS_DB } from '../data/championdb.js';

const normalizeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const API_NAME_MAP: Record<string, string> = {
  monkeyking: 'wukong',
  masteryi: 'maestroyi',
  nunu: 'nunuywillump',
  renata: 'renataglasc',
  bard: 'bardo'
};

function resolveChampionId(name: string, nameIdMap: Record<string, number>): number | null {
  const normalized = normalizeKey(name);
  if (nameIdMap[normalized]) return nameIdMap[normalized];
  const alias = API_NAME_MAP[normalized];
  if (alias && nameIdMap[alias]) return nameIdMap[alias];
  return null;
}

export function populateDatabase(db: any) {
  console.log('🏁 INICIANDO CARGA INICIAL DE DATOS EN SQLITE...');

  const cachePath = path.resolve(process.cwd(), 'src/lib/data/meta-cache.json');
  let metaCache: Record<string, any[]> = {};
  try {
    if (fs.existsSync(cachePath)) {
      metaCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    }
  } catch {
    metaCache = {};
  }

  const insertChampStmt = db.prepare(
    'INSERT INTO champions (id, name, lane, tier, win_rate, scaling_type, damage_type, class, is_frontline, is_hypercarry, has_hard_cc, tags, play_lanes, lanes_pickrate, lanes_stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, damage_type=excluded.damage_type, class=excluded.class, is_frontline=excluded.is_frontline, is_hypercarry=excluded.is_hypercarry, has_hard_cc=excluded.has_hard_cc, tags=excluded.tags'
  );
  const updateMetaStmt = db.prepare(
    'UPDATE champions SET lane = ?, tier = ?, win_rate = ?, play_lanes = ?, lanes_pickrate = ?, lanes_stats = ? WHERE id = ?'
  );

  const nameIdMap: Record<string, number> = {};
  Object.values(CHAMPIONS_DB).forEach((champ: any) => {
    nameIdMap[normalizeKey(champ.name)] = champ.id;
  });

  db.exec('BEGIN TRANSACTION;');
  try {
    Object.values(CHAMPIONS_DB).forEach((champ: any) => {
      insertChampStmt.run(
        champ.id, champ.name, 'UNKNOWN', 99, 50,
        champ.scalingType || 'Mid',
        champ.damageType || 'Adaptive',
        champ.class || 'Unknown',
        champ.isFrontline ? 1 : 0,
        champ.isHypercarry ? 1 : 0,
        champ.hasHardCC ? 1 : 0,
        JSON.stringify(champ.tags || []),
        '[]', '{}', '{}'
      );
    });

    const roleToLane: Record<string, string> = {
      top: 'TOP',
      jungle: 'JUNGLE',
      mid: 'MIDDLE',
      adc: 'BOTTOM',
      support: 'UTILITY'
    };
    const byChampion: Record<number, any[]> = {};

    Object.entries(metaCache).forEach(([role, entries]) => {
      (entries || []).forEach((entry: any) => {
        const championId = resolveChampionId(entry.name, nameIdMap);
        const lane = roleToLane[role];
        if (!championId || !lane) return;
        if (!byChampion[championId]) byChampion[championId] = [];
        byChampion[championId].push({ ...entry, lane });
      });
    });

    Object.entries(byChampion).forEach(([id, entries]) => {
      const parseRate = (value: unknown) => parseFloat(String(value || '').replace('%', '')) || 0;
      const best = [...entries].sort((a, b) => parseRate(b.pickRate) - parseRate(a.pickRate))[0];
      const totalPickRate = entries.reduce((sum, entry) => sum + parseRate(entry.pickRate), 0);
      const lanesPickrate: Record<string, number> = {};
      const lanesStats: Record<string, { tier: number; winRate: number }> = {};

      entries.forEach(entry => {
        const pickRate = parseRate(entry.pickRate);
        lanesPickrate[entry.lane] = totalPickRate > 0
          ? Number(((pickRate / totalPickRate) * 100).toFixed(1))
          : 0;
        lanesStats[entry.lane] = {
          tier: parseInt(entry.rank) || 99,
          winRate: parseRate(entry.winRate) || 50
        };
      });

      const playLanes = Object.entries(lanesPickrate)
        .filter(([, pickRate]) => pickRate > 5)
        .map(([lane]) => lane);
      if (playLanes.length === 0) playLanes.push(best.lane);

      updateMetaStmt.run(
        best.lane,
        parseInt(best.rank) || 99,
        parseRate(best.winRate) || 50,
        JSON.stringify(playLanes),
        JSON.stringify(lanesPickrate),
        JSON.stringify(lanesStats),
        Number(id)
      );
    });

    db.exec('COMMIT;');
    console.log('🎉 CARGA INICIAL COMPLETADA: campeones y tierlist guardados en SQLite.');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}
