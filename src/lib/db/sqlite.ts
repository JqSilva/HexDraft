// src/lib/db/sqlite.ts
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

// Ruta del archivo de base de datos en el directorio raíz del proyecto
const dbPath = path.resolve(process.cwd(), 'hexdraft.db');

console.log(`🔌 Conectando a base de datos SQLite en: ${dbPath}`);

export const db = new DatabaseSync(dbPath);

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
    tier INTEGER DEFAULT 5,
    win_rate REAL DEFAULT 50.0,
    scaling_type TEXT DEFAULT 'Mid',
    damage_type TEXT DEFAULT 'Adaptive',
    class TEXT,
    is_frontline INTEGER DEFAULT 0,
    is_hypercarry INTEGER DEFAULT 0,
    has_hard_cc INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]' -- Array JSON de tags de juego
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
    FOREIGN KEY (champion_id) REFERENCES champions(id) ON DELETE CASCADE
  );
`);

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

const insertConfigStmt = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
insertConfigStmt.run('lol_path', initialLolPath);
insertConfigStmt.run('auto_pick', 'false');
insertConfigStmt.run('auto_ban', 'false');
insertConfigStmt.run('auto_execute_seconds', '3.5');
insertConfigStmt.run('puppeteer_concurrency', '3');
insertConfigStmt.run('sync_period_days', '3');
insertConfigStmt.run('lane_sync_period_days', '21');
insertConfigStmt.run('last_sync_timestamp', '-');
insertConfigStmt.run('last_lane_sync_timestamp', '-');
insertConfigStmt.run('engine_weights', JSON.stringify({
  meta_base: 0.4,
  synergy: 2.2,
  matchup: 0.45,
  counter: 0.35,
  composition: 0.8,
  utility: 0.5,
  scaling: 1.0
}));

// Creación de índices para optimizar consultas frecuentes
db.exec('CREATE INDEX IF NOT EXISTS idx_champions_lane ON champions(lane);');
db.exec('CREATE INDEX IF NOT EXISTS idx_matchups_champ_type ON matchups(champion_id, matchup_type);');
db.exec('CREATE INDEX IF NOT EXISTS idx_synergies_champ ON synergies(champion_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_builds_champ ON builds(champion_id);');

console.log('✅ Estructura de base de datos SQLite y tabla config inicializadas correctamente.');

// Si la tabla de campeones está vacía, realizamos una migración inicial desde el JSON de respaldo
try {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM champions');
  const result = countStmt.get() as { count: number };
  if (result.count === 0) {
    console.log('✏️ La base de datos SQLite está vacía. Realizando carga inicial desde JSON...');
    const { populateDatabase } = await import('./initial-populate.js');
    populateDatabase(db);
  }
} catch (err) {
  console.error('❌ Error al realizar la carga inicial de datos en SQLite:', err);
}
