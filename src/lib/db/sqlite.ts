// src/lib/db/sqlite.ts
import path from 'path';
import fs from 'node:fs';

let dbPath = '';
let db: any = null;

let DatabaseSyncClass: any = null;

if (typeof window === 'undefined') {
  const isDev = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
  if (isDev) {
    dbPath = path.resolve(process.cwd(), 'hexdraft.db');
  } else {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    const appDataDir = path.join(localAppData, 'HexDraft');
    if (!fs.existsSync(appDataDir)) {
      try {
        fs.mkdirSync(appDataDir, { recursive: true });
      } catch (e) {
        console.error(`❌ Error creando directorio AppData para base de datos:`, e);
      }
    }
    dbPath = path.join(appDataDir, 'hexdraft.db');
  }

  try {
    const sqliteMod = await import('node:sqlite');
    DatabaseSyncClass = sqliteMod.DatabaseSync;
    console.log(`🔌 Conectando a base de datos SQLite en: ${dbPath}`);
    db = new DatabaseSyncClass(dbPath);
  } catch (e) {
    console.warn('[SQLite] node:sqlite no disponible en este entorno.');
  }
}

export { dbPath, db };

export function checkpointDb() {
  try {
    if (db && typeof db.exec === 'function') {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      console.log(`🧹 WAL Checkpoint (TRUNCATE) ejecutado.`);
    }
  } catch (e) {
    console.warn('⚠️ Error al ejecutar WAL checkpoint:', e);
  }
}

export function closeDb() {
  try {
    if (db && typeof db.close === 'function') {
      db.close();
      console.log(`🔒 Conexión a la base de datos cerrada.`);
    }
  } catch (e) {
    console.error('❌ Error al cerrar la base de datos:', e);
  }
}

export function reopenDb() {
  try {
    if (DatabaseSyncClass) {
      db = new DatabaseSyncClass(dbPath);
      db.exec('PRAGMA foreign_keys = ON;');
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA synchronous = NORMAL;');
      console.log(`🔌 Conexión a la base de datos reabierta.`);
    }
  } catch (e) {
    console.error('❌ Error al reabrir la base de datos:', e);
  }
}

// Configuración inicial de rendimiento y restricciones
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;'); // Habilita Write-Ahead Logging para escrituras concurrentes rápidas
db.exec('PRAGMA synchronous = NORMAL;');

// Inicialización de la estructura de tablas relacionales
db.exec(`
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
    tags TEXT DEFAULT '[]', -- Array JSON de tags de juego
    
    -- Nuevos campos semánticos
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
`);

// Migración dinámica de columnas en champions por si el usuario tiene una base de datos existente
try {
  const tableInfo = db.prepare("PRAGMA table_info(champions)").all() as any[];
  const columns = tableInfo.map(c => c.name);
  const newCols = {
    tactic_role: "TEXT DEFAULT 'teamfight'",
    mobility: "TEXT DEFAULT 'medium'",
    target_priority: "TEXT DEFAULT 'any'",
    team_needs: "TEXT DEFAULT '[]'",
    team_provides: "TEXT DEFAULT '[]'",
    has_shield: "INTEGER DEFAULT 0",
    has_sustain: "INTEGER DEFAULT 0",
    lane_phase: "TEXT DEFAULT 'average'",
    resource_dependency: "TEXT DEFAULT 'medium'",
    play_lanes: "TEXT DEFAULT '[]'",
    lanes_pickrate: "TEXT DEFAULT '{}'",
    lanes_stats: "TEXT DEFAULT '{}'"
  };
  for (const [colName, colType] of Object.entries(newCols)) {
    if (!columns.includes(colName)) {
      console.log(`[MIGRATION] Añadiendo columna champions.${colName}...`);
      db.exec(`ALTER TABLE champions ADD COLUMN ${colName} ${colType};`);
    }
  }
} catch (e) {
  console.error("⚠️ Error en migración dinámica de columnas:", e);
}

// Nueva tabla de items semánticos
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    gold INTEGER DEFAULT 0,
    epicness TEXT DEFAULT 'basic', -- starter, basic, epic, legendary, mythic
    categories TEXT DEFAULT '[]',  -- JSON array de tags de Community Dragon
    icon_path TEXT
  );
