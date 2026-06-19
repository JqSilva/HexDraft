// src/lib/db/champions.repo.ts
import { db } from './sqlite';

export interface DbChampion {
  id: number;
  name: string;
  lane: string;
  tier: number;
  win_rate: number;
  scaling_type: string;
  damage_type: string;
  class: string;
  is_frontline: number;
  is_hypercarry: number;
  has_hard_cc: number;
  tags: string; // JSON string
  
  // Nuevos campos semánticos
  tactic_role?: string;
  mobility?: string;
  target_priority?: string;
  team_needs?: string; // JSON string
  team_provides?: string; // JSON string
  has_shield?: number;
  has_sustain?: number;
  lane_phase?: string;
  resource_dependency?: string;
  play_lanes?: string; // JSON string
  lanes_pickrate?: string; // JSON string
  lanes_stats?: string; // JSON string
}

export interface DbMatchup {
  champion_id: number;
  opponent_id: number;
  lane: string;
  winrate: string;
  gold_diff: number;
  xp_diff: number;
  cs_diff: number;
  dominance_score: number;
  matchup_type: 'counter' | 'god_matchup';
}

export interface DbSynergy {
  champion_id: number;
  partner_id: number;
  lane: string;
  delta: number;
}

export interface DbBuild {
  id?: number;
  champion_id: number;
  build_name: string;
  is_default: number;
  patch: string;
  summoners: string; // JSON string
  runes: string;      // JSON string
  items: string;      // JSON string
  skills: string;     // JSON string
  tags: string;       // JSON string
  special_notes: string; // JSON string
  lane?: string;
}

// === PREPARED STATEMENTS FOR WRITES (Para optimizar rendimiento) ===
const insertChampStmt = db.prepare(`
  INSERT INTO champions (
    id, name, lane, tier, win_rate, scaling_type, damage_type, class, 
    is_frontline, is_hypercarry, has_hard_cc, tags,
    tactic_role, mobility, target_priority, team_needs, team_provides, has_shield, has_sustain, lane_phase, resource_dependency,
    play_lanes, lanes_pickrate, lanes_stats
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    tags=excluded.tags,
    tactic_role=excluded.tactic_role,
    mobility=excluded.mobility,
    target_priority=excluded.target_priority,
    team_needs=excluded.team_needs,
    team_provides=excluded.team_provides,
    has_shield=excluded.has_shield,
    has_sustain=excluded.has_sustain,
    lane_phase=excluded.lane_phase,
    resource_dependency=excluded.resource_dependency,
    play_lanes=excluded.play_lanes,
    lanes_pickrate=excluded.lanes_pickrate,
    lanes_stats=excluded.lanes_stats;
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
    dominance_score=excluded.dominance_score;
`);

const insertSynergyStmt = db.prepare(`
  INSERT INTO synergies (
    champion_id, partner_id, lane, delta
  ) VALUES (?, ?, ?, ?)
  ON CONFLICT(champion_id, partner_id, lane) DO UPDATE SET
    delta=excluded.delta;
`);

