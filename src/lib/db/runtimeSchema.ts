import type { DatabaseSync } from 'node:sqlite';

type SqliteConnection = Pick<DatabaseSync, 'exec' | 'prepare'>;

const logMigration = (message: string, logger?: (message: string) => void) => {
  (logger || console.log)('[MIGRATION] ' + message);
};

function tableInfo(connection: SqliteConnection, table: string): any[] {
  return connection.prepare('PRAGMA table_info(' + table + ')').all() as any[];
}

function ensureColumns(connection: SqliteConnection, table: string, definitions: Record<string, string>, logger?: (message: string) => void): void {
  const columns = new Set(tableInfo(connection, table).map(column => column.name));
  for (const [name, type] of Object.entries(definitions)) {
    if (columns.has(name)) continue;
    logMigration('Añadiendo columna ' + table + '.' + name + '...', logger);
    connection.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + type + ';');
  }
}

function ensureMatchupsSchema(connection: SqliteConnection, logger?: (message: string) => void): void {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS matchups (
      champion_id INTEGER,
      opponent_id INTEGER,
      lane TEXT,
      winrate TEXT,
      gold_diff INTEGER DEFAULT 0,
      xp_diff INTEGER DEFAULT 0,
      cs_diff REAL DEFAULT 0.0,
      dominance_score REAL DEFAULT 0.0,
      pickrate REAL DEFAULT 0.0,
      games INTEGER DEFAULT 0,
      delta1 REAL DEFAULT 0.0,
      delta2 REAL DEFAULT 0.0,
      lane_tag TEXT DEFAULT '',
      matchup_type TEXT CHECK(matchup_type IN ('counter', 'god_matchup')),
      PRIMARY KEY (champion_id, opponent_id, lane, matchup_type),
      FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE,
      FOREIGN KEY (opponent_id) REFERENCES champions(id) ON DELETE CASCADE
    );
  `);
  ensureColumns(connection, 'matchups', {
    lane: 'TEXT',
    winrate: "TEXT DEFAULT ''",
    gold_diff: 'INTEGER DEFAULT 0',
    xp_diff: 'REAL DEFAULT 0.0',
    cs_diff: 'REAL DEFAULT 0.0',
    dominance_score: 'REAL DEFAULT 0.0',
    matchup_type: "TEXT CHECK(matchup_type IN ('counter', 'god_matchup'))",
    pickrate: 'REAL DEFAULT 0.0',
    games: 'INTEGER DEFAULT 0',
    delta1: 'REAL DEFAULT 0.0',
    delta2: 'REAL DEFAULT 0.0',
    lane_tag: "TEXT DEFAULT ''"
  }, logger);
  const info = tableInfo(connection, 'matchups');
  const columns = new Set(info.map(column => column.name));
  const primaryKey = info.filter(column => Number(column.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map(column => column.name);
  const expectedPrimaryKey = ['champion_id', 'opponent_id', 'lane', 'matchup_type'];
  const hasExpectedPrimaryKey = primaryKey.length === expectedPrimaryKey.length && primaryKey.every((name, index) => name === expectedPrimaryKey[index]);
  if (!columns.has('matchup_type') || !hasExpectedPrimaryKey) {
    logMigration('Actualizando la clave de matchups para incluir el tipo de relación...', logger);
    const legacyHasType = columns.has('matchup_type');
    const typeExpression = legacyHasType ? "CASE WHEN matchup_type IN ('counter', 'god_matchup') THEN matchup_type ELSE 'counter' END" : "'counter'";
    connection.exec('SAVEPOINT matchup_schema;');
    try {
      connection.exec(`
        ALTER TABLE matchups RENAME TO matchups_legacy;
        CREATE TABLE matchups (
          champion_id INTEGER,
          opponent_id INTEGER,
          lane TEXT,
          winrate TEXT,
          gold_diff INTEGER DEFAULT 0,
          xp_diff REAL DEFAULT 0.0,
          cs_diff REAL DEFAULT 0.0,
          dominance_score REAL DEFAULT 0.0,
          pickrate REAL DEFAULT 0.0,
          games INTEGER DEFAULT 0,
          delta1 REAL DEFAULT 0.0,
          delta2 REAL DEFAULT 0.0,
          lane_tag TEXT DEFAULT '',
          matchup_type TEXT CHECK(matchup_type IN ('counter', 'god_matchup')),
          PRIMARY KEY (champion_id, opponent_id, lane, matchup_type),
          FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE,
          FOREIGN KEY (opponent_id) REFERENCES champions(id) ON DELETE CASCADE
        );
        INSERT OR IGNORE INTO matchups (
          champion_id, opponent_id, lane, winrate, gold_diff, xp_diff, cs_diff,
          dominance_score, pickrate, games, delta1, delta2, lane_tag, matchup_type
        )
        SELECT champion_id, opponent_id, lane, winrate, gold_diff, xp_diff, cs_diff,
          dominance_score, pickrate, games, delta1, delta2, lane_tag, ${typeExpression}
        FROM matchups_legacy;
        DROP TABLE matchups_legacy;
      `);
      connection.exec('RELEASE SAVEPOINT matchup_schema;');
    } catch (error) {
      try {
        connection.exec('ROLLBACK TO SAVEPOINT matchup_schema;');
        connection.exec('RELEASE SAVEPOINT matchup_schema;');
      } catch { /* best effort cleanup */ }
      throw error;
    }
  }
}

function ensureSynergiesSchema(connection: SqliteConnection, logger?: (message: string) => void): void {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS synergies (
      champion_id INTEGER,
      partner_id INTEGER,
      lane TEXT,
      source_lane TEXT NOT NULL DEFAULT 'UNKNOWN',
      delta REAL DEFAULT 0.0,
      winrate TEXT DEFAULT '',
      pickrate REAL DEFAULT 0.0,
      games INTEGER DEFAULT 0,
      delta1 REAL DEFAULT 0.0,
      delta2 REAL DEFAULT 0.0,
      lane_tag TEXT DEFAULT '',
      PRIMARY KEY (champion_id, partner_id, lane, source_lane),
      FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE,
      FOREIGN KEY (partner_id) REFERENCES champions(id) ON DELETE CASCADE
    );
  `);
  ensureColumns(connection, 'synergies', {
    source_lane: "TEXT NOT NULL DEFAULT 'UNKNOWN'",
    delta: 'REAL DEFAULT 0.0',
    winrate: "TEXT DEFAULT ''",
    pickrate: 'REAL DEFAULT 0.0',
    games: 'INTEGER DEFAULT 0',
    delta1: 'REAL DEFAULT 0.0',
    delta2: 'REAL DEFAULT 0.0',
    lane_tag: "TEXT DEFAULT ''"
  }, logger);
  const info = tableInfo(connection, 'synergies');
  const columns = new Set(info.map(column => column.name));
  const primaryKey = info.filter(column => Number(column.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map(column => column.name);
  const expectedPrimaryKey = ['champion_id', 'partner_id', 'lane', 'source_lane'];
  const hasExpectedPrimaryKey = primaryKey.length === expectedPrimaryKey.length && primaryKey.every((name, index) => name === expectedPrimaryKey[index]);
  if (!columns.has('source_lane') || !hasExpectedPrimaryKey) {
    logMigration('Actualizando la clave de synergies para incluir el carril de origen...', logger);
    const legacyHasSourceLane = columns.has('source_lane');
    const sourceExpression = legacyHasSourceLane ? "COALESCE(NULLIF(source_lane, ''), 'UNKNOWN')" : "'UNKNOWN'";
    connection.exec('SAVEPOINT synergy_schema;');
    try {
      connection.exec(`
        ALTER TABLE synergies RENAME TO synergies_legacy;
        CREATE TABLE synergies (
          champion_id INTEGER,
          partner_id INTEGER,
          lane TEXT,
          source_lane TEXT NOT NULL DEFAULT 'UNKNOWN',
          delta REAL DEFAULT 0.0,
          winrate TEXT DEFAULT '',
          pickrate REAL DEFAULT 0.0,
          games INTEGER DEFAULT 0,
          delta1 REAL DEFAULT 0.0,
          delta2 REAL DEFAULT 0.0,
          lane_tag TEXT DEFAULT '',
          PRIMARY KEY (champion_id, partner_id, lane, source_lane),
          FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE,
          FOREIGN KEY (partner_id) REFERENCES champions(id) ON DELETE CASCADE
        );
        INSERT OR IGNORE INTO synergies (
          champion_id, partner_id, lane, source_lane, delta, winrate, pickrate,
          games, delta1, delta2, lane_tag
        )
        SELECT champion_id, partner_id, lane, ${sourceExpression}, delta, winrate,
          pickrate, games, delta1, delta2, lane_tag
        FROM synergies_legacy;
        DROP TABLE synergies_legacy;
      `);
      connection.exec('RELEASE SAVEPOINT synergy_schema;');
    } catch (error) {
      try {
        connection.exec('ROLLBACK TO SAVEPOINT synergy_schema;');
        connection.exec('RELEASE SAVEPOINT synergy_schema;');
      } catch { /* best effort cleanup */ }
      throw error;
    }
  }
}

export function ensureRuntimeSchema(connection: SqliteConnection, logger?: (message: string) => void): void {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS champions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      lane TEXT,
      tier INTEGER DEFAULT 99,
      win_rate REAL DEFAULT 50.0,
      scaling_type TEXT DEFAULT 'Mid',
      damage_type TEXT DEFAULT 'Adaptive',
      class TEXT,
      is_frontline INTEGER DEFAULT 0,
      is_hypercarry INTEGER DEFAULT 0,
      has_hard_cc INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      tactic_role TEXT DEFAULT 'teamfight',
      mobility TEXT DEFAULT 'medium',
      target_priority TEXT DEFAULT 'any',
      team_needs TEXT DEFAULT '[]',
      team_provides TEXT DEFAULT '[]',
      has_shield INTEGER DEFAULT 0,
      has_sustain INTEGER DEFAULT 0,
      lane_phase TEXT DEFAULT 'average',
      resource_dependency TEXT DEFAULT 'medium',
      play_lanes TEXT DEFAULT '[]',
      lanes_pickrate TEXT DEFAULT '{}',
      lanes_stats TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      gold INTEGER DEFAULT 0,
      epicness TEXT DEFAULT 'basic',
      categories TEXT DEFAULT '[]',
      icon_path TEXT
    );
    CREATE TABLE IF NOT EXISTS player_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT UNIQUE,
      champion_id INTEGER,
      lane TEXT,
      win INTEGER,
      kills INTEGER,
      deaths INTEGER,
      assists INTEGER,
      cs_per_min REAL,
      game_duration INTEGER,
      patch TEXT,
      enemy_comp TEXT,
      ally_comp TEXT,
      items_built TEXT,
      recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (champion_id) REFERENCES champions(id)
    );
    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      champion_id INTEGER,
      build_name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      patch TEXT,
      summoners TEXT DEFAULT '[]',
      runes TEXT DEFAULT '{}',
      items TEXT DEFAULT '{}',
      skills TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      special_notes TEXT DEFAULT '{}',
      lane TEXT DEFAULT 'UNKNOWN',
      FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  ensureColumns(connection, 'champions', {
    lane: 'TEXT',
    tier: 'INTEGER DEFAULT 99',
    win_rate: 'REAL DEFAULT 50.0',
    scaling_type: "TEXT DEFAULT 'Mid'",
    damage_type: "TEXT DEFAULT 'Adaptive'",
    class: 'TEXT',
    is_frontline: 'INTEGER DEFAULT 0',
    is_hypercarry: 'INTEGER DEFAULT 0',
    has_hard_cc: 'INTEGER DEFAULT 0',
    tags: "TEXT DEFAULT '[]'",
    tactic_role: "TEXT DEFAULT 'teamfight'",
    mobility: "TEXT DEFAULT 'medium'",
    target_priority: "TEXT DEFAULT 'any'",
    team_needs: "TEXT DEFAULT '[]'",
    team_provides: "TEXT DEFAULT '[]'",
    has_shield: 'INTEGER DEFAULT 0',
    has_sustain: 'INTEGER DEFAULT 0',
    lane_phase: "TEXT DEFAULT 'average'",
    resource_dependency: "TEXT DEFAULT 'medium'",
    play_lanes: "TEXT DEFAULT '[]'",
    lanes_pickrate: "TEXT DEFAULT '{}'",
    lanes_stats: "TEXT DEFAULT '{}'"
  }, logger);
  ensureMatchupsSchema(connection, logger);
  ensureSynergiesSchema(connection, logger);
  ensureColumns(connection, 'builds', {
    champion_id: 'INTEGER',
    build_name: "TEXT DEFAULT 'Recomendada'",
    is_default: 'INTEGER DEFAULT 0',
    patch: 'TEXT',
    summoners: "TEXT DEFAULT '[]'",
    runes: "TEXT DEFAULT '{}'",
    items: "TEXT DEFAULT '{}'",
    skills: "TEXT DEFAULT '{}'",
    tags: "TEXT DEFAULT '[]'",
    special_notes: "TEXT DEFAULT '{}'",
    lane: "TEXT DEFAULT 'UNKNOWN'"
  }, logger);
  connection.exec(`
    CREATE INDEX IF NOT EXISTS idx_champions_lane ON champions(lane);
    CREATE INDEX IF NOT EXISTS idx_matchups_champ_type ON matchups(champion_id, matchup_type);
    CREATE INDEX IF NOT EXISTS idx_synergies_champ ON synergies(champion_id);
    CREATE INDEX IF NOT EXISTS idx_builds_champ ON builds(champion_id);
    CREATE INDEX IF NOT EXISTS idx_items_categories ON items(categories);
    CREATE INDEX IF NOT EXISTS idx_player_history_champ ON player_history(champion_id);
    PRAGMA user_version = 4;
  `);
}
