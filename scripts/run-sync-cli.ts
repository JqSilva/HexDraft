import { resolveCurrentPatchVersion } from '../src/lib/domain/patch-version-resolver.js';
import { syncMetaAndBuilds } from '../src/lib/services/sync.service.js';
import { initializeEngineData } from '../src/lib/engine/core/dataProvider.js';
import { checkpointDb, closeDb } from '../src/lib/db/sqlite.js';

async function main(): Promise<void> {
  console.log('=== INICIANDO SYNC CLI (STANDALONE) ===');
  const args = process.argv.slice(2);
  let version = args[0];
  try {
    if (!version) version = (await resolveCurrentPatchVersion()).version;
    console.log(`[CLI] Sincronizando parche ${version} con LoLalytics (todos los campeones/carriles)...`);
    const summary = await syncMetaAndBuilds(version, () => false, console.log);
    console.log(`[CLI OK] Sincronización completada exitosamente:\n${summary}`);
    initializeEngineData();
    console.log('[CLI OK] Motor de datos inicializado correctamente.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CLI FATAL] Error durante la sincronización: ${message}`);
    process.exitCode = 1;
  } finally {
    checkpointDb();
    closeDb();
  }
  process.exit(process.exitCode === 1 ? 1 : 0);
}

void main();
