import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

// Read-only inventory: never import application services or start the scheduler.
const db = new DatabaseSync(path.resolve(process.argv[2] || 'hexdraft.db'), { readOnly: true });
try {
  const champions = db.prepare('SELECT count(*) AS total FROM champions').get().total;
  const builds = db.prepare('SELECT count(*) AS total FROM builds').get().total;
  const patches = db.prepare('SELECT patch, count(*) AS builds FROM builds GROUP BY patch ORDER BY patch').all();
  const adaptive = db.prepare(`
    SELECT c.name, b.lane, b.patch,
      json_array_length(json_extract(b.special_notes, '$.statsData.runes.pages')) AS pages,
      json_array_length(json_extract(b.special_notes, '$.statsData.coreBuilds.coreItem3')) AS cores
    FROM builds b JOIN champions c ON c.id = b.champion_id
    WHERE json_extract(b.special_notes, '$.statsData') IS NOT NULL
  `).all();
  console.log(JSON.stringify({ champions, builds, patches, adaptive }, null, 2));
} finally {
  db.close();
}
