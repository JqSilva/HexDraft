import { resolveCurrentPatchVersion } from '../src/lib/domain/patch-version-resolver.js';
import { SyncEstructuraLanes } from '../src/lib/scripts/meta-map.js';
import { checkpointDb, closeDb } from '../src/lib/db/sqlite.js';

async function main(): Promise<void> {
  console.log('=== INICIANDO SYNC DE CARRILES (STANDALONE) ===');
  let version: string;
  try {
    version = (await resolveCurrentPatchVersion()).version;
    console.log(`[CLI] Versión resuelta: ${version}`);
    await SyncEstructuraLanes(version, () => false, console.log);
    console.log('=== SYNC DE CARRILES FINALIZADO CON ÉXITO ===');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CLI FATAL] Error durante la sincronización de carriles: ${message}`);
    process.exitCode = 1;
  } finally {
    checkpointDb();
    closeDb();
  }
}

void main();