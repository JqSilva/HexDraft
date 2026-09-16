import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ensureRuntimeSchema } from '../src/lib/db/runtimeSchema.js';

const filePath = path.join(os.tmpdir(), `hexdraft-schema-${process.pid}-${Date.now()}.db`);
const db = new DatabaseSync(filePath);

try {
  // Simulate the schema shipped by an older scheduled database release.
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE champions (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE synergies (
      champion_id INTEGER,
      partner_id INTEGER,
      lane TEXT,
      delta REAL DEFAULT 0,
      winrate TEXT DEFAULT '',
      pickrate REAL DEFAULT 0,
      games INTEGER DEFAULT 0,
      delta1 REAL DEFAULT 0,
      delta2 REAL DEFAULT 0,
      lane_tag TEXT DEFAULT '',
      PRIMARY KEY (champion_id, partner_id, lane)
    );
    CREATE TABLE matchups (
      champion_id INTEGER,
      opponent_id INTEGER,
      lane TEXT,
      winrate TEXT,
      gold_diff INTEGER DEFAULT 0,
      xp_diff INTEGER DEFAULT 0,
      cs_diff REAL DEFAULT 0,
      dominance_score REAL DEFAULT 0,

      PRIMARY KEY (champion_id, opponent_id, lane)
    );
    CREATE TABLE builds (
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
      special_notes TEXT DEFAULT '{}'
    );
    INSERT INTO champions (id, name) VALUES (1, 'Legacy'), (2, 'Partner');
    INSERT INTO synergies (champion_id, partner_id, lane, delta) VALUES (1, 2, 'BOTTOM', 1.5);
    INSERT INTO matchups (champion_id, opponent_id, lane, winrate, dominance_score) VALUES (1, 2, 'MIDDLE', '48%', -2.5);
  `);

  ensureRuntimeSchema(db);

  const synergyInfo = db.prepare('PRAGMA table_info(synergies)').all() as any[];
  assert.ok(synergyInfo.some(column => column.name === 'source_lane'));
  assert.deepEqual(
    synergyInfo.filter(column => Number(column.pk) > 0).sort((a, b) => a.pk - b.pk).map(column => column.name),
    ['champion_id', 'partner_id', 'lane', 'source_lane']
  );
  assert.equal(db.prepare('SELECT source_lane FROM synergies').get()?.source_lane, 'UNKNOWN');
  assert.ok((db.prepare('PRAGMA table_info(builds)').all() as any[]).some(column => column.name === 'lane'));
  assert.ok((db.prepare('PRAGMA table_info(matchups)').all() as any[]).some(column => column.name === 'delta1'));
  const matchupInfo = db.prepare('PRAGMA table_info(matchups)').all() as any[];
  assert.deepEqual(matchupInfo.filter(column => Number(column.pk) > 0).sort((a, b) => a.pk - b.pk).map(column => column.name), ['champion_id', 'opponent_id', 'lane', 'matchup_type']);
  assert.equal(db.prepare('SELECT matchup_type FROM matchups').get()?.matchup_type, 'counter');
  assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, 4);
  console.log('[PASS] Las bases antiguas se migran al esquema runtime actual');
} finally {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(`${filePath}${suffix}`); } catch { /* ya eliminado */ }
  }
}
