import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../hexdraft.db');

console.log('--- TEST DE CONSISTENCIA DE BASE DE DATOS ---');
const db = new DatabaseSync(dbPath);

// 1. Borrar a Locke para simular el escenario del cliente
console.log('1. Eliminando temporalmente a Locke de la base de datos local...');
db.prepare('DELETE FROM champions WHERE name = ?').run('Locke');

// Verificar que se eliminó
const checkBefore = db.prepare('SELECT * FROM champions WHERE name = ?').get('Locke');
if (!checkBefore) {
  console.log('   Confirmado: Locke eliminado de la base de datos.');
} else {
  console.error('   Error: Locke no pudo ser eliminado.');
  process.exit(1);
}

// 2. Cargar src/lib/db/sqlite.ts para disparar la verificación e inserción automática
console.log('\n2. Importando sqlite.ts para disparar la consistencia...');
// Para evitar que el planificador de meta-cache inicie procesos asíncronos que dejen el script colgado,
// definimos argv de forma que se salte el scheduler
process.argv.push('update-champion-db');
await import('../src/lib/db/sqlite.ts');

// 3. Comprobar si Locke fue reinsertado automáticamente
console.log('\n3. Verificando si Locke fue reinsertado automáticamente...');
const checkAfter = db.prepare('SELECT * FROM champions WHERE name = ?').get('Locke');
if (checkAfter) {
  console.log('✅ ÉXITO: Locke fue reinsertado automáticamente!');
  console.log(JSON.stringify(checkAfter, null, 2));
} else {
  console.error('❌ ERROR: Locke NO fue reinsertado automáticamente.');
  process.exit(1);
}

console.log('\nTest finalizado con éxito.');
process.exit(0);
