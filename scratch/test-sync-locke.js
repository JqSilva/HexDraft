import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../hexdraft.db');

console.log('--- TEST DE SINCRONIZACIÓN PARA LOCKE ---');

// Definir argumentos de proceso para evitar levantar scheduler
process.argv.push('update-champion-db');

// Importar base de datos y repositorios
await import('../src/lib/db/sqlite.ts');
const { championsRepo } = await import('../src/lib/db/champions.repo.ts');
const { scrapeSingleChampion } = await import('../src/lib/services/sync.service.ts');

const nameIdMap = championsRepo.getChampionIdNameMap();
const dbPathJson = path.resolve(__dirname, '../src/lib/data/counter-synergies.json');
const dbMemory = fs.existsSync(dbPathJson) ? JSON.parse(fs.readFileSync(dbPathJson, 'utf-8')) : {};

// Consultar versión del parche configurado
const dbSync = new DatabaseSync(dbPath);
const configRow = dbSync.prepare("SELECT value FROM config WHERE key = 'last_sync_version'").get();
const patchVersion = configRow?.value && configRow.value !== '-' ? configRow.value : '14.11';
console.log(`Parche resuelto para prueba: ${patchVersion}`);

// Limpiar builds previas de Locke para verificar que se insertan de nuevo
console.log('Limpiando builds anteriores de Locke en BD...');
const lockeId = nameIdMap['locke'];
if (!lockeId) {
  console.error('Locke no está en la base de datos. Asegúrate de iniciar la base de datos primero.');
  process.exit(1);
}
dbSync.prepare('DELETE FROM builds WHERE champion_id = ?').run(lockeId);
dbSync.prepare('DELETE FROM matchups WHERE champion_id = ?').run(lockeId);
dbSync.prepare('DELETE FROM synergies WHERE champion_id = ?').run(lockeId);

console.log('\nEjecutando scrapeSingleChampion para Locke...');
try {
  await scrapeSingleChampion('Locke', patchVersion, dbMemory, nameIdMap, console.log);
  
  console.log('\nVerificando inserción en base de datos...');
  const builds = dbSync.prepare('SELECT COUNT(*) as count FROM builds WHERE champion_id = ?').get(lockeId);
  const matchups = dbSync.prepare('SELECT COUNT(*) as count FROM matchups WHERE champion_id = ?').get(lockeId);
  const synergies = dbSync.prepare('SELECT COUNT(*) as count FROM synergies WHERE champion_id = ?').get(lockeId);
  
  console.log(`Builds insertadas: ${builds.count}`);
  console.log(`Matchups insertados: ${matchups.count}`);
  console.log(`Sinergias insertadas: ${synergies.count}`);
  
  if (builds.count > 0 && synergies.count > 0) {
    if (matchups.count === 0) {
      console.log('⚠️ AVISO: Matchups insertados es 0. Esto es de esperar para campeones muy nuevos (con menos de 160 partidas en diamante para este parche).');
    }
    console.log('\n✅ TEST EXITOSO: Sincronización e inserción de Locke completadas correctamente!');
    process.exit(0);
  } else {
    console.error('\n❌ ERROR: Algunos datos críticos de Locke (builds o sinergias) no fueron insertados.');
    process.exit(1);
  }
} catch (e) {
  console.error('\n❌ ERROR CRÍTICO durante la prueba:', e);
  process.exit(1);
}