`);

// Nueva tabla de historial del jugador
db.exec(`
  CREATE TABLE IF NOT EXISTS player_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT UNIQUE,
    champion_id INTEGER,
    lane TEXT,
    win INTEGER,           -- 1 = victoria, 0 = derrota
    kills INTEGER,
    deaths INTEGER,
    assists INTEGER,
    cs_per_min REAL,
    game_duration INTEGER, -- segundos
    patch TEXT,
    enemy_comp TEXT,       -- JSON array de IDs
    ally_comp TEXT,        -- JSON array de IDs
    items_built TEXT,      -- JSON array de IDs
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (champion_id) REFERENCES champions(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS matchups (
    champion_id INTEGER,
    opponent_id INTEGER,
    lane TEXT,
    winrate TEXT,
    gold_diff INTEGER DEFAULT 0,
    xp_diff INTEGER DEFAULT 0,
    cs_diff REAL DEFAULT 0.0,
    dominance_score REAL DEFAULT 0.0,
    matchup_type TEXT CHECK(matchup_type IN ('counter', 'god_matchup')),
    PRIMARY KEY (champion_id, opponent_id, lane, matchup_type),
    FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE,
    FOREIGN KEY (opponent_id) REFERENCES champions(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS synergies (
    champion_id INTEGER,
    partner_id INTEGER,
    lane TEXT,
    delta REAL DEFAULT 0.0,
    PRIMARY KEY (champion_id, partner_id, lane),
    FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES champions(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    champion_id INTEGER,
    build_name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0, -- 1 si es la build principal, 0 en caso contrario
    patch TEXT,
    summoners TEXT DEFAULT '[]', -- Array JSON de summoners
    runes TEXT DEFAULT '{}',      -- Objeto JSON con runas
    items TEXT DEFAULT '{}',      -- Objeto JSON con items (starter, boots, core)
    skills TEXT DEFAULT '{}',     -- Objeto JSON con orden de habilidades
    tags TEXT DEFAULT '[]',       -- Array JSON de tags (ej. ["AP", "Jungle", "Rhaast"])
    special_notes TEXT DEFAULT '{}', -- Notas específicas (ej. evoluciones, prioridades)
    lane TEXT DEFAULT 'UNKNOWN',  -- Carril al que pertenece esta build
    FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE
  );
`);

// Migración dinámica de columnas en builds
try {
  const tableInfo = db.prepare("PRAGMA table_info(builds)").all() as any[];
  const columns = tableInfo.map(c => c.name);
  if (!columns.includes('lane')) {
    console.log(`[MIGRATION] Añadiendo columna builds.lane...`);
    db.exec(`ALTER TABLE builds ADD COLUMN lane TEXT DEFAULT 'UNKNOWN';`);
  }
} catch (e) {
  console.error("⚠️ Error en migración dinámica de columnas builds:", e);
}

// Creación de la tabla de configuraciones
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Obtener ruta inicial de LoL desde hexdraft-config.json para preservar datos del usuario
let initialLolPath = 'C:\\Riot Games\\League of Legends\\lockfile';
try {
  const fs = await import('node:fs');
  const configJsonPath = path.resolve(process.cwd(), 'hexdraft-config.json');
  if (fs.existsSync(configJsonPath)) {
    const data = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
    if (data && typeof data.lolPath === 'string') {
      initialLolPath = data.lolPath;
    }
  }
} catch (e) {
  // Ignorar errores al leer el archivo viejo
}

const setInitialConfig = (key: string, val: string) => {
  db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)').run(key, val);
};

setInitialConfig('lol_path', initialLolPath);
setInitialConfig('auto_pick', 'false');
setInitialConfig('auto_ban', 'false');
setInitialConfig('auto_execute_seconds', '3.5');
setInitialConfig('puppeteer_concurrency', '3');
setInitialConfig('sync_period_days', '3');
setInitialConfig('lane_sync_period_days', '21');
setInitialConfig('last_sync_timestamp', '-');
setInitialConfig('last_lane_sync_timestamp', '-');
setInitialConfig('last_sync_version', '-');
setInitialConfig('meta_sync_frequency', '2');
setInitialConfig('last_meta_cache_sync', '-');
setInitialConfig('auto_accept_enabled', 'false');
setInitialConfig('auto_accept_delay_pct', '80');
setInitialConfig('telegram_notifications_enabled', 'false');
setInitialConfig('telegram_bot_token', '');
setInitialConfig('telegram_chat_id', '');
setInitialConfig('telegram_deduplicate_enabled', 'true');

// Actualizar engine_weights en config fusionándolo si ya existe, o insertándolo
const defaultWeights = {
  meta_base: 0.4,
  synergy: 2.2,
  matchup: 0.45,
  counter: 0.35,
  composition: 0.8,
  utility: 0.5,
  scaling: 1.0,
  tactic_role_bonus: 1.5,
  personal_mastery: 0.8,
  flex_value: 0.6,
  phase_multiplier_pick5: 1.4
};

try {
  const checkWeights = db.prepare('SELECT value FROM config WHERE key = ?').get('engine_weights') as { value: string } | undefined;
  if (checkWeights) {
    const existingWeights = JSON.parse(checkWeights.value);
    const mergedWeights = { ...defaultWeights, ...existingWeights };
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('engine_weights', JSON.stringify(mergedWeights));
  } else {
    db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)').run('engine_weights', JSON.stringify(defaultWeights));
  }
} catch (e) {
  console.error("⚠️ Error configurando engine_weights:", e);
}

// Creación de índices para optimizar consultas frecuentes
db.exec('CREATE INDEX IF NOT EXISTS idx_champions_lane ON champions(lane);');
db.exec('CREATE INDEX IF NOT EXISTS idx_matchups_champ_type ON matchups(champion_id, matchup_type);');
db.exec('CREATE INDEX IF NOT EXISTS idx_synergies_champ ON synergies(champion_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_builds_champ ON builds(champion_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_items_categories ON items(categories);');
db.exec('CREATE INDEX IF NOT EXISTS idx_player_history_champ ON player_history(champion_id);');

console.log('✅ Estructura de base de datos SQLite y tabla config inicializadas correctamente.');

// Si la tabla de campeones está vacía, realizamos una migración inicial desde el JSON de respaldo
try {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM champions');
  const result = countStmt.get() as { count: number };
  if (result.count === 0) {
    console.log('✏️ La base de datos SQLite está vacía. Realizando carga inicial desde JSON...');
    const { populateDatabase } = await import('./initial-populate.js');
    populateDatabase(db);
  } else {
    // Si la base de datos ya tiene datos, verificamos si falta algún campeón de CHAMPIONS_DB
    console.log('🔍 Verificando consistencia de campeones en SQLite...');
    let CHAMPIONS_DB;
    try {
      const mod = await import('../data/championdb.js');
      CHAMPIONS_DB = mod.CHAMPIONS_DB;
    } catch (e) {
      const mod = await import('../data/championdb.ts');
      CHAMPIONS_DB = mod.CHAMPIONS_DB;
    }
    const existingIdsStmt = db.prepare('SELECT id FROM champions');
    const existingIds = new Set((existingIdsStmt.all() as { id: number }[]).map(r => r.id));
    
    let addedCount = 0;
    db.exec('BEGIN TRANSACTION;');
    try {
      const insertChampStmt = db.prepare(`
        INSERT INTO champions (
          id, name, lane, tier, win_rate, scaling_type, damage_type, class, 
          is_frontline, is_hypercarry, has_hard_cc, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const champ of Object.values(CHAMPIONS_DB)) {
        if (!existingIds.has(champ.id)) {
          console.log(`➕ Insertando campeón faltante en BD: ${champ.name} (ID: ${champ.id})`);
          let defaultLane = (champ as any).lane;
          if (!defaultLane || defaultLane === "UNKNOWN") {
            if (champ.class === "Marksman") defaultLane = "BOTTOM";
            else if (champ.class === "Support") defaultLane = "UTILITY";
            else defaultLane = "MIDDLE";
          }

          insertChampStmt.run(
            champ.id,
            champ.name,
            defaultLane,
            5,
            50.0,
            champ.scalingType || "Mid",
            champ.damageType || "Adaptive",
            champ.class || "Unknown",
            champ.isFrontline ? 1 : 0,
            champ.isHypercarry ? 1 : 0,
            champ.hasHardCC ? 1 : 0,
            JSON.stringify(champ.tags || [])
          );
          addedCount++;
        }
      }
      db.exec('COMMIT;');
      if (addedCount > 0) {
        console.log(`🎉 Se agregaron ${addedCount} campeones nuevos a la base de datos.`);
      }
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('❌ Error al insertar campeones faltantes:', err);
    }
  }
} catch (err) {
  console.error('❌ Error al realizar la carga/verificación de datos en SQLite:', err);
}

// Iniciar el planificador automático de meta-cache en segundo plano
// Usamos setTimeout para romper el interbloqueo circular de ESM (Top-Level Await circular deadlock)
setTimeout(async () => {
  try {
    const isScript = process.argv[1]?.includes('migrate') || 
                     process.argv[1]?.includes('test-engine') || 
                     process.argv[1]?.includes('sync-champions-cdrag') ||
                     process.argv[1]?.includes('update-champion-db');
    if (isScript) return;

    const { startAutomaticMetaCacheScheduler } = await import('../services/sync.service.js');
    startAutomaticMetaCacheScheduler();
  } catch (e) {
    console.error('❌ Error al iniciar el planificador de meta-cache:', e);
  }
}, 500);
