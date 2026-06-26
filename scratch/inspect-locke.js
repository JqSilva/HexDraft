import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../hexdraft.db');
console.log('Abriendo BD en:', dbPath);
const db = new DatabaseSync(dbPath);

try {
  const row = db.prepare('SELECT * FROM champions WHERE name = ?').get('Locke');
  if (row) {
    console.log('✅ Locke encontrado en la base de datos local:');
    console.log(JSON.stringify(row, null, 2));
  } else {
    console.log('❌ Locke NO está en la base de datos local.');
  }
} catch (e) {
  console.error('Error al consultar base de datos:', e);
}