const insertBuildStmt = db.prepare(`
  INSERT INTO builds (
    champion_id, build_name, is_default, patch, summoners, runes, items, skills, tags, special_notes, lane
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// === REPOSITORY METHODS ===

export const championsRepo = {
  // Limpiar tablas antes de resincronizaciones o migraciones
  clearAllData() {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('DELETE FROM builds;');
    db.exec('DELETE FROM synergies;');
    db.exec('DELETE FROM matchups;');
    db.exec('DELETE FROM champions;');
    db.exec('PRAGMA foreign_keys = ON;');
  },

  // Guardar un campeón básico
  saveChampion(champ: DbChampion) {
    insertChampStmt.run(
      champ.id,
      champ.name,
      champ.lane,
      champ.tier,
      champ.win_rate,
      champ.scaling_type,
      champ.damage_type,
      champ.class,
      champ.is_frontline,
      champ.is_hypercarry,
      champ.has_hard_cc,
      champ.tags,
      champ.tactic_role ?? 'teamfight',
      champ.mobility ?? 'medium',
      champ.target_priority ?? 'any',
      champ.team_needs ?? '[]',
      champ.team_provides ?? '[]',
      champ.has_shield ?? 0,
      champ.has_sustain ?? 0,
      champ.lane_phase ?? 'average',
      champ.resource_dependency ?? 'medium',
      champ.play_lanes ?? '[]',
      champ.lanes_pickrate ?? '{}',
      champ.lanes_stats ?? '{}'
    );
  },

  // Guardar un matchup
  saveMatchup(matchup: DbMatchup) {
    insertMatchupStmt.run(
      matchup.champion_id,
      matchup.opponent_id,
      matchup.lane,
      matchup.winrate,
      matchup.gold_diff,
      matchup.xp_diff,
      matchup.cs_diff,
      matchup.dominance_score,
      matchup.matchup_type
    );
  },

  // Guardar una sinergia
  saveSynergy(synergy: DbSynergy) {
    insertSynergyStmt.run(
      synergy.champion_id,
      synergy.partner_id,
      synergy.lane,
      synergy.delta
    );
  },

  // Guardar una build (Elimina las builds anteriores del champ si es una sincronización fresca)
  clearBuilds(championId: number, lane?: string) {
    if (lane) {
      const stmt = db.prepare('DELETE FROM builds WHERE champion_id = ? AND lane = ?');
      stmt.run(championId, lane);
    } else {
      const stmt = db.prepare('DELETE FROM builds WHERE champion_id = ?');
      stmt.run(championId);
    }
  },

  saveBuild(build: DbBuild) {
    insertBuildStmt.run(
      build.champion_id,
      build.build_name,
      build.is_default,
      build.patch,
      build.summoners,
      build.runes,
      build.items,
      build.skills,
      build.tags,
      build.special_notes,
      build.lane ?? 'UNKNOWN'
    );
  },

  // Consultar todos los nombres de campeones y sus IDs
  getChampionIdNameMap(): Record<string, number> {
    const query = db.prepare('SELECT id, name FROM champions');
    const rows = query.all() as { id: number; name: string }[];
    const map: Record<string, number> = {};
    rows.forEach(r => {
      map[r.name.toLowerCase().replace(/[^a-z0-9]/g, "")] = r.id;
    });
    return map;
  },

  getChampionNameIdMap(): Record<number, string> {
    const query = db.prepare('SELECT id, name FROM champions');
    const rows = query.all() as { id: number; name: string }[];
    const map: Record<number, string> = {};
    rows.forEach(r => {
      map[r.id] = r.name;
    });
    return map;
  },

  // Recupera la lista completa de campeones con todos sus datos anidados estructurados
  // para alimentar el motor en memoria (dataProvider.ts)
  getAllEnrichedChampions(): any[] {
    const champsQuery = db.prepare('SELECT * FROM champions');
    const champs = champsQuery.all() as DbChampion[];

    const nameIdMap = this.getChampionNameIdMap();

    return champs.map(c => {
      const champId = c.id;

      // 1. Obtener matchups (counters y godMatchups)
      const matchupsStmt = db.prepare(`
        SELECT opponent_id, lane, winrate, gold_diff, xp_diff, cs_diff, dominance_score, matchup_type 
        FROM matchups 
        WHERE champion_id = ?
      `);
      const rawMatchups = matchupsStmt.all(champId) as any[];

      const counters: any[] = [];
      const godMatchups: any[] = [];
      rawMatchups.forEach(m => {
        const opponentName = nameIdMap[m.opponent_id] || `Unknown (${m.opponent_id})`;
        const matchupObj = {
          name: opponentName,
          lane: m.lane,
          winrate: m.winrate,
          goldDiff: String(m.gold_diff),
          xpDiff: String(m.xp_diff),
          csDiff: String(m.cs_diff),
          count: 500, // Valor dummy para compatibilidad
          laneTag: m.gold_diff + m.xp_diff > 200 ? "Good Lane" : "Bad Lane",
          dominanceScore: m.dominance_score
        };

        if (m.matchup_type === 'counter') {
          counters.push(matchupObj);
        } else {
          godMatchups.push(matchupObj);
        }
      });

      // 2. Obtener sinergias
      const synergiesStmt = db.prepare(`
        SELECT partner_id, lane, delta 
        FROM synergies 
        WHERE champion_id = ?
      `);
      const rawSynergies = synergiesStmt.all(champId) as any[];

      const synergies: Record<string, Array<{ name: string; delta: string }>> = {};
      rawSynergies.forEach(s => {
        const partnerName = nameIdMap[s.partner_id] || `Unknown (${s.partner_id})`;
        const pos = s.lane.toLowerCase();
        if (!synergies[pos]) synergies[pos] = [];
        synergies[pos].push({
          name: partnerName,
          delta: String(s.delta)
        });
      });

      // 3. Obtener todas las builds
      const buildsStmt = db.prepare(`
        SELECT * FROM builds 
        WHERE champion_id = ?
        ORDER BY is_default DESC
      `);
      const rawBuilds = buildsStmt.all(champId) as DbBuild[];

      const builds = rawBuilds.map(b => ({
        id: b.id,
        build_name: b.build_name,
        is_default: b.is_default === 1,
        patch: b.patch,
        summoners: JSON.parse(b.summoners),
        runes: JSON.parse(b.runes),
        items: JSON.parse(b.items),
        skills: JSON.parse(b.skills),
        tags: JSON.parse(b.tags),
        special_notes: JSON.parse(b.special_notes),
        lane: b.lane
      }));

      const buildData = builds.find(b => b.is_default) || builds[0] || null;

      // Reconstruir curva de winrate dummy o basada en base de datos en el futuro
      const tagsList = JSON.parse(c.tags);

      return {
        id: c.id,
        name: c.name,
        lane: c.lane,
        tags: tagsList,
        damageType: c.damage_type,
        class: c.class,
        isFrontline: c.is_frontline === 1,
        isHypercarry: c.is_hypercarry === 1,
        hasHardCC: c.has_hard_cc === 1,
        
        // Nuevos campos semánticos
        tacticRole: c.tactic_role || 'teamfight',
        mobility: c.mobility || 'medium',
        targetPriority: c.target_priority || 'any',
        teamNeeds: JSON.parse(c.team_needs || '[]'),
        teamProvides: JSON.parse(c.team_provides || '[]'),
        hasShield: c.has_shield === 1,
        hasSustain: c.has_sustain === 1,
        lanePhase: c.lane_phase || 'average',
        resourceDependency: c.resource_dependency || 'medium',

        meta: {
          winRate: c.win_rate,
          tier: c.tier
        },
        playLanes: JSON.parse(c.play_lanes || '[]'),
        lanesPickrate: JSON.parse(c.lanes_pickrate || '{}'),
        lanesStats: JSON.parse(c.lanes_stats || '{}'),
        scalingType: c.scaling_type,
        combat: {
          damageComposition: { physical: c.damage_type === 'AD' ? 80 : 20, magic: c.damage_type === 'AP' ? 80 : 20, true: 0 },
          winrateCurve: c.scaling_type === 'Early' ? [52, 51, 50, 49, 48, 47] : (c.scaling_type === 'Late' ? [48, 49, 50, 51, 52, 53] : [50, 50, 50, 50, 50, 50])
        },
        counters: counters.sort((a, b) => a.dominanceScore - b.dominanceScore),
        godMatchups: godMatchups.sort((a, b) => b.dominanceScore - a.dominanceScore),
        synergies,
        buildData,
        builds
      };
    });
  }
};
